require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getFoodLogCopyPreview,
  getFoodLogEntriesToCopy,
} = require("../src/store/foodLogCopyUtils.ts");

const baseEntry = (overrides = {}) => ({
  id: 1,
  userExternalId: "user-1",
  foodId: 10,
  date: "2026-05-16",
  loggedAt: "2026-05-16T07:30:00.000Z",
  quantityG: 100,
  mealType: null,
  createdAt: "2026-05-16T07:30:00.000Z",
  entrySource: "food_item",
  foodName: "Greek yogurt",
  servingSize: 100,
  servingUnit: "g",
  calories: 120,
  proteinG: 15,
  carbsG: 8,
  fatG: 3,
  alcoholG: null,
  systemCalculatedCalories: null,
  isEnergyManuallySet: false,
  quickAddName: null,
  ...overrides,
});

test("copy preview skips exact duplicate entries", () => {
  const source = [
    baseEntry({ id: 1 }),
    baseEntry({
      id: 2,
      foodId: 11,
      foodName: "Banana",
      loggedAt: "2026-05-16T08:00:00.000Z",
      createdAt: "2026-05-16T08:00:00.000Z",
    }),
  ];
  const destination = [baseEntry({ id: 3, date: "2026-05-17" })];

  assert.deepEqual(getFoodLogCopyPreview(source, destination), {
    sourceCount: 2,
    destinationCount: 1,
    copiedCount: 1,
    skippedDuplicates: 1,
  });
});

test("entries-to-copy preserves non-duplicate source order", () => {
  const duplicate = baseEntry({ id: 1 });
  const copyable = baseEntry({
    id: 2,
    foodId: 11,
    foodName: "Banana",
    loggedAt: "2026-05-16T08:00:00.000Z",
    createdAt: "2026-05-16T08:00:00.000Z",
  });
  const source = [duplicate, copyable];
  const destination = [baseEntry({ id: 3, date: "2026-05-17" })];

  assert.deepEqual(getFoodLogEntriesToCopy(source, destination), [copyable]);
});

test("quick-add duplicate keys include macro and manual-energy shape", () => {
  const quickAdd = baseEntry({
    id: -1,
    foodId: null,
    entrySource: "quick_add",
    foodName: "Quick Add",
    quickAddName: "Coffee",
    quantityG: 1,
    servingSize: 1,
    servingUnit: "entry",
    calories: 90,
    proteinG: 0,
    carbsG: 12,
    fatG: 4,
    systemCalculatedCalories: 84,
    isEnergyManuallySet: true,
  });
  const differentEnergyMode = {
    ...quickAdd,
    id: -2,
    isEnergyManuallySet: false,
  };

  assert.deepEqual(getFoodLogCopyPreview([quickAdd], [differentEnergyMode]), {
    sourceCount: 1,
    destinationCount: 1,
    copiedCount: 1,
    skippedDuplicates: 0,
  });
});
