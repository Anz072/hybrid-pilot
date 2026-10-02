/** Provider contract: nouri-api/src/modules/bloodwork/schemas.ts. Numeric raw
 * values remain strings; native rendering may approximate only chart geometry.
 */
export type ApiBiomarker = {
  id: string; slug: string; name: string; category: string; canonicalUnit: string;
  units: Array<{ unit: string; multiplier: string; offset: string; divisor: string }>;
  sources: Array<{ title: string; url: string; accessedOn: string }>;
  explanation: string; active: boolean; preferredDisplayUnit: string;
};
export type BloodworkResultInput = {
  biomarkerId: string; rawValue: string; rawUnit: string;
  referenceLow: string | null; referenceHigh: string | null; referenceUnit: string | null;
};
export type ApiBloodworkResult = BloodworkResultInput & {
  name: string; canonicalValue: string; canonicalUnit: string;
  display: { value: string; unit: string; referenceLow: string | null; referenceHigh: string | null };
};
export type ApiBloodworkPanelSummary = {
  id: string; collectedOn: string; labName: string | null; revision: number; resultCount: number;
  createdAt: string; updatedAt: string;
};
export type ApiBloodworkPanel = ApiBloodworkPanelSummary & { results: ApiBloodworkResult[] };
export type CreateBloodworkPanelInput = { id: string; collectedOn: string; labName: string | null; results: BloodworkResultInput[] };
export type EditBloodworkPanelInput = { operationId: string; expectedRevision: number; collectedOn?: string; labName?: string | null; results?: BloodworkResultInput[] };
export type BloodworkPageQuery = { start?: string; end?: string; after?: string; limit?: number };
export type ApiBloodworkPage = { panels: ApiBloodworkPanelSummary[]; nextCursor: string | null };
export type BloodworkHistoryQuery = BloodworkPageQuery & { displayUnit?: string };
export type ApiBloodworkHistoryResult = ApiBloodworkResult & { panelId: string; collectedOn: string; labName: string | null };
export type ApiBloodworkHistory = { biomarker: ApiBiomarker; displayUnit: string; results: ApiBloodworkHistoryResult[]; nextCursor: string | null };
