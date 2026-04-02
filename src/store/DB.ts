import { getFirstUser, upsertUser } from "./userRepository";
import { addWeightLog, getRecentWeightLogs } from "./weightRepository";

export * from "./DB_TYPES";

export const DB = {
  getRecentWeightLogs: getRecentWeightLogs,
  addWeightLog: addWeightLog,
  getUser: getFirstUser,
  addUser: upsertUser,
};
