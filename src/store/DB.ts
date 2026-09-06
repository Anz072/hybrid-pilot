import {
  clearAllWeightData as clearAllWeightDataBase,
  clearWeightGoal as clearWeightGoalBase,
  createAdaptiveCalorieRecommendation,
  getWeightGoal,
  getLatestAdaptiveCalorieRecommendation,
  listWeightEntries,
  listWeightEntriesBetween,
  listAdaptiveCalorieRecommendations,
  refreshAdaptiveCalories,
  saveWeightEntry as saveWeightEntryBase,
  saveWeightGoal as saveWeightGoalBase,
  softDeleteWeightEntry as softDeleteWeightEntryBase,
  getFirstUser,
  getUserByExternalId,
  getUserSettings,
  saveUserSettings,
  updateAdaptiveCalorieRecommendation,
  upsertUser,
} from "./userStore";
import {
  addFoodItem,
  createUserCustomMeal,
  createUserRecipe,
  deleteFoodItem,
  deleteUserCustomMeal,
  deleteUserRecipe,
  getFavoriteFoodIds,
  getFavoriteFoodItems,
  getFoodItemById,
  getFoodItemsByIds,
  getRecentFoodItems,
  getUserCustomMealFoodById,
  getUserRecipeDetailsById,
  listUserCreatedCustomMealFoods,
  listUserCreatedRecipeFoods,
  listFoodItems,
  saveFoodItem,
  setFoodItemFavorite,
  updateUserCustomMeal,
  updateUserRecipe,
} from "./libraryStore";
import {
  addQuickAddFoodLog as addQuickAddFoodLogBase,
  addUserFoodLog as addUserFoodLogBase,
  copyFoodLogsFromDate,
  deleteUserFoodLog as deleteUserFoodLogBase,
  getDiaryDay,
  getDiaryDayStatus,
  getDiaryRange,
  getUserFoodLogEntriesBetween,
  getUserFoodLogEntriesByDate,
  getUserFoodLogEntryById,
  listDiaryDayStatusesBetween,
  saveDiaryDayStatus,
  updateQuickAddFoodLog as updateQuickAddFoodLogBase,
  updateUserFoodLog as updateUserFoodLogBase,
} from "./diaryStore";
import { getFoodItemByBarcode, searchFoodItems } from "./foodSearchStore";
import { notifyAppDataChanged } from "./dataChangeEvents";

type AddUserFoodLogInput = Parameters<typeof addUserFoodLogBase>[0];
type AddQuickAddFoodLogInput = Parameters<typeof addQuickAddFoodLogBase>[0];
type UpdateUserFoodLogInput = Parameters<typeof updateUserFoodLogBase>[0];
type UpdateQuickAddFoodLogInput = Parameters<
  typeof updateQuickAddFoodLogBase
>[0];
type SaveWeightEntryInput = Parameters<typeof saveWeightEntryBase>[0];
type SoftDeleteWeightEntryInput = Parameters<
  typeof softDeleteWeightEntryBase
>[0];
type SaveWeightGoalInput = Parameters<typeof saveWeightGoalBase>[0];

const notifyFoodLogChanged = (input?: {
  date?: string | null;
  userExternalId?: string | null;
  foodEntryId?: number;
}) => {
  notifyAppDataChanged({
    kind: "food_log",
    userExternalId: input?.userExternalId,
    date: input?.date,
    foodEntryId: input?.foodEntryId,
  });
};

const notifyWeightChanged = (userExternalId?: string | null) => {
  notifyAppDataChanged({
    kind: "weight",
    userExternalId,
  });
};

const addUserFoodLog = async (input: AddUserFoodLogInput) => {
  const result = await addUserFoodLogBase(input);
  notifyFoodLogChanged({
    userExternalId: input.userExternalId,
    date: result.date,
    foodEntryId: result.id,
  });
  return result;
};

const addQuickAddFoodLog = async (input: AddQuickAddFoodLogInput) => {
  const result = await addQuickAddFoodLogBase(input);
  notifyFoodLogChanged({
    userExternalId: input.userExternalId,
    date: result.date,
    foodEntryId: result.id,
  });
  return result.id;
};

// The mutation's own response carries the affected day, so no lookup precedes
// the write.

const updateUserFoodLog = async (input: UpdateUserFoodLogInput) => {
  const date = await updateUserFoodLogBase(input);
  notifyFoodLogChanged({ date, foodEntryId: input.id });
  return date;
};

const updateQuickAddFoodLog = async (input: UpdateQuickAddFoodLogInput) => {
  const date = await updateQuickAddFoodLogBase(input);
  notifyFoodLogChanged({ date, foodEntryId: input.id });
  return date;
};

const deleteUserFoodLog = async (id: number) => {
  const date = await deleteUserFoodLogBase(id);
  notifyFoodLogChanged({ date });
  return date;
};

const copyFoodLogsFromDateWithNotify = async (
  ...args: Parameters<typeof copyFoodLogsFromDate>
) => {
  const [userExternalId, , toDate] = args;
  const result = await copyFoodLogsFromDate(...args);
  notifyFoodLogChanged({
    userExternalId,
    date: toDate,
  });
  return result;
};

const saveWeightEntry = async (input: SaveWeightEntryInput) => {
  const result = await saveWeightEntryBase(input);
  notifyWeightChanged(input.userExternalId);
  return result;
};

const softDeleteWeightEntry = async (input: SoftDeleteWeightEntryInput) => {
  const result = await softDeleteWeightEntryBase(input);
  notifyWeightChanged(input.userExternalId);
  return result;
};

const saveWeightGoal = async (input: SaveWeightGoalInput) => {
  const result = await saveWeightGoalBase(input);
  notifyWeightChanged(input.userExternalId);
  return result;
};

const clearWeightGoal = async (userExternalId: string) => {
  const result = await clearWeightGoalBase(userExternalId);
  notifyWeightChanged(userExternalId);
  return result;
};

const clearAllWeightData = async (userExternalId: string) => {
  const result = await clearAllWeightDataBase(userExternalId);
  notifyWeightChanged(userExternalId);
  return result;
};

export const DB = {
  addUser: upsertUser,
  getUser: getFirstUser,
  getUserByExternalId,
  getUserSettings,
  saveUserSettings,
  listAdaptiveCalorieRecommendations,
  getLatestAdaptiveCalorieRecommendation,
  createAdaptiveCalorieRecommendation,
  refreshAdaptiveCalories,
  updateAdaptiveCalorieRecommendation,
  listWeightEntries,
  listWeightEntriesBetween,
  saveWeightEntry,
  softDeleteWeightEntry,
  clearAllWeightData,
  getWeightGoal,
  saveWeightGoal,
  clearWeightGoal,
  saveFoodItem,
  addFoodItem,
  listFoodItems,
  getFoodItemById,
  getFoodItemsByIds,
  getFoodItemByBarcode,
  deleteFoodItem,
  searchFoodItems,
  getFavoriteFoodIds,
  getFavoriteFoodItems,
  getRecentFoodItems,
  setFoodItemFavorite,
  createUserCustomMeal,
  getUserCustomMealFoodById,
  updateUserCustomMeal,
  deleteUserCustomMeal,
  listUserCreatedCustomMealFoods,
  createUserRecipe,
  getUserRecipeDetailsById,
  updateUserRecipe,
  deleteUserRecipe,
  listUserCreatedRecipeFoods,
  addQuickAddFoodLog,
  addUserFoodLog,
  updateUserFoodLog,
  updateQuickAddFoodLog,
  deleteUserFoodLog,
  getUserFoodLogEntryById,
  getUserFoodLogEntriesByDate,
  getUserFoodLogEntriesBetween,
  getDiaryDayStatus,
  getDiaryDay,
  getDiaryRange,
  listDiaryDayStatusesBetween,
  saveDiaryDayStatus,
  copyFoodLogsFromDate: copyFoodLogsFromDateWithNotify,
};
