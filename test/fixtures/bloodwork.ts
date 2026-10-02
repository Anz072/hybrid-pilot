import type { ApiBiomarker,ApiBloodworkPanel,CreateBloodworkPanelInput } from "../../src/API/nouri/bloodworkTypes";
export const biomarker: ApiBiomarker = {
  id: "b0000000-0000-4000-8000-000000000001",slug: "testosterone-total",name: "Testosterone, total",category: "Hormones",
  canonicalUnit: "nmol/L",preferredDisplayUnit: "nmol/L",active: true,explanation: "Unit conversion only.",
  units: [{ unit: "nmol/L",multiplier: "1",offset: "0",divisor: "1" },{ unit: "ng/dL",multiplier: "0.0347",offset: "0",divisor: "1" }],
  sources: [{ title: "Mayo SI units",url: "https://www.mayocliniclabs.com/order-tests/si-unit-conversion.html",accessedOn: "2026-09-10" }],
};
export const bloodworkInput: CreateBloodworkPanelInput = {
  id: "d1000000-0000-4000-8000-000000000001",collectedOn: "2026-09-08",labName: "Lab",
  results: [{ biomarkerId: biomarker.id,rawValue: "530.000000000001",rawUnit: "ng/dL",referenceLow: "0",referenceHigh: "900.00",referenceUnit: "ng/dL" }],
};
export const bloodworkPanel: ApiBloodworkPanel = {
  id: bloodworkInput.id,collectedOn: bloodworkInput.collectedOn,labName: "Lab",revision: 1,resultCount: 1,
  createdAt: "2026-09-10T00:00:00.000Z",updatedAt: "2026-09-10T00:00:00.000Z",
  results: [{ ...bloodworkInput.results[0]!,name: biomarker.name,canonicalValue: "18.3910000000000347",canonicalUnit: "nmol/L",
    display: { value: "18.3910000000000347",unit: "nmol/L",referenceLow: "0",referenceHigh: "31.23" } }],
};
