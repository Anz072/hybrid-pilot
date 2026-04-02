import { addWeightLog, getRecentWeightLogs } from "./weightRepository";
import { getFirstUser, upsertUser } from "./userRepository";
import {
  addFoodItem,
  getFavoriteFoodItems,
  getRecentFoodItems,
  searchFoodItems,
  setFoodItemFavorite,
} from "./foodRepository";
import {
  addCustomMeal,
  addUserFoodLog,
  copyFoodLogsFromDate,
  deleteCustomMeal,
  deleteUserFoodLog,
  getCustomMeals,
  getUserFoodLogEntriesByDate,
  getUserFoodLogEntryById,
  updateUserFoodLog,
} from "./foodLogRepository";

export const DB = {
  addUser: upsertUser,
  getUser: getFirstUser,
  addWeightLog,
  getRecentWeightLogs,
  addFoodItem,
  searchFoodItems,
  getFavoriteFoodItems,
  getRecentFoodItems,
  setFoodItemFavorite,
  addUserFoodLog,
  updateUserFoodLog,
  deleteUserFoodLog,
  getUserFoodLogEntryById,
  getUserFoodLogEntriesByDate,
  copyFoodLogsFromDate,
  getCustomMeals,
  addCustomMeal,
  deleteCustomMeal,
};
