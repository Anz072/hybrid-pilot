/**
 * The domain's vocabulary.
 *
 * The closed sets of values the app reasons about: what a food's nutrition is
 * measured against, where a weight reading came from, which states an adaptive
 * recommendation moves through. They describe the domain, not a table.
 *
 * They lived in `store/DB_TYPES.ts`, a file named after a device database that
 * no longer exists. That made the dependency point the wrong way: pure logic in
 * `src/domain/` and `src/engine/` — the modules the shared conformance corpus
 * pins against the backend — imported their vocabulary from the storage layer.
 * Now the storage layer imports it from here, and `test/architecture.test.ts`
 * keeps it that way.
 *
 * `store/DB_TYPES.ts` re-exports everything below, so the ~45 screens and
 * stores that already import from there are unaffected. New code should import
 * from this module.
 */

export type DBIsoDateString = string;

// Protocol amounts remain exact decimal strings until a derived chart value is
// returned by the API. Mobile never compiles recurrence or estimates PK.
export type ProtocolDoseUnit = "mg" | "mcg" | "IU";
export type ProtocolRoute = "IM" | "SC";
export type ProtocolDose = { amount: string; unit: ProtocolDoseUnit };
export type ProtocolScheduleSlot = ProtocolDose & { key: string; time: string };
export type ProtocolSchedule =
  | { kind: "daily"; doses: ProtocolScheduleSlot[] }
  | { kind: "every_n_days"; intervalDays: number; anchorDate: string; doses: ProtocolScheduleSlot[] }
  | (ProtocolDose & { kind: "every_n_hours"; intervalHours: number; anchorAt: string })
  | { kind: "specific_weekdays"; days: Array<{ weekday: number; doses: ProtocolScheduleSlot[] }> }
  | (ProtocolDose & { kind: "one_time"; at: string })
  | (ProtocolDose & { kind: "as_needed" });
export type ProtocolCourseStatus = "DRAFT" | "ACTIVE" | "ENDED";
export type ProtocolPhaseConfiguration = { timezone: string; route: ProtocolRoute; schedule: ProtocolSchedule };
export type ProtocolPhase = ProtocolPhaseConfiguration & { id: string; effectiveFrom: string };
export type ProtocolChartRange = "1W" | "1M" | "3M" | "All";
export type ProtocolChartMetric = "relative" | "amount";

export type DBUserProvider = "local" | "email";

export type DBUserGender = "male" | "female" | "other" | null;

export type WeightEntrySource =
  | "manual"
  | "import"
  | "smart_scale"
  | "healthkit"
  | "health_connect"
  | "google_fit"
  | "csv";

export type FoodSource =
  | "custom"
  | "manual"
  | "open_food_facts"
  | "import"
  | "usda"
  | "recipe";

export type NutritionBasis = "100g" | "100ml" | "serving";

export type RecipeBuildMethod = "scratch" | "link" | "ai";

export type UserFoodLogSource =
  | "food_item"
  | "custom_recipe"
  | "custom_meal"
  | "quick_add";

export type AdaptiveCalorieMode = "recommend" | "auto_apply";

export type AdaptiveCalorieRecommendationStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "applied"
  | "superseded";

export type AdaptiveCalorieRecommendationConfidence =
  | "low"
  | "medium"
  | "high";
