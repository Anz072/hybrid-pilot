import { apiRequest } from "./client";
import type * as T from "./bloodworkTypes";
const path = (id: string) => `/v1/bloodwork/${encodeURIComponent(id)}`;
export const getBloodworkHistory = (userId: string,id: string,query: T.BloodworkHistoryQuery = {}): Promise<T.ApiBloodworkHistory> =>
  apiRequest(`/v1/bloodwork/biomarkers/${encodeURIComponent(id)}/results`,{ query,expectedUserId: userId });
export const listBiomarkers = (userId: string): Promise<{ biomarkers: T.ApiBiomarker[] }> =>
  apiRequest("/v1/biomarkers",{ expectedUserId: userId });
export const listBloodworkPanels = (userId: string,query: T.BloodworkPageQuery = {}): Promise<T.ApiBloodworkPage> =>
  apiRequest("/v1/bloodwork",{ query,expectedUserId: userId });
export const getBloodworkPanel = (userId: string,id: string): Promise<T.ApiBloodworkPanel> =>
  apiRequest(path(id),{ expectedUserId: userId });
export const createBloodworkPanel = (userId: string,body: T.CreateBloodworkPanelInput): Promise<T.ApiBloodworkPanel> =>
  apiRequest("/v1/bloodwork",{ method: "POST",body,expectedUserId: userId });
export const editBloodworkPanel = (userId: string,id: string,body: T.EditBloodworkPanelInput): Promise<T.ApiBloodworkPanel> =>
  apiRequest(path(id),{ method: "PATCH",body,expectedUserId: userId });
export const deleteBloodworkPanel = (userId: string,id: string,expectedRevision: number): Promise<{ deleted: true }> =>
  apiRequest(path(id),{ method: "DELETE",query: { expectedRevision },expectedUserId: userId });
export const setBiomarkerDisplayUnit = (userId: string,id: string,displayUnit: string): Promise<{ biomarkerId: string; displayUnit: string }> =>
  apiRequest(`/v1/bloodwork/preferences/${encodeURIComponent(id)}`,{ method: "PUT",body: { displayUnit },expectedUserId: userId });
