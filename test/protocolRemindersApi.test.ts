import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/API/nouri/protocolsApi";
import { alice, courseId, now, operationId } from "./fixtures/protocols";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/API/nouri/client", () => ({ apiRequest: request }));
type Parser = { parse: (value: unknown) => unknown };
const provider = new URL("../../nouri-api/", import.meta.url);
let schemas: Record<string, Parser>;
beforeAll(async () => { schemas = await import(new URL("src/modules/protocols/reminderSchemas.ts", provider).href); });
beforeEach(() => request.mockReset());

describe("reminders and timeline mobile boundary", () => {
  it("uses authenticated provider contracts and preserves one-time scheduling and revision commands", async () => {
    const create = { id: courseId, title: "Bloodwork", scheduledAt: now, timezone: "Europe/Vilnius" };
    const reminder = { ...create, revision: 1, createdAt: now, updatedAt: now };
    expect(schemas.reminderSchema!.parse(reminder)).toEqual(reminder);
    const { id: _id, ...fields } = create;
    const edit = { ...fields, operationId, expectedRevision: 1 };
    const annotations = { timezone: "UTC", courses: [], events: [] };
    const query = { start: "2026-09-01", end: "2026-09-30", tz: "UTC", courseIds: [courseId] };
    const operations = [
      { call: () => api.createProtocolReminder(alice, create), path: "/v1/protocol-reminders", result: reminder, options: { method: "POST", body: create }, parser: "createReminderSchema" },
      { call: () => api.getProtocolReminder(alice, courseId), path: `/v1/protocol-reminders/${courseId}`, result: reminder, options: {} },
      { call: () => api.editProtocolReminder(alice, courseId, edit), path: `/v1/protocol-reminders/${courseId}`, result: { ...reminder, revision: 2 }, options: { method: "PATCH", body: edit }, parser: "editReminderSchema" },
      { call: () => api.deleteProtocolReminder(alice, courseId, 2), path: `/v1/protocol-reminders/${courseId}`, result: { deleted: true }, options: { method: "DELETE", query: { expectedRevision: 2 } } },
      { call: () => api.getProtocolAnnotations(alice, query), path: "/v1/protocols/annotations", result: annotations, options: { query: { ...query, courseIds: courseId } } },
    ];
    const openapi = JSON.parse(readFileSync(new URL("docs/api/openapi.json", provider), "utf8"));
    for (const operation of operations) {
      request.mockResolvedValueOnce(operation.result); expect(await operation.call()).toEqual(operation.result);
      expect(request.mock.lastCall).toEqual([operation.path, { ...operation.options, expectedUserId: alice }]);
      if (operation.parser) expect(schemas[operation.parser]!.parse(operation.options.body)).toEqual(operation.options.body);
      const path = operation.path.replace(/\/[0-9a-f-]{36}(?=\/|$)/g, "/{id}");
      expect(openapi.paths[path][(operation.options.method ?? "GET").toLowerCase()].security).toEqual([{ supabaseAccessToken: [] }]);
    }
  });
});
