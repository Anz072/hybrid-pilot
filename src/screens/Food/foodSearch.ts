import { API } from "../../API/apiCaller";
import type { DBFoodItem, SaveFoodItemInput } from "../../store/DB_TYPES";

export type FoodSearchResult = SaveFoodItemInput & {
  key: string;
  localId: number | null;
  localFood: DBFoodItem | null;
};

type FoodSearchScoreOptions = {
  brandScoreBonus?: number;
  completeScoreBonus?: number;
  incompleteScorePenalty?: number;
  localScoreBonus?: number;
  usdaScoreBonus?: number;
  verifiedScoreBonus?: number;
};

type FoodSearchDedupeOptions = {
  includeDisplayKey?: (food: FoodSearchResult) => boolean;
};

export type RankFoodSearchOptions = FoodSearchScoreOptions & {
  categoryPriority?: (food: FoodSearchResult) => number;
  dedupe?: FoodSearchDedupeOptions;
  maxResults?: number;
};

type SearchFoodResultsInput = {
  query: string;
  getLocalRows: (query: string) => Promise<DBFoodItem[]>;
  filterLocalRow?: (food: DBFoodItem) => boolean;
  includeLocalFood?: boolean;
  includeRemote?: boolean;
  rankOptions?: RankFoodSearchOptions;
  remoteMinQueryLength?: number;
  remotePageSize?: number;
};

const DEFAULT_MAX_SEARCH_RESULTS = 30;
const DEFAULT_REMOTE_SEARCH_MIN_QUERY_LENGTH = 3;
const DEFAULT_REMOTE_PAGE_SIZE = 12;
const REMOTE_BARCODE_QUERY_PATTERN = /^\d{8,}$/;

export const normalizeSearchText = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const compactSearchText = (value?: string | null) =>
  normalizeSearchText(value).replace(/\s+/g, "");

const singularizeSearchWord = (value: string) => {
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s") && value.length > 3) {
    return value.slice(0, -1);
  }

  return null;
};

const getSearchVariants = (query: string) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const variants = new Set<string>([normalizedQuery]);

  if (!normalizedQuery.includes(" ")) {
    const singular = singularizeSearchWord(normalizedQuery);
    if (singular) {
      variants.add(singular);
    }
  }

  return [...variants];
};

export const shouldSearchRemotely = (
  query: string,
  minQueryLength = DEFAULT_REMOTE_SEARCH_MIN_QUERY_LENGTH,
) => query.length >= minQueryLength || REMOTE_BARCODE_QUERY_PATTERN.test(query);

export const getFoodIdentityKey = (
  food: Pick<FoodSearchResult, "barcode" | "name" | "source" | "sourceId">,
) =>
  `${food.source}:${food.sourceId?.trim() ?? food.barcode?.trim() ?? normalizeSearchText(food.name)}`;

export const toSearchFoodResult = (
  food: SaveFoodItemInput,
  localId: number | null,
  localFood: DBFoodItem | null = null,
): FoodSearchResult => ({
  ...food,
  key: `${getFoodIdentityKey({
    source: food.source,
    sourceId: food.sourceId,
    barcode: food.barcode,
    name: food.name,
  })}:${localId ?? "remote"}`,
  localId,
  localFood,
});

export const fromDbFoodItem = (
  food: DBFoodItem,
  includeLocalFood = false,
): FoodSearchResult => {
  const {
    id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...saveInput
  } = food;

  return toSearchFoodResult(saveInput, id, includeLocalFood ? food : null);
};

export const getSearchDedupeKeys = (
  food: FoodSearchResult,
  options: FoodSearchDedupeOptions = {},
) => {
  const keys = new Set<string>([`identity:${getFoodIdentityKey(food)}`]);
  const barcode = food.barcode?.trim();
  const shouldIncludeDisplayKey = options.includeDisplayKey?.(food) ?? true;

  if (barcode) {
    keys.add(`barcode:${barcode}`);
  }

  if (shouldIncludeDisplayKey) {
    const display = compactSearchText(`${food.brand ?? ""} ${food.name}`);
    if (display) {
      keys.add(`display:${display}`);
    }
  }

  return [...keys];
};

export const scoreSearchFoodResult = (
  food: FoodSearchResult,
  query: string,
  options: FoodSearchScoreOptions = {},
) => {
  const queryVariants = getSearchVariants(query);
  const compactQueryVariants = queryVariants.map(compactSearchText);
  const tokenSet = new Set<string>();

  for (const variant of queryVariants) {
    variant
      .split(" ")
      .filter(Boolean)
      .forEach((token) => tokenSet.add(token));
  }

  const tokens = [...tokenSet];
  const normalizedName = normalizeSearchText(food.name);
  const normalizedBrand = normalizeSearchText(food.brand);
  const normalizedCombined = normalizeSearchText(
    `${food.brand ?? ""} ${food.name}`,
  );
  const compactName = compactSearchText(food.name);
  const compactCombined = compactSearchText(`${food.brand ?? ""} ${food.name}`);
  const exactBarcodeMatch = food.barcode?.trim() === query.trim();

  let score = 0;

  if (exactBarcodeMatch) {
    score += 1400;
  }

  if (queryVariants.some((variant) => normalizedName === variant)) {
    score += 950;
  }

  if (queryVariants.some((variant) => normalizedCombined === variant)) {
    score += 900;
  }

  if (queryVariants.some((variant) => normalizedBrand === variant)) {
    score += 480;
  }

  if (
    compactQueryVariants.some(
      (variant) =>
        variant.length > 0 &&
        (compactName === variant || compactCombined.includes(variant)),
    )
  ) {
    score += 760;
  }

  if (queryVariants.some((variant) => normalizedName.startsWith(variant))) {
    score += 620;
  }

  if (queryVariants.some((variant) => normalizedCombined.startsWith(variant))) {
    score += 540;
  }

  if (queryVariants.some((variant) => normalizedBrand.startsWith(variant))) {
    score += 320;
  }

  if (queryVariants.some((variant) => normalizedName.includes(variant))) {
    score += 300;
  }

  if (queryVariants.some((variant) => normalizedCombined.includes(variant))) {
    score += 240;
  }

  if (queryVariants.some((variant) => normalizedBrand.includes(variant))) {
    score += 140;
  }

  const matchedTokenCount = tokens.filter((token) =>
    normalizedCombined.includes(token),
  ).length;

  score += matchedTokenCount * 70;

  if (tokens.length > 0 && matchedTokenCount === tokens.length) {
    score += 220;
  }

  if (food.localId != null) {
    score += options.localScoreBonus ?? 100;
  }

  if (food.source === "usda") {
    score += options.usdaScoreBonus ?? 0;
  }

  if (food.verified) {
    score += options.verifiedScoreBonus ?? 12;
  }

  if (food.brand) {
    score += options.brandScoreBonus ?? 0;
  }

  if (food.isComplete) {
    score += options.completeScoreBonus ?? 0;
  } else {
    score -= options.incompleteScorePenalty ?? 0;
  }

  return score;
};

export const rankSearchResults = (
  query: string,
  results: FoodSearchResult[],
  options: RankFoodSearchOptions = {},
) => {
  const sorted = [...results].sort((left, right) => {
    if (options.categoryPriority) {
      const categoryDifference =
        options.categoryPriority(left) - options.categoryPriority(right);

      if (categoryDifference !== 0) {
        return categoryDifference;
      }
    }

    const scoreDifference =
      scoreSearchFoodResult(right, query, options) -
      scoreSearchFoodResult(left, query, options);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if ((right.localId != null) !== (left.localId != null)) {
      return Number(right.localId != null) - Number(left.localId != null);
    }

    return left.name.localeCompare(right.name);
  });

  const seen = new Set<string>();
  const unique: FoodSearchResult[] = [];
  const maxResults = options.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS;

  for (const result of sorted) {
    const dedupeKeys = getSearchDedupeKeys(result, options.dedupe);

    if (dedupeKeys.some((key) => seen.has(key))) {
      continue;
    }

    unique.push(result);
    dedupeKeys.forEach((key) => seen.add(key));

    if (unique.length >= maxResults) {
      break;
    }
  }

  return unique;
};

export const searchFoodResults = async ({
  query,
  getLocalRows,
  filterLocalRow,
  includeLocalFood = false,
  includeRemote = true,
  rankOptions,
  remoteMinQueryLength = DEFAULT_REMOTE_SEARCH_MIN_QUERY_LENGTH,
  remotePageSize = DEFAULT_REMOTE_PAGE_SIZE,
}: SearchFoodResultsInput) => {
  const trimmedQuery = query.trim();

  const [localRows, remoteRows] = await Promise.all([
    getLocalRows(trimmedQuery),
    includeRemote && shouldSearchRemotely(trimmedQuery, remoteMinQueryLength)
      ? API.usdaAPI.getFood(trimmedQuery, { pageSize: remotePageSize })
      : Promise.resolve([]),
  ]);

  const localResults = localRows
    .filter((food) => filterLocalRow?.(food) ?? true)
    .map((food) => fromDbFoodItem(food, includeLocalFood));
  const localKeys = new Set(
    localResults.flatMap((food) =>
      getSearchDedupeKeys(food, rankOptions?.dedupe),
    ),
  );
  const remoteResults = remoteRows
    .map((food) => toSearchFoodResult(food, null))
    .filter((food) =>
      getSearchDedupeKeys(food, rankOptions?.dedupe).every(
        (key) => !localKeys.has(key),
      ),
    );

  return rankSearchResults(
    trimmedQuery,
    [...localResults, ...remoteResults],
    rankOptions,
  );
};
