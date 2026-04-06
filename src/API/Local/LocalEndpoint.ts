import { DB } from "../../store/DB";

class LocalFoodAPI {
  constructor() {}

  public testMockCall = async () => {
    return true;
  };

  public checkDBForFoodItemByBarcode = async (code: string) => {
    try {
      const result = await DB.getFoodItemByBarcode(code);
      if (!result) return { found: false, data: null };
      return { found: true, data: result };
    } catch {
        console.error("[LocalFoodAPI] checkDBForFoodItemByBarcode: FAILED TO LOOK UP LOCAL DB")
    }
  };
}

export const localFoodAPI = new LocalFoodAPI();
