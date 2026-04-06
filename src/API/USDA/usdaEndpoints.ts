import type { AxiosInstance } from "axios";
import { baseApi } from "../axios.client";

class USDA_API {
  openFoodFactsApi: AxiosInstance;

  constructor() {
    this.openFoodFactsApi = baseApi.create({
      baseURL: "https://xxxxxxxxxxx",
    });
  }

  public testMockCall = async () => {
    return true;
  };
}

export const usdaAPI = new USDA_API();
