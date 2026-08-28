import { localFoodAPI } from "./Local/LocalEndpoint";

// External nutrition providers (USDA, Open Food Facts) are no longer called from
// the app. They live behind the Nouri backend, which holds their credentials and
// normalizes their responses — see src/API/nouri/foodsApi.ts.
export const API = {
  localFoodAPI,
};
