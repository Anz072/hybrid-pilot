import type { DBFoodItem, SaveFoodItemInput } from "../../store/DB_TYPES";

export type FoodSearchResult = SaveFoodItemInput & {
  key: string;
  localId: number | null;
  localFood: DBFoodItem | null;
  /** Whether the signed-in user created this recipe or custom meal. Server-decided. */
  isOwn?: boolean;
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
  onLocalResults?: (results: FoodSearchResult[]) => void;
  rankOptions?: RankFoodSearchOptions;
  /** @deprecated The backend decides when to consult external providers. */
  includeRemote?: boolean;
  /** @deprecated The backend applies its own minimum query length. */
  remoteMinQueryLength?: number;
  /** @deprecated The backend controls upstream page size. */
  remotePageSize?: number;
  /** @deprecated External failures now degrade server-side, not client-side. */
  onRemoteSearchError?: () => void;
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
  isOwn = false,
): FoodSearchResult => ({
  isOwn,
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
    isOwn,
    ...saveInput
  } = food;

  // `isOwn` is passed explicitly rather than riding along in the spread: it is
  // not part of `SaveFoodItemInput` (a client does not get to assert ownership),
  // so relying on it surviving a rest-spread would be a runtime-only guarantee.
  return toSearchFoodResult(saveInput, id, includeLocalFood ? food : null, isOwn);
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

const isExactLocalSearchMatch = (food: FoodSearchResult, query: string) => {
  if (food.localId == null) {
    return false;
  }

  const queryVariants = getSearchVariants(query);
  const compactQueryVariants = queryVariants.map(compactSearchText);
  const normalizedName = normalizeSearchText(food.name);
  const normalizedCombined = normalizeSearchText(
    `${food.brand ?? ""} ${food.name}`,
  );
  const compactName = compactSearchText(food.name);
  const compactCombined = compactSearchText(`${food.brand ?? ""} ${food.name}`);

  return (
    queryVariants.some(
      (variant) => normalizedName === variant || normalizedCombined === variant,
    ) ||
    compactQueryVariants.some(
      (variant) =>
        variant.length > 0 &&
        (compactName === variant || compactCombined === variant),
    )
  );
};

export const rankSearchResults = (
  query: string,
  results: FoodSearchResult[],
  options: RankFoodSearchOptions = {},
) => {
  const sorted = [...results].sort((left, right) => {
    const exactLocalDifference =
      Number(isExactLocalSearchMatch(right, query)) -
      Number(isExactLocalSearchMatch(left, query));

    if (exactLocalDifference !== 0) {
      return exactLocalDifference;
    }

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
  onLocalResults,
  rankOptions,
}: SearchFoodResultsInput) => {
  const trimmedQuery = query.trim();

  // `getLocalRows` now resolves through DB.searchFoodItems, which the Nouri API
  // serves. The backend already merges the shared catalogue, the user's own and
  // public recipes/meals and USDA, and ranks them with the same heuristics that
  // used to run here. There is no second remote call to make.
  //
  // Ranking is still applied locally so screen-specific `rankOptions`
  // (category priority, dedupe rules) keep working on top of the server order.
  const localRows = await getLocalRows(trimmedQuery);
  const results = localRows
    .filter((food) => filterLocalRow?.(food) ?? true)
    .map((food) => fromDbFoodItem(food, includeLocalFood));

  const ranked = rankSearchResults(trimmedQuery, results, rankOptions);
  onLocalResults?.(ranked);
  return ranked;
};
