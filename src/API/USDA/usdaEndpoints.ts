import type { AxiosInstance } from "axios";
import { baseApi } from "../axios.client";
import type { SaveFoodItemInput } from "../../store/DB_TYPES";

type NutrientTargetUnit = "g" | "mg" | "ug" | "kcal";

type USDAFoodNutrient = {
  nutrientNumber?: number | string | null;
  nutrientName?: string | null;
  unitName?: string | null;
  value?: number | null;
};

type USDAFoodMeasure = {
  disseminationText?: string | null;
  gramWeight?: number | null;
  rank?: number | null;
};

type USDAFoodSearchItem = {
  fdcId: number;
  description?: string | null;
  dataType?: string | null;
  foodCategory?: string | null;
  gtinUpc?: number | string | null;
  brandOwner?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  householdServingFullText?: string | null;
  foodMeasures?: USDAFoodMeasure[] | null;
  foodNutrients?: USDAFoodNutrient[] | null;
};

type USDAFoodSearchResponse = {
  foods?: USDAFoodSearchItem[] | null;
};

type USDAFoodSearchOptions = {
  pageSize?: number;
};

class USDA_API {
  usdaApi: AxiosInstance;
  dataType: string[];
  apiKey: string;

  constructor() {
    this.usdaApi = baseApi.create({
      baseURL: "https://api.nal.usda.gov/fdc/v1",
    });

    this.apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY ?? "";
    this.dataType = ["Branded", "Foundation", "Survey (FNDDS)", "SR Legacy"];
  }

  public getFood = async (
    foodName: string,
    options: USDAFoodSearchOptions = {},
  ): Promise<SaveFoodItemInput[]> => {
    try {
      const normalizedFoodName = foodName.trim();
      const pageSize = options.pageSize ?? 12;

      if (!normalizedFoodName) {
        return [];
      }

      if (!this.apiKey) {
        return [];
      }

      const call = await this.usdaApi.post(
        `/foods/search`,
        {
          query: normalizedFoodName,
          dataType: this.dataType,
          pageSize,
          pageNumber: 1,
        },
        {
          params: {
            api_key: this.apiKey,
          },
        },
      );

      return this.standartizeFoodItemsToFoodItemType(call.data);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  private standartizeFoodItemsToFoodItemType = (
    response: USDAFoodSearchResponse,
  ): SaveFoodItemInput[] => {
    const foods = Array.isArray(response?.foods) ? response.foods : [];

    return foods
      .map((food) => this.toFoodItemInput(food))
      .filter((foodItem): foodItem is SaveFoodItemInput => foodItem !== null);
  };

  private toFoodItemInput = (
    food: USDAFoodSearchItem,
  ): SaveFoodItemInput | null => {
    const name = this.normalizeText(food.description);
    if (!name) {
      return null;
    }

    const calories = this.readNutrient(food.foodNutrients, "kcal", "208");
    const proteinG = this.readNutrient(food.foodNutrients, "g", "203");
    const carbsG = this.readNutrient(food.foodNutrients, "g", "205");
    const fatG = this.readNutrient(food.foodNutrients, "g", "204");
    const saturatedFatG = this.readNutrient(food.foodNutrients, "g", "606");
    const alphaLinolenicAcidG = this.readNutrient(
      food.foodNutrients,
      "g",
      "851",
      "619",
    );
    const linoleicAcidG = this.readNutrient(food.foodNutrients, "g", "618");
    const epaG = this.readNutrient(food.foodNutrients, "g", "629");
    const dhaG = this.readNutrient(food.foodNutrients, "g", "621");
    const sodiumMg = this.readNutrient(food.foodNutrients, "mg", "307");
    const vitaminKUg = this.readNutrient(food.foodNutrients, "ug", "430");
    const omega3Values = [alphaLinolenicAcidG, epaG, dhaG].filter(
      (value): value is number => value != null,
    );
    const omega3G =
      omega3Values.length > 0
        ? omega3Values.reduce((sum, value) => sum + value, 0)
        : null;

    const rawPayload = this.stringifyRawPayload({
      dataType: food.dataType ?? null,
      foodCategory: food.foodCategory ?? null,
      householdServingFullText: food.householdServingFullText ?? null,
      foodMeasures: food.foodMeasures ?? [],
      foodNutrients: food.foodNutrients ?? [],
    });

    return {
      source: "usda",
      sourceId: String(food.fdcId),
      barcode: this.toNullableString(food.gtinUpc),
      name,
      brand: this.normalizeText(food.brandOwner),
      imageUrl: null,
      quantityValue: null,
      quantityUnit: null,
      servingSizeValue: 100,
      servingSizeUnit: "g",
      nutritionBasis: "100g",
      calories,
      proteinG,
      carbsG,
      fatG,
      fiberG: this.readNutrient(food.foodNutrients, "g", "291"),
      sugarG: this.readNutrient(food.foodNutrients, "g", "269"),
      addedSugarsG: null,
      waterG: this.readNutrient(food.foodNutrients, "g", "255"),
      alcoholG: this.readNutrient(food.foodNutrients, "g", "221"),
      saltG:
        sodiumMg != null ? Number(((sodiumMg * 2.5) / 1000).toFixed(3)) : null,
      saturatedFatG,
      fatSaturatedG: saturatedFatG,
      fatMonounsaturatedG: this.readNutrient(food.foodNutrients, "g", "645"),
      fatPolyunsaturatedG: this.readNutrient(food.foodNutrients, "g", "646"),
      fatTransG: this.readNutrient(food.foodNutrients, "g", "605"),
      omega3G,
      omega6G: linoleicAcidG,
      epaG,
      dhaG,
      alaG: alphaLinolenicAcidG,
      linoleicAcidG,
      alphaLinolenicAcidG,
      cholesterolMg: this.readNutrient(food.foodNutrients, "mg", "601"),
      vitaminAUg: this.readNutrient(food.foodNutrients, "ug", "320"),
      vitaminCMg: this.readNutrient(food.foodNutrients, "mg", "401"),
      vitaminDUg: this.readNutrient(food.foodNutrients, "ug", "328"),
      vitaminEMg: this.readNutrient(food.foodNutrients, "mg", "323"),
      vitaminKUg,
      vitaminK1Ug: vitaminKUg,
      vitaminK2Ug: null,
      thiaminB1Mg: this.readNutrient(food.foodNutrients, "mg", "404"),
      riboflavinB2Mg: this.readNutrient(food.foodNutrients, "mg", "405"),
      niacinB3Mg: this.readNutrient(food.foodNutrients, "mg", "406"),
      pantothenicAcidB5Mg: this.readNutrient(food.foodNutrients, "mg", "410"),
      vitaminB6Mg: this.readNutrient(food.foodNutrients, "mg", "415"),
      biotinB7Ug: this.readNutrient(food.foodNutrients, "ug", "416"),
      folateB9Ug: this.readNutrient(food.foodNutrients, "ug", "435", "417", "432"),
      vitaminB12Ug: this.readNutrient(food.foodNutrients, "ug", "418"),
      cholineMg: this.readNutrient(food.foodNutrients, "mg", "421"),
      calciumMg: this.readNutrient(food.foodNutrients, "mg", "301"),
      ironMg: this.readNutrient(food.foodNutrients, "mg", "303"),
      magnesiumMg: this.readNutrient(food.foodNutrients, "mg", "304"),
      phosphorusMg: this.readNutrient(food.foodNutrients, "mg", "305"),
      potassiumMg: this.readNutrient(food.foodNutrients, "mg", "306"),
      sodiumMg,
      zincMg: this.readNutrient(food.foodNutrients, "mg", "309"),
      copperMg: this.readNutrient(food.foodNutrients, "mg", "312"),
      manganeseMg: this.readNutrient(food.foodNutrients, "mg", "315"),
      seleniumUg: this.readNutrient(food.foodNutrients, "ug", "317"),
      iodineUg: null,
      chromiumUg: null,
      molybdenumUg: null,
      histidineG: this.readNutrient(food.foodNutrients, "g", "512"),
      isoleucineG: this.readNutrient(food.foodNutrients, "g", "503"),
      leucineG: this.readNutrient(food.foodNutrients, "g", "504"),
      lysineG: this.readNutrient(food.foodNutrients, "g", "505"),
      methionineG: this.readNutrient(food.foodNutrients, "g", "506"),
      phenylalanineG: this.readNutrient(food.foodNutrients, "g", "508"),
      threonineG: this.readNutrient(food.foodNutrients, "g", "502"),
      tryptophanG: this.readNutrient(food.foodNutrients, "g", "501"),
      valineG: this.readNutrient(food.foodNutrients, "g", "510"),
      alanineG: this.readNutrient(food.foodNutrients, "g", "513"),
      arginineG: this.readNutrient(food.foodNutrients, "g", "511"),
      asparticAcidG: this.readNutrient(food.foodNutrients, "g", "514"),
      cysteineG: this.readNutrient(food.foodNutrients, "g", "507"),
      glutamicAcidG: this.readNutrient(food.foodNutrients, "g", "515"),
      glycineG: this.readNutrient(food.foodNutrients, "g", "516"),
      prolineG: this.readNutrient(food.foodNutrients, "g", "517"),
      serineG: this.readNutrient(food.foodNutrients, "g", "518"),
      tyrosineG: this.readNutrient(food.foodNutrients, "g", "509"),
      caffeineMg: this.readNutrient(food.foodNutrients, "mg", "262"),
      betaineMg: this.readNutrient(food.foodNutrients, "mg", "454"),
      luteinZeaxanthinUg: this.readNutrient(food.foodNutrients, "ug", "338"),
      ingredientsText: null,
      rawPayload,
      verified: true,
      isComplete:
        calories != null &&
        proteinG != null &&
        carbsG != null &&
        fatG != null,
    };
  };

  private readNutrient = (
    nutrients: USDAFoodNutrient[] | null | undefined,
    targetUnit: NutrientTargetUnit,
    ...selectors: string[]
  ): number | null => {
    if (!Array.isArray(nutrients) || selectors.length === 0) {
      return null;
    }

    const normalizedSelectors = selectors.map((selector) =>
      selector.trim().toLowerCase(),
    );

    for (const selector of normalizedSelectors) {
      const match = nutrients.find((nutrient) => {
        const nutrientNumber = String(nutrient.nutrientNumber ?? "")
          .trim()
          .toLowerCase();
        const nutrientName = this.normalizeText(nutrient.nutrientName)
          ?.toLowerCase();

        return nutrientNumber === selector || nutrientName === selector;
      });

      const value = Number(match?.value);
      if (!match || !Number.isFinite(value)) {
        continue;
      }

      return this.convertNutrientUnit(value, match.unitName ?? null, targetUnit);
    }

    return null;
  };

  private convertNutrientUnit = (
    value: number,
    sourceUnit: string | null,
    targetUnit: NutrientTargetUnit,
  ): number => {
    const normalizedSourceUnit = sourceUnit
      ?.trim()
      .toLowerCase()
      .replace(/\u00b5|\u03bc/g, "u");

    if (!normalizedSourceUnit || normalizedSourceUnit === targetUnit) {
      return value;
    }

    if (targetUnit === "kcal") {
      return normalizedSourceUnit === "kj" ? value / 4.184 : value;
    }

    const grams =
      normalizedSourceUnit === "g"
        ? value
        : normalizedSourceUnit === "mg"
          ? value / 1000
          : normalizedSourceUnit === "ug" ||
              normalizedSourceUnit === "mcg"
            ? value / 1000000
            : null;

    if (grams == null) {
      return value;
    }

    if (targetUnit === "g") {
      return grams;
    }

    if (targetUnit === "mg") {
      return grams * 1000;
    }

    return grams * 1000000;
  };

  private normalizeText = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  };

  private toNullableString = (value: unknown): string | null => {
    if (value == null) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
  };

  private stringifyRawPayload = (payload: unknown): string | null => {
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  };
}

export const usdaAPI = new USDA_API();
