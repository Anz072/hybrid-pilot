import { afterEach, describe, expect, it, vi } from "vitest";
import {
  diaryAnchorHeight,
  diaryRevealOffset,
} from "../src/screens/Food/diaryScrollGeometry";
import type { ApiDiaryEntry } from "../src/API/nouri/diaryApi";

const request = vi.hoisted(() => vi.fn());
vi.mock("../src/API/nouri/client", () => ({
  apiRequest: request,
  getDeviceTimeZone: () => "UTC",
  NouriApiError: class extends Error {},
}));
vi.mock("../src/API/supabase/client", () => ({
  getSupabaseSessionUser: async () => ({ id: "user-1" }),
}));

import { DB } from "../src/store/DB";
import {
  subscribeToAppDataChanges,
  type AppDataChangeEvent,
} from "../src/store/dataChangeEvents";

const accepted: ApiDiaryEntry = {
  id: 42,
  foodId: 9,
  date: "2026-09-06",
  loggedAt: "2026-09-06T00:01:00.000Z",
  createdAt: "2026-09-06T00:01:01.000Z",
  entryType: "food_item",
  mealType: "Dinner",
  mealSlot: "dinner",
  quantity: 200,
  unit: "g",
  servingSize: 100,
  servingUnit: "g",
  displayName: "Yogurt",
  quickAddName: null,
  isEnergyManuallySet: false,
  systemCalculatedCalories: null,
  alcoholG: null,
  nutrition: { calories: 240, proteinG: 20, carbsG: 12, fatG: 8 },
};
const input = {
  userExternalId: "user-1",
  foodId: 9,
  date: "2026-09-05",
  quantityG: 200,
  mealType: "Dinner",
};
let unsubscribe: (() => void) | undefined;
afterEach(() => {
  unsubscribe?.();
  request.mockReset();
});

describe("saved diary entry handoff", () => {
  it("returns the accepted entry and notifies only after the save succeeds", async () => {
    const events: AppDataChangeEvent[] = [];
    unsubscribe = subscribeToAppDataChanges((event) => events.push(event));
    let finish!: (entry: ApiDiaryEntry) => void;
    request.mockReturnValue(
      new Promise<ApiDiaryEntry>((resolve) => {
        finish = resolve;
      }),
    );
    const save = DB.addUserFoodLog(input);
    expect(events).toEqual([]);
    finish(accepted);
    const entry = await save;
    expect(entry).toMatchObject({
      id: 42,
      date: "2026-09-06",
      quantityG: 200,
      calories: 120,
    });
    expect(events).toEqual([
      {
        kind: "food_log",
        userExternalId: "user-1",
        date: "2026-09-06",
        foodEntryId: 42,
      },
    ]);
  });

  it("can correct that same ID with a PATCH, without creating a second food log", async () => {
    request
      .mockResolvedValueOnce(accepted)
      .mockResolvedValueOnce({ ...accepted, quantity: 300 });
    const entry = await DB.addUserFoodLog(input);
    await DB.updateUserFoodLog({
      id: entry.id,
      quantityG: 300,
      mealType: "Dinner",
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].method).toBe("POST");
    expect(request.mock.calls[1][0]).toBe("/v1/diary/entries/42");
    expect(request.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: { quantity: 300 },
    });
  });

  it("does not announce or reveal a save that the server rejected", async () => {
    const listener = vi.fn();
    unsubscribe = subscribeToAppDataChanges(listener);
    request.mockRejectedValue(new Error("Connection failed"));
    await expect(DB.addUserFoodLog(input)).rejects.toThrow("Connection failed");
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps Quick Add's numeric return while revealing its accepted ID and day", async () => {
    const events: AppDataChangeEvent[] = [];
    unsubscribe = subscribeToAppDataChanges((event) => events.push(event));
    request.mockResolvedValue({
      ...accepted,
      foodId: null,
      entryType: "quick_add",
      quickAddName: "Lunch",
    });
    const id = await DB.addQuickAddFoodLog({
      userExternalId: "user-1",
      date: "2026-09-05",
      calories: 240,
      mealType: "Lunch",
    });
    expect(id).toBe(42);
    expect(events).toEqual([
      {
        kind: "food_log",
        userExternalId: "user-1",
        date: "2026-09-06",
        foodEntryId: 42,
      },
    ]);
  });
});

describe("diary scroll continuity", () => {
  it("prevents the old 56 dp bottom collapse from clamping the scroll offset", () => {
    const viewport = 780;
    const scrollY = 570;
    const naturalHeightAfterCollapse = 1294;
    const minHeight = diaryAnchorHeight(scrollY, viewport);
    const nativeMaximum =
      Math.max(naturalHeightAfterCollapse, minHeight) - viewport;
    expect(Math.min(scrollY, nativeMaximum)).toBe(scrollY);
    // The floor can be released as the user scrolls up without moving that viewport.
    expect(diaryAnchorHeight(400, viewport)).toBeLessThan(
      naturalHeightAfterCollapse,
    );
  });

  it("does not scroll a saved food that is already fully visible", () => {
    expect(
      diaryRevealOffset({
        scrollY: 400,
        viewportY: 54,
        viewportHeight: 780,
        rowY: 200,
        rowHeight: 48,
      }),
    ).toBe(400);
  });

  it("reveals the bottom row with only the necessary movement, clearing the snackbar", () => {
    expect(
      diaryRevealOffset({
        scrollY: 400,
        viewportY: 54,
        viewportHeight: 780,
        rowY: 720,
        rowHeight: 48,
        bottomInset: 88,
      }),
    ).toBe(422);
  });

  it("aligns the top of a tall row and never scrolls past the start", () => {
    expect(
      diaryRevealOffset({
        scrollY: 100,
        viewportY: 54,
        viewportHeight: 780,
        rowY: 90,
        rowHeight: 900,
      }),
    ).toBe(124);
    expect(
      diaryRevealOffset({
        scrollY: 0,
        viewportY: 54,
        viewportHeight: 780,
        rowY: 54,
        rowHeight: 48,
      }),
    ).toBe(0);
  });
});
