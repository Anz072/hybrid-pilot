import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { beforeAll,beforeEach,describe,expect,it,vi } from "vitest";
import * as api from "../src/API/nouri/bloodworkApi";
import { biomarker,bloodworkInput,bloodworkPanel } from "./fixtures/bloodwork";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/API/nouri/client",() => ({ apiRequest: request }));
const provider = new URL("../../nouri-api/",import.meta.url);
type Parser = { parse: (value: unknown) => unknown };
let schemas: Record<string,Parser>;
beforeAll(async () => { schemas = await import(new URL("src/modules/bloodwork/schemas.ts",provider).href); });
beforeEach(() => request.mockReset());
describe("bloodwork mobile boundary against provider schemas and OpenAPI",() => {
  it("keeps exact values and nullable fields in serialized DTOs",() => {
    expect(schemas.biomarkerSchema!.parse(biomarker)).toEqual(biomarker);
    expect(schemas.createPanelSchema!.parse(bloodworkInput)).toEqual(bloodworkInput);
    expect(schemas.panelSchema!.parse(bloodworkPanel)).toEqual(bloodworkPanel);
  });
  it("binds every operation to the owning account and existing authenticated contract",async () => {
    const owner = "a1000000-0000-4000-8000-000000000001"; const id = bloodworkPanel.id;
    const edit = { operationId: "f1000000-0000-4000-8000-000000000001",expectedRevision: 1,labName: null,results: bloodworkInput.results };
    const query = { after: `${bloodworkPanel.collectedOn}/${id}`,limit: 10 };
    const historyQuery = { ...query, displayUnit: "ng/dL" };
    const history = { biomarker, displayUnit: "ng/dL", results: bloodworkPanel.results.map((r) => ({ ...r, panelId: id, collectedOn: bloodworkPanel.collectedOn, labName: bloodworkPanel.labName })), nextCursor: null };
    expect(schemas.historySchema!.parse(history)).toEqual(history);
    const { results: _results,...summary } = bloodworkPanel;
    const operations = [
      { call: () => api.listBiomarkers(owner),path: "/v1/biomarkers",result: { biomarkers: [biomarker] },options: {} },
      { call: () => api.listBloodworkPanels(owner,query),path: "/v1/bloodwork",result: { panels: [summary],nextCursor: null },options: { query } },
      { call: () => api.getBloodworkPanel(owner,id),path: `/v1/bloodwork/${id}`,result: bloodworkPanel,options: {} },
      { call: () => api.getBloodworkHistory(owner,biomarker.id,historyQuery),path: `/v1/bloodwork/biomarkers/${biomarker.id}/results`,result: history,options: { query: historyQuery } },
      { call: () => api.createBloodworkPanel(owner,bloodworkInput),path: "/v1/bloodwork",result: bloodworkPanel,options: { method: "POST",body: bloodworkInput },parser: "createPanelSchema" },
      { call: () => api.editBloodworkPanel(owner,id,edit),path: `/v1/bloodwork/${id}`,result: bloodworkPanel,options: { method: "PATCH",body: edit },parser: "editPanelSchema" },
      { call: () => api.deleteBloodworkPanel(owner,id,1),path: `/v1/bloodwork/${id}`,result: { deleted: true },options: { method: "DELETE",query: { expectedRevision: 1 } } },
      { call: () => api.setBiomarkerDisplayUnit(owner,biomarker.id,"ng/dL"),path: `/v1/bloodwork/preferences/${biomarker.id}`,result: { biomarkerId: biomarker.id,displayUnit: "ng/dL" },options: { method: "PUT",body: { displayUnit: "ng/dL" } },parser: "preferenceSchema" },
    ];
    const openapi = JSON.parse(readFileSync(new URL("docs/api/openapi.json",provider),"utf8"));
    for (const operation of operations) {
      request.mockResolvedValueOnce(operation.result); expect(await operation.call()).toEqual(operation.result);
      expect(request.mock.lastCall).toEqual([operation.path,{ ...operation.options,expectedUserId: owner }]);
      if (operation.parser) expect(schemas[operation.parser]!.parse(JSON.parse(JSON.stringify(operation.options.body)))).toEqual(operation.options.body);
      const path = operation.path.replace(/\/[0-9a-f-]{36}(?=\/|$)/g,"/{id}");
      expect(openapi.paths[path][(operation.options.method ?? "GET").toLowerCase()].security).toEqual([{ supabaseAccessToken: [] }]);
    }
  });
});
