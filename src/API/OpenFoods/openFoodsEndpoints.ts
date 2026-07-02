import type { AxiosInstance } from "axios";
import { baseApi } from "../axios.client";
import type { SaveFoodItemInput } from "../../store/DB_TYPES";

type NutrientTargetUnit = "g" | "mg" | "ug" | "kcal";

class OpenFoodsAPI {
  openFoodFactsApi: AxiosInstance;
  fields: string[];

  constructor() {
    this.openFoodFactsApi = baseApi.create({
      baseURL: "https://world.openfoodfacts.org/api/v2/product",
    });

    this.fields = [
      "code",
      "product_name",
      "product_name_lt",
      "product_name_en",
      "brands",
      "quantity",
      "product_quantity",
      "product_quantity_unit",
      "nutrition_data_per",
      "ingredients_text",
      "nutriments",
      "image_url",
    ];
  }

  public getByBarcode = async (code: string) => {
    try {
      const res = await this.openFoodFactsApi.get(`${code}`, {
        params: {
          fields: this.fields.join(","),
        },
      });
      const isValid = this.dataValidator(res.data);

      if (isValid) {
        return {
          valid: true,
          data: res.data,
          foodItem: this.toFoodItemInput(res.data),
        };
      }

      return { valid: false, data: res.data, foodItem: null };
    } catch (e) {
      console.error("[OPENFOODS] getByBarcode: Failed to retrieve data");
    }
  };

  public toFoodItemInput = (data: any): SaveFoodItemInput | null => {
    if (!this.dataValidator(data)) {
      return null;
    }

    const product = data?.product;
    this.normalizeProductQuantityFields(product);
    const nutriments = product?.nutriments ?? {};
    const barcode = this.normalizeText(product?.code ?? data?.code);
    const productQuantity = this.firstFinite(product?.product_quantity);
    const nutritionPer = this.normalizeText(
      product?.nutrition_data_per,
    )?.toLowerCase();
    const quantityUnit =
      this.normalizeText(product?.product_quantity_unit) ??
      (nutritionPer?.includes("ml") ? "ml" : "g");
    const nutritionBasis =
      nutritionPer === "100ml"
        ? "100ml"
        : nutritionPer === "100g"
          ? "100g"
          : "serving";
    const servingSizeValue =
      nutritionBasis === "serving" ? (productQuantity ?? 1) : 100;
    const servingSizeUnit =
      nutritionBasis === "100ml"
        ? "ml"
        : nutritionBasis === "100g"
          ? "g"
          : (quantityUnit ?? "serving");
    const suffix =
      nutritionBasis === "serving"
        ? "_serving"
        : nutritionBasis === "100ml"
          ? "_100g"
          : "_100g";
    const nutrientDetails = this.getFoodNutrientDetails(nutriments, suffix);

    return {
      source: "open_food_facts",
      sourceId: barcode,
      barcode,
      name:
        this.normalizeText(product?.product_name_en) ??
        this.normalizeText(product?.product_name_lt) ??
        this.normalizeText(product?.product_name) ??
        "Scanned food",
      brand: this.normalizeText(product?.brands),
      imageUrl: this.normalizeText(product?.image_url),
      quantityValue: productQuantity,
      quantityUnit,
      servingSizeValue,
      servingSizeUnit,
      nutritionBasis,
      calories:
        this.readNutrient(nutriments, suffix, "kcal", "energy-kcal", "energy") ??
        0,
      proteinG: this.readNutrient(nutriments, suffix, "g", "proteins") ?? 0,
      carbsG:
        this.readNutrient(nutriments, suffix, "g", "carbohydrates") ?? 0,
      fatG: this.readNutrient(nutriments, suffix, "g", "fat") ?? 0,
      ...nutrientDetails,
      ingredientsText: this.normalizeText(product?.ingredients_text),
      rawPayload: this.stringifyRawPayload({
        nutriments,
        nutrition_data_per: product?.nutrition_data_per ?? null,
        product_quantity: product?.product_quantity ?? null,
        product_quantity_unit: product?.product_quantity_unit ?? null,
        quantity: product?.quantity ?? null,
      }),
      verified: true,
      isComplete: true,
    };
  };

  private normalizeProductQuantityFields = (product: any) => {
    if (!product || typeof product !== "object") {
      return;
    }

    const parsedNutritionQuantity = this.parseNutritionQuantity(
      this.normalizeText(product?.nutrition_data_per),
    );

    if (!parsedNutritionQuantity) {
      return;
    }

    if (!Number.isFinite(Number(product.product_quantity))) {
      product.product_quantity = parsedNutritionQuantity.value;
    }

    if (!this.normalizeText(product.product_quantity_unit)) {
      product.product_quantity_unit = parsedNutritionQuantity.unit;
    }

    if (!this.normalizeText(product.quantity)) {
      product.quantity = `${this.formatQuantityValue(parsedNutritionQuantity.value)}${parsedNutritionQuantity.unit}`;
    }
  };

  private dataValidator = (data: any) => {
    const requiredFields = [
      "product",
      "product.nutriments",
      "product.product_name",
    ];

    const missingFields: string[] = [];

    for (const path of requiredFields) {
      if (!this.hasPath(data, path)) {
        missingFields.push(path);
      }
    }

    if (missingFields.length > 0) return false;
    return true;
  };

  private hasPath = (obj: any, path: string): boolean => {
    return path.split(".").every((key) => {
      if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
        obj = obj[key];
        return true;
      }
      return false;
    });
  };

  private normalizeText = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  };

  private firstFinite = (...values: unknown[]): number | null => {
    for (const value of values) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return null;
  };

  private getFoodNutrientDetails = (
    nutriments: Record<string, unknown>,
    suffix: string,
  ) => {
    const fatSaturatedG = this.readNutrient(
      nutriments,
      suffix,
      "g",
      "saturated-fat",
    );
    const alphaLinolenicAcidG = this.readNutrient(
      nutriments,
      suffix,
      "g",
      "alpha-linolenic-acid",
      "ala",
    );

    return {
      fiberG: this.readNutrient(nutriments, suffix, "g", "fiber"),
      sugarG: this.readNutrient(nutriments, suffix, "g", "sugars"),
      addedSugarsG: this.readNutrient(nutriments, suffix, "g", "added-sugars"),
      waterG: this.readNutrient(nutriments, suffix, "g", "water"),
      alcoholG: this.readNutrient(nutriments, suffix, "g", "alcohol"),
      saltG: this.readNutrient(nutriments, suffix, "g", "salt"),
      fatSaturatedG,
      fatMonounsaturatedG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "monounsaturated-fat",
      ),
      fatPolyunsaturatedG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "polyunsaturated-fat",
      ),
      fatTransG: this.readNutrient(nutriments, suffix, "g", "trans-fat"),
      omega3G: this.readNutrient(nutriments, suffix, "g", "omega-3-fat"),
      omega6G: this.readNutrient(nutriments, suffix, "g", "omega-6-fat"),
      epaG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "eicosapentaenoic-acid",
        "epa",
      ),
      dhaG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "docosahexaenoic-acid",
        "dha",
      ),
      alaG: alphaLinolenicAcidG,
      linoleicAcidG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "linoleic-acid",
      ),
      alphaLinolenicAcidG,
      cholesterolMg: this.readNutrient(nutriments, suffix, "mg", "cholesterol"),
      vitaminAUg: this.readNutrient(nutriments, suffix, "ug", "vitamin-a"),
      vitaminCMg: this.readNutrient(nutriments, suffix, "mg", "vitamin-c"),
      vitaminDUg: this.readNutrient(nutriments, suffix, "ug", "vitamin-d"),
      vitaminEMg: this.readNutrient(nutriments, suffix, "mg", "vitamin-e"),
      vitaminKUg: this.readNutrient(nutriments, suffix, "ug", "vitamin-k"),
      vitaminK1Ug: this.readNutrient(nutriments, suffix, "ug", "vitamin-k1"),
      vitaminK2Ug: this.readNutrient(nutriments, suffix, "ug", "vitamin-k2"),
      thiaminB1Mg: this.readNutrient(
        nutriments,
        suffix,
        "mg",
        "vitamin-b1",
        "thiamin",
        "thiamine",
      ),
      riboflavinB2Mg: this.readNutrient(
        nutriments,
        suffix,
        "mg",
        "vitamin-b2",
        "riboflavin",
      ),
      niacinB3Mg: this.readNutrient(
        nutriments,
        suffix,
        "mg",
        "vitamin-pp",
        "vitamin-b3",
        "niacin",
      ),
      pantothenicAcidB5Mg: this.readNutrient(
        nutriments,
        suffix,
        "mg",
        "pantothenic-acid",
        "vitamin-b5",
      ),
      vitaminB6Mg: this.readNutrient(nutriments, suffix, "mg", "vitamin-b6"),
      biotinB7Ug: this.readNutrient(
        nutriments,
        suffix,
        "ug",
        "biotin",
        "vitamin-b7",
      ),
      folateB9Ug: this.readNutrient(
        nutriments,
        suffix,
        "ug",
        "folates",
        "folate",
        "vitamin-b9",
      ),
      vitaminB12Ug: this.readNutrient(nutriments, suffix, "ug", "vitamin-b12"),
      cholineMg: this.readNutrient(nutriments, suffix, "mg", "choline"),
      calciumMg: this.readNutrient(nutriments, suffix, "mg", "calcium"),
      ironMg: this.readNutrient(nutriments, suffix, "mg", "iron"),
      magnesiumMg: this.readNutrient(nutriments, suffix, "mg", "magnesium"),
      phosphorusMg: this.readNutrient(nutriments, suffix, "mg", "phosphorus"),
      potassiumMg: this.readNutrient(nutriments, suffix, "mg", "potassium"),
      sodiumMg: this.readNutrient(nutriments, suffix, "mg", "sodium"),
      zincMg: this.readNutrient(nutriments, suffix, "mg", "zinc"),
      copperMg: this.readNutrient(nutriments, suffix, "mg", "copper"),
      manganeseMg: this.readNutrient(nutriments, suffix, "mg", "manganese"),
      seleniumUg: this.readNutrient(nutriments, suffix, "ug", "selenium"),
      iodineUg: this.readNutrient(nutriments, suffix, "ug", "iodine"),
      chromiumUg: this.readNutrient(nutriments, suffix, "ug", "chromium"),
      molybdenumUg: this.readNutrient(nutriments, suffix, "ug", "molybdenum"),
      histidineG: this.readNutrient(nutriments, suffix, "g", "histidine"),
      isoleucineG: this.readNutrient(nutriments, suffix, "g", "isoleucine"),
      leucineG: this.readNutrient(nutriments, suffix, "g", "leucine"),
      lysineG: this.readNutrient(nutriments, suffix, "g", "lysine"),
      methionineG: this.readNutrient(nutriments, suffix, "g", "methionine"),
      phenylalanineG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "phenylalanine",
      ),
      threonineG: this.readNutrient(nutriments, suffix, "g", "threonine"),
      tryptophanG: this.readNutrient(nutriments, suffix, "g", "tryptophan"),
      valineG: this.readNutrient(nutriments, suffix, "g", "valine"),
      alanineG: this.readNutrient(nutriments, suffix, "g", "alanine"),
      arginineG: this.readNutrient(nutriments, suffix, "g", "arginine"),
      asparticAcidG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "aspartic-acid",
      ),
      cysteineG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "cysteine",
        "cystine",
      ),
      glutamicAcidG: this.readNutrient(
        nutriments,
        suffix,
        "g",
        "glutamic-acid",
      ),
      glycineG: this.readNutrient(nutriments, suffix, "g", "glycine"),
      prolineG: this.readNutrient(nutriments, suffix, "g", "proline"),
      serineG: this.readNutrient(nutriments, suffix, "g", "serine"),
      tyrosineG: this.readNutrient(nutriments, suffix, "g", "tyrosine"),
      caffeineMg: this.readNutrient(nutriments, suffix, "mg", "caffeine"),
      betaineMg: this.readNutrient(nutriments, suffix, "mg", "betaine"),
      luteinZeaxanthinUg: this.readNutrient(
        nutriments,
        suffix,
        "ug",
        "lutein-zeaxanthin",
      ),
    };
  };

  private readNutrient = (
    nutriments: Record<string, unknown>,
    suffix: string,
    targetUnit: NutrientTargetUnit,
    ...keys: string[]
  ): number | null => {
    for (const key of keys) {
      const numeric = this.firstFinite(
        nutriments[`${key}${suffix}`],
        suffix === "_100g" ? null : nutriments[`${key}_100g`],
        nutriments[key],
      );

      if (numeric == null) {
        continue;
      }

      return this.convertNutrientUnit(
        numeric,
        this.normalizeText(nutriments[`${key}_unit`]),
        targetUnit,
      );
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
              normalizedSourceUnit === "mcg" ||
              normalizedSourceUnit === "microgram"
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

  private stringifyRawPayload = (payload: unknown): string | null => {
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  };

  private parseNutritionQuantity = (
    value: string | null,
  ): { value: number; unit: string } | null => {
    if (!value) {
      return null;
    }

    const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|ml)$/i);
    if (!match) {
      return null;
    }

    const parsedValue = Number(match[1].replace(",", "."));
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return null;
    }

    return {
      value: parsedValue,
      unit: match[2].toLowerCase(),
    };
  };

  private formatQuantityValue = (value: number) => {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/\.?0+$/, "");
  };
}

export const openFoodsAPI = new OpenFoodsAPI();
