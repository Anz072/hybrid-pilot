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
  saveUserSettings as saveUserSettingsBase,
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
  saveDiaryDayStatus as saveDiaryDayStatusBase,
  updateQuickAddFoodLog as updateQuickAddFoodLogBase,
  updateUserFoodLog as updateUserFoodLogBase,
} from "./diaryStore";
import { getFoodItemByBarcode, searchFoodItems } from "./foodSearchStore";
import { notifyAppDataChanged } from "./dataChangeEvents";
import * as protocols from "./protocolsStore";
import * as bloodwork from "./bloodworkStore";
import { assertAuthSessionGeneration, getAuthSessionGeneration } from "../API/supabase/sessionScope";

const protocolMutation = <A extends unknown[], T>(write: (userId: string, ...args: A) => Promise<T>,kind: "protocols" | "bloodwork" = "protocols") =>
  async (userId: string, ...args: A): Promise<T> => {
    const session = getAuthSessionGeneration();
    const result = await write(userId, ...args);
    assertAuthSessionGeneration(session);
    notifyAppDataChanged({ kind, userExternalId: userId });
    return result;
  };

const saveUserSettings = async (input: Parameters<typeof saveUserSettingsBase>[0]) => {
  const session = getAuthSessionGeneration();
  const result = await saveUserSettingsBase(input);
  assertAuthSessionGeneration(session);
  if (result) {
    if (input.protocolsEnabled !== undefined || input.protocolsIntroSeenAt !== undefined) protocols.invalidateProtocolReads();
    notifyAppDataChanged({ kind: "settings", userExternalId: input.userExternalId });
  }
  return result;
};

const deleteAllProtocolData = async (userId: string) => {
  const session = getAuthSessionGeneration();
  const result = await protocols.deleteAllProtocolData(userId);
  assertAuthSessionGeneration(session);
  // All feature screens observe settings too; one event also refreshes Home's
  // visibility after the server atomically resets opt-in and intro state.
  notifyAppDataChanged({ kind: "settings", userExternalId: userId });
  return result;
};

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
  protocols.invalidateProtocolMetricReads();
  notifyAppDataChanged({
    kind: "food_log",
    userExternalId: input?.userExternalId,
    date: input?.date,
    foodEntryId: input?.foodEntryId,
  });
};

const notifyWeightChanged = (userExternalId?: string | null) => {
  protocols.invalidateProtocolMetricReads();
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

const saveDiaryDayStatus = async (input: Parameters<typeof saveDiaryDayStatusBase>[0]) => {
  const saved = await saveDiaryDayStatusBase(input);
  notifyFoodLogChanged({ userExternalId: input.userExternalId, date: saved.date });
  return saved;
};

export const DB = {
  getProtocolReminder: protocols.getProtocolReminder,
  createProtocolReminder: protocolMutation(protocols.createProtocolReminder),
  editProtocolReminder: protocolMutation(protocols.editProtocolReminder),
  deleteProtocolReminder: protocolMutation(protocols.deleteProtocolReminder),
  getBloodworkHistory: bloodwork.getBloodworkHistory,
  deleteAllProtocolData,
  getProtocolAnnotations: protocols.getProtocolAnnotations,
  listBiomarkers: bloodwork.listBiomarkers,
  listBloodworkPanels: bloodwork.listBloodworkPanels,
  getBloodworkPanel: bloodwork.getBloodworkPanel,
  createBloodworkPanel: protocolMutation(bloodwork.createBloodworkPanel,"bloodwork"),
  editBloodworkPanel: protocolMutation(bloodwork.editBloodworkPanel,"bloodwork"),
  deleteBloodworkPanel: protocolMutation(bloodwork.deleteBloodworkPanel,"bloodwork"),
  setBiomarkerDisplayUnit: protocolMutation(bloodwork.setBiomarkerDisplayUnit,"bloodwork"),
  listProtocolCompounds: protocols.listProtocolCompounds,
  getProtocolCompound: protocols.getProtocolCompound,
  previewProtocolSchedule: protocols.previewProtocolSchedule,
  previewProtocolTime: protocols.previewProtocolTime,
  listProtocolCourses: protocols.listProtocolCourses,
  getProtocolCourse: protocols.getProtocolCourse,
  createProtocolCourse: protocolMutation(protocols.createProtocolCourse),
  editProtocolDraft: protocolMutation(protocols.editProtocolDraft),
  startProtocolCourse: protocolMutation(protocols.startProtocolCourse),
  changeProtocolPhase: protocolMutation(protocols.changeProtocolPhase),
  endProtocolCourse: protocolMutation(protocols.endProtocolCourse),
  deleteProtocolCourse: protocolMutation(protocols.deleteProtocolCourse),
  getProtocolOccurrence: protocols.getProtocolOccurrence,
  getProtocolLog: protocols.getProtocolLog,
  logProtocolOccurrence: protocolMutation(protocols.logProtocolOccurrence),
  createProtocolManualLog: protocolMutation(protocols.createProtocolManualLog),
  editProtocolLog: protocolMutation(protocols.editProtocolLog),
  deleteProtocolLog: protocolMutation(protocols.deleteProtocolLog),
  listProtocolLogs: protocols.listProtocolLogs,
  getProtocolSites: protocols.getProtocolSites,
  getProtocolDay: protocols.getProtocolDay,
  getProtocolNextDoses: protocols.getProtocolNextDoses,
  getProtocolHome: protocols.getProtocolHome,
  getProtocolCalendar: protocols.getProtocolCalendar,
  getProtocolLevels: protocols.getProtocolLevels,
  getProtocolTrends: protocols.getProtocolTrends,
  compareProtocolLevels: protocols.compareProtocolLevels,
  previewProtocolLevels: protocols.previewProtocolLevels,
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
