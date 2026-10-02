import { describe, expect, it, vi } from "vitest";
import type { ProtocolSchedule } from "../src/domain/types";
import { addProtocolDate, configurationDraft, currentProtocolPhase, protocolDate, protocolFormError, resolveProtocolConfiguration } from "../src/screens/Protocols/protocolForm";
import { course as fixture } from "./fixtures/protocols";

describe("Protocol form boundary", () => {
  it("never presents a retained phase after a course's exclusive end as its historical schedule", () => {
    const first = { ...fixture.phases[0]!, effectiveFrom: "2026-09-09T00:00:00.000Z" };
    const later = { ...first, id: "later", effectiveFrom: "2026-09-12T00:00:00.000Z" };
    const course = { ...fixture, phases: [first, later] };
    const now = Date.parse("2026-09-20T00:00:00.000Z");
    expect(currentProtocolPhase({ ...course, endAt: null }, now)).toEqual(later);
    expect(currentProtocolPhase({ ...course, endAt: later.effectiveFrom }, now)).toEqual(first);
    expect(currentProtocolPhase({ ...course, endAt: "2026-09-11T00:00:00.000Z" }, now)).toEqual(first);
    expect(currentProtocolPhase({ ...course, endAt: "2026-09-30T00:00:00.000Z" }, now)).toEqual(later);
  });
  it("round-trips all six schedules with per-slot precision and stable keys", async () => {
    const slot = { key: "am", time: "08:00", amount: "1.123456789012", unit: "mg" } as const;
    const schedules: ProtocolSchedule[] = [
      { kind: "daily", doses: [slot, { ...slot, key: "pm", time: "20:00", amount: "0.75" }] },
      { kind: "every_n_days", doses: [slot], intervalDays: 3, anchorDate: "2026-09-01" },
      { kind: "every_n_hours", intervalHours: 36, anchorAt: "2026-11-01T06:30:42.123Z", amount: slot.amount, unit: slot.unit },
      { kind: "specific_weekdays", days: [{ weekday: 0, doses: [slot] }, { weekday: 4, doses: [{ ...slot, key: "fri", time: "16:30", amount: "0.875" }] }] },
      { kind: "one_time", at: "2026-11-01T06:30:42.123Z", amount: slot.amount, unit: slot.unit },
      { kind: "as_needed", amount: slot.amount, unit: slot.unit },
    ];
    for (const schedule of schedules) {
      const configuration = { route: "IM", timezone: "America/New_York", schedule } as const;
      const draft = configurationDraft(configuration, configuration.timezone, "new-key");
      const resolve = vi.fn();
      expect(protocolFormError(draft)).toBeNull();
      expect(await resolveProtocolConfiguration(draft, resolve)).toEqual(configuration);
      expect(resolve).not.toHaveBeenCalled(); // Includes the later DST fold and fractional seconds.
    }
  });

  it("leaves amounts blank and resolves changed civil times through the server", async () => {
    const draft = configurationDraft(undefined, "America/New_York", "first");
    expect(draft.doses[0]?.amount).toBe("");
    expect(protocolFormError(draft)).toMatch(/positive dose/);
    const resolve = vi.fn().mockResolvedValue({ at: "2026-03-08T07:30:00.000Z", disambiguation: "gap_forward_fold_earlier" });
    const changed = { ...draft, kind: "every_n_hours", interval: "36", anchorDate: "2026-03-08", anchorTime: "02:30", doses: draft.doses.map((dose) => ({ ...dose, amount: "0.000000000001" })) } as const;
    expect((await resolveProtocolConfiguration(changed, resolve)).schedule).toEqual({ kind: "every_n_hours", intervalHours: 36, anchorAt: "2026-03-08T07:30:00.000Z", amount: "0.000000000001", unit: "mg" });
    expect(resolve).toHaveBeenCalledWith({ date: "2026-03-08", time: "02:30", timezone: "America/New_York" });
    expect(protocolFormError({ ...changed, interval: "1.5" })).toMatch(/whole-number/);
    expect(addProtocolDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(protocolDate("2026-09-09T22:00:00.000Z", "Europe/Vilnius")).toBe("2026-09-10");
  });
});
