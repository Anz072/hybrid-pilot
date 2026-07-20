export type SupportedBarcodeType =
  | "ean13"
  | "ean8"
  | "upc_a"
  | "upc_e"
  | "itf14";

const onlyDigits = (value: string): string => value.replace(/\D/g, "");

const computeGtinCheckDigit = (digits: string): number => {
  const sum = digits
    .split("")
    .reverse()
    .map(Number)
    .reduce((acc, digit, index) => {
      return acc + digit * (index % 2 === 0 ? 3 : 1);
    }, 0);

  return (10 - (sum % 10)) % 10;
};

const isValidGtin = (code: string, length: number): boolean => {
  const normalized = onlyDigits(code);
  if (normalized.length !== length) return false;

  const body = normalized.slice(0, -1);
  const checkDigit = Number(normalized[normalized.length - 1]);

  return computeGtinCheckDigit(body) === checkDigit;
};

const isValidEAN13 = (code: string): boolean => {
  return isValidGtin(code, 13);
};

const isValidEAN8 = (code: string): boolean => {
  return isValidGtin(code, 8);
};

const isValidUPCA = (code: string): boolean => {
  return isValidGtin(code, 12);
};

const isValidGTIN14 = (code: string): boolean => {
  return isValidGtin(code, 14);
};

const expandUPCEToUPCA = (code: string): string | null => {
  const normalized = onlyDigits(code);
  if (!/^\d{8}$/.test(normalized)) return null;

  const numberSystem = normalized[0];
  const manufacturerAndProduct = normalized.slice(1, 7);
  const checkDigit = normalized[7];

  const d1 = manufacturerAndProduct[0];
  const d2 = manufacturerAndProduct[1];
  const d3 = manufacturerAndProduct[2];
  const d4 = manufacturerAndProduct[3];
  const d5 = manufacturerAndProduct[4];
  const d6 = manufacturerAndProduct[5];

  let upcaBody = "";

  switch (d6) {
    case "0":
    case "1":
    case "2":
      upcaBody = `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case "3":
      upcaBody = `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case "4":
      upcaBody = `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      upcaBody = `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
      break;
  }

  return `${upcaBody}${checkDigit}`;
};

const isValidUPCE = (code: string): boolean => {
  const expanded = expandUPCEToUPCA(code);
  if (!expanded) {
    return false;
  }

  return isValidUPCA(expanded);
};

export const validateBarcode = (
  code: string,
  type?: SupportedBarcodeType | string | null,
): boolean => {
  const normalized = onlyDigits(code);

  switch (type) {
    case "ean13":
      return isValidEAN13(normalized);
    case "ean8":
      return isValidEAN8(normalized);
    case "upc_a":
      return isValidUPCA(normalized);
    case "upc_e":
      return isValidUPCE(normalized);
    case "itf14":
      return isValidGTIN14(normalized);
    default:
      if (normalized.length === 14) return isValidGTIN14(normalized);
      if (normalized.length === 13) return isValidEAN13(normalized);
      if (normalized.length === 12) return isValidUPCA(normalized);
      if (normalized.length === 8) {
        return isValidEAN8(normalized) || isValidUPCE(normalized);
      }
      return false;
  }
};

export const normalizeBarcodeValue = (value?: string | null): string | null => {
  const normalized = value ? onlyDigits(value) : "";
  return normalized ? normalized : null;
};
