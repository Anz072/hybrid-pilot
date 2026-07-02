import { DB } from "../../store/DB";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  shiftFoodDate,
} from "../Food/foodUtils";
import {
  getZoneOffsetMinutes,
  toLocalIsoWithOffset,
} from "../Weight/weightUtils";

const TEST_ENTRY_PREFIX = "[Test]";
const SEED_DAY_COUNT = 28;

type SeedMeal = {
  baseCalories: number;
  baseCarbsG: number;
  baseFatG: number;
  baseProteinG: number;
  hour: number;
  mealType: string;
  name: string;
};

export type TestDataSeedResult = {
  days: number;
  endDate: string;
  foodEntries: number;
  startDate: string;
  weightEntries: number;
};

const BREAKFASTS: SeedMeal[] = [
  {
    name: "Protein oats with berries",
    mealType: "Breakfast",
    hour: 8,
    baseCalories: 510,
    baseProteinG: 36,
    baseCarbsG: 58,
    baseFatG: 14,
  },
  {
    name: "Egg toast and fruit",
    mealType: "Breakfast",
    hour: 8,
    baseCalories: 455,
    baseProteinG: 29,
    baseCarbsG: 42,
    baseFatG: 19,
  },
  {
    name: "Greek yogurt granola bowl",
    mealType: "Breakfast",
    hour: 9,
    baseCalories: 430,
    baseProteinG: 33,
    baseCarbsG: 49,
    baseFatG: 11,
  },
  {
    name: "Smoothie and peanut toast",
    mealType: "Breakfast",
    hour: 8,
    baseCalories: 570,
    baseProteinG: 31,
    baseCarbsG: 67,
    baseFatG: 21,
  },
];

const LUNCHES: SeedMeal[] = [
  {
    name: "Chicken rice bowl",
    mealType: "Lunch",
    hour: 13,
    baseCalories: 710,
    baseProteinG: 48,
    baseCarbsG: 78,
    baseFatG: 20,
  },
  {
    name: "Turkey avocado wrap",
    mealType: "Lunch",
    hour: 12,
    baseCalories: 640,
    baseProteinG: 42,
    baseCarbsG: 55,
    baseFatG: 25,
  },
  {
    name: "Salmon quinoa salad",
    mealType: "Lunch",
    hour: 13,
    baseCalories: 690,
    baseProteinG: 44,
    baseCarbsG: 52,
    baseFatG: 31,
  },
  {
    name: "Lentil soup and sourdough",
    mealType: "Lunch",
    hour: 12,
    baseCalories: 585,
    baseProteinG: 28,
    baseCarbsG: 86,
    baseFatG: 13,
  },
];

const DINNERS: SeedMeal[] = [
  {
    name: "Beef pasta dinner",
    mealType: "Dinner",
    hour: 19,
    baseCalories: 820,
    baseProteinG: 51,
    baseCarbsG: 86,
    baseFatG: 28,
  },
  {
    name: "Tofu curry and rice",
    mealType: "Dinner",
    hour: 19,
    baseCalories: 760,
    baseProteinG: 34,
    baseCarbsG: 92,
    baseFatG: 26,
  },
  {
    name: "Shrimp tacos",
    mealType: "Dinner",
    hour: 20,
    baseCalories: 705,
    baseProteinG: 43,
    baseCarbsG: 68,
    baseFatG: 24,
  },
  {
    name: "Chicken potatoes and veg",
    mealType: "Dinner",
    hour: 18,
    baseCalories: 735,
    baseProteinG: 54,
    baseCarbsG: 64,
    baseFatG: 25,
  },
];

const SNACKS: SeedMeal[] = [
  {
    name: "Protein bar",
    mealType: "Snacks",
    hour: 16,
    baseCalories: 220,
    baseProteinG: 20,
    baseCarbsG: 22,
    baseFatG: 7,
  },
  {
    name: "Cottage cheese and jam",
    mealType: "Snacks",
    hour: 21,
    baseCalories: 245,
    baseProteinG: 25,
    baseCarbsG: 24,
    baseFatG: 6,
  },
  {
    name: "Trail mix",
    mealType: "Snacks",
    hour: 17,
    baseCalories: 315,
    baseProteinG: 10,
    baseCarbsG: 28,
    baseFatG: 19,
  },
  {
    name: "Banana shake",
    mealType: "Snacks",
    hour: 15,
    baseCalories: 275,
    baseProteinG: 23,
    baseCarbsG: 35,
    baseFatG: 5,
  },
];

const toLocalNoon = (date: Date) => {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
};

const roundTo = (value: number, places = 1) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const pickMeal = (meals: SeedMeal[], index: number) =>
  meals[index % meals.length];

const scaleMeal = (meal: SeedMeal, dayIndex: number, mealIndex: number) => {
  const jitter = ((dayIndex * 37 + mealIndex * 23) % 95) - 34;
  const calories = Math.max(120, meal.baseCalories + jitter);
  const scale = calories / meal.baseCalories;

  return {
    ...meal,
    calories,
    proteinG: roundTo(meal.baseProteinG * scale),
    carbsG: roundTo(meal.baseCarbsG * scale),
    fatG: roundTo(meal.baseFatG * scale),
  };
};

const getMealsForDay = (dayIndex: number) => {
  const meals = [
    pickMeal(BREAKFASTS, dayIndex),
    pickMeal(LUNCHES, dayIndex + 1),
    pickMeal(DINNERS, dayIndex + 2),
  ];

  if (dayIndex % 4 !== 1) {
    meals.push(pickMeal(SNACKS, dayIndex + 3));
  }

  return meals.map((meal, mealIndex) => scaleMeal(meal, dayIndex, mealIndex));
};

const hashSeedToUuid = (seed: string): string => {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let third = 0x85ebca6b;
  let fourth = 0xc2b2ae35;

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
    third = Math.imul(third ^ code, 0xc2b2ae35) >>> 0;
    fourth = Math.imul(fourth ^ code, 0x27d4eb2f) >>> 0;
  }

  const hex = [first, second, third, fourth]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
};

const buildWeightValue = (dayIndex: number) => {
  const trend = (SEED_DAY_COUNT - dayIndex - 1) * 0.055;
  const wave = Math.sin(dayIndex * 0.72) * 0.18;
  const weekendLift = dayIndex % 7 === 5 || dayIndex % 7 === 6 ? 0.16 : 0;

  return roundTo(82.4 + trend + wave + weekendLift, 2);
};

export const seedDeveloperTestData = async (
  userExternalId: string,
): Promise<TestDataSeedResult> => {
  const today = toLocalNoon(new Date());
  const startDate = shiftFoodDate(today, -(SEED_DAY_COUNT - 1));
  const startDateKey = formatFoodDateKey(startDate);
  const endDateKey = formatFoodDateKey(today);
  const existingEntries = await DB.getUserFoodLogEntriesBetween(
    userExternalId,
    startDateKey,
    endDateKey,
  );
  const priorSeedEntries = existingEntries.filter(
    (entry) =>
      entry.entrySource === "quick_add" &&
      (entry.quickAddName ?? entry.foodName).startsWith(TEST_ENTRY_PREFIX),
  );

  for (const entry of priorSeedEntries) {
    await DB.deleteUserFoodLog(entry.id);
  }

  let foodEntries = 0;
  let weightEntries = 0;

  for (let dayIndex = 0; dayIndex < SEED_DAY_COUNT; dayIndex += 1) {
    const date = shiftFoodDate(startDate, dayIndex);
    const dateKey = formatFoodDateKey(date);
    const meals = getMealsForDay(dayIndex);

    for (const [mealIndex, meal] of meals.entries()) {
      await DB.addQuickAddFoodLog({
        userExternalId,
        date: dateKey,
        loggedAt: buildFoodLoggedAt(dateKey, meal.hour, mealIndex * 7),
        mealType: meal.mealType,
        name: `${TEST_ENTRY_PREFIX} ${meal.name}`,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        systemCalculatedCalories: meal.calories,
        isEnergyManuallySet: false,
      });
      foodEntries += 1;
    }

    const measuredAtDate = new Date(date);
    measuredAtDate.setHours(7, 15, 0, 0);
    const measuredAtLocalIso = toLocalIsoWithOffset(measuredAtDate);
    const entryId = hashSeedToUuid(
      `${userExternalId}:developer-test-weight:${dateKey}`,
    );

    await DB.saveWeightEntry({
      id: entryId,
      userExternalId,
      measuredAt: measuredAtDate.toISOString(),
      measuredAtLocalIso,
      zoneOffsetMinutes: getZoneOffsetMinutes(measuredAtDate),
      valueKg: buildWeightValue(dayIndex),
      valueOriginal: buildWeightValue(dayIndex),
      unitOriginal: "kg",
      source: "manual",
      notes: "Developer test data",
      clientGeneratedId: entryId,
    });
    weightEntries += 1;
  }

  return {
    days: SEED_DAY_COUNT,
    endDate: endDateKey,
    foodEntries,
    startDate: startDateKey,
    weightEntries,
  };
};
