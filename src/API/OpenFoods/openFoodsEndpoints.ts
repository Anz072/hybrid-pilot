import type { AxiosInstance } from "axios";
import { baseApi } from "../axios.client";
import type { SaveFoodItemInput } from "../../store/DB_TYPES";

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
      console.log("received code: ", code);
      const res = await this.openFoodFactsApi.get(`${code}`, {
        params: {
          fields: this.fields.join(","),
        },
      });
      const isValid = this.dataValidator(res.data);

      console.log("res.data");
      console.log(JSON.stringify(res.data, null, 2));

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
        this.firstFinite(
          nutriments[`energy-kcal${suffix}`],
          nutriments["energy-kcal"],
          nutriments["energy"],
        ) ?? 0,
      proteinG:
        this.firstFinite(
          nutriments[`proteins${suffix}`],
          nutriments.proteins,
        ) ?? 0,
      carbsG:
        this.firstFinite(
          nutriments[`carbohydrates${suffix}`],
          nutriments.carbohydrates,
        ) ?? 0,
      fatG: this.firstFinite(nutriments[`fat${suffix}`], nutriments.fat) ?? 0,
      fiberG:
        this.firstFinite(nutriments[`fiber${suffix}`], nutriments.fiber) ??
        null,
      sugarG:
        this.firstFinite(nutriments[`sugars${suffix}`], nutriments.sugars) ??
        null,
      saltG:
        this.firstFinite(nutriments[`salt${suffix}`], nutriments.salt) ?? null,
      saturatedFatG:
        this.firstFinite(
          nutriments[`saturated-fat${suffix}`],
          nutriments["saturated-fat"],
        ) ?? null,
      ingredientsText: this.normalizeText(product?.ingredients_text),
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

    // console.log(JSON.stringify(data, null, 2));
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
