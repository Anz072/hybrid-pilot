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
