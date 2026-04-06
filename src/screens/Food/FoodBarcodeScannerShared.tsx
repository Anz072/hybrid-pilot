import React from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  LayoutRectangle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "phosphor-react-native";
import { DB } from "../../store/DB";
import { API } from "../../API/apiCaller";

export type FoodBarcodeScannerModalProps = {
  visible: boolean;
  onClose: () => void;
};

const SCAN_DEBOUNCE_MS = 1000;

type SupportedBarcodeType = "ean13" | "ean8" | "upc_a" | "upc_e";

const onlyDigits = (value: string): string => value.replace(/\D/g, "");

const computeModulo10CheckDigit = (
  digits: string,
  evenWeight: number,
  oddWeight: number,
): number => {
  const sum = digits
    .split("")
    .map(Number)
    .reduce((acc, digit, index) => {
      return acc + digit * (index % 2 === 0 ? oddWeight : evenWeight);
    }, 0);

  return (10 - (sum % 10)) % 10;
};

const isValidEAN13 = (code: string): boolean => {
  const normalized = onlyDigits(code);
  if (!/^\d{13}$/.test(normalized)) return false;

  const body = normalized.slice(0, 12);
  const checkDigit = Number(normalized[12]);

  return computeModulo10CheckDigit(body, 3, 1) === checkDigit;
};

const isValidEAN8 = (code: string): boolean => {
  const normalized = onlyDigits(code);
  if (!/^\d{8}$/.test(normalized)) return false;

  const body = normalized.slice(0, 7);
  const checkDigit = Number(normalized[7]);

  return computeModulo10CheckDigit(body, 1, 3) === checkDigit;
};

const isValidUPCA = (code: string): boolean => {
  const normalized = onlyDigits(code);
  if (!/^\d{12}$/.test(normalized)) return false;

  const body = normalized.slice(0, 11);
  const checkDigit = Number(normalized[11]);

  return computeModulo10CheckDigit(body, 3, 1) === checkDigit;
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

const validateBarcode = (
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
    default:
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

export const useBarcodeDebugScanner = (visible: boolean) => {
  const [scannedCode, setScannedCode] = React.useState<string | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [locked, setLocked] = React.useState(false);

  const lockRef = React.useRef(false);
  const unlockTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearUnlockTimer = React.useCallback(() => {
    if (unlockTimeoutRef.current) {
      clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
  }, []);

  const unlockScanner = React.useCallback(() => {
    lockRef.current = false;
    setLocked(false);
  }, []);

  const resetScannerState = React.useCallback(() => {
    clearUnlockTimer();
    unlockScanner();
    setScannedCode(null);
    setModalVisible(false);
  }, [clearUnlockTimer, unlockScanner]);

  React.useEffect(() => {
    if (visible) {
      return;
    }

    resetScannerState();
  }, [resetScannerState, visible]);

  React.useEffect(
    () => () => {
      clearUnlockTimer();
    },
    [clearUnlockTimer],
  );

  const registerScan = React.useCallback(
    async (rawValue?: string | null, rawType?: SupportedBarcodeType | string | null) => {
      if (lockRef.current || locked) {
        return false;
      }

      const nextValue = normalizeBarcodeValue(rawValue);
      if (!nextValue) {
        return false;
      }

      if (!validateBarcode(nextValue, rawType)) {
        return false;
      }

      lockRef.current = true;
      setLocked(true);
      setScannedCode(nextValue);
      console.log("rawType: ", rawType);
      console.log("SCANNED CODE: ", nextValue);
      try {
        const localFoodData =
          await API.localFoodAPI.checkDBForFoodItemByBarcode(nextValue);
        if (localFoodData && localFoodData.found) {
          setScannedCode("ITEM ALREADY EXISTS IN THE DATABASE");
        } else {
          const foodData = await API.openFoodsAPI.getByBarcode(nextValue);
          if (!foodData) {
            setScannedCode("FOODDATA UNDEFINED");
          } else if (!foodData.valid) {
            setScannedCode(`INVALID BARCODE: ${nextValue}`);
          } else if (foodData.foodItem) {
            try {
              await DB.saveFoodItem(foodData.foodItem);
              setScannedCode("ITEM SAVED!");
            } catch {
              setScannedCode("ITEM FAILED SAVED!");
            }
          }
        }
      } catch {
        setScannedCode("UNAVAILABLE/ERROR");
      }
      setModalVisible(true);

      return true;
    },
    [locked],
  );

  const dismissResultModal = React.useCallback(() => {
    setModalVisible(false);
    clearUnlockTimer();
    unlockTimeoutRef.current = setTimeout(() => {
      unlockScanner();
    }, SCAN_DEBOUNCE_MS);
  }, [clearUnlockTimer, unlockScanner]);

  return {
    dismissResultModal,
    locked,
    modalVisible,
    registerScan,
    resetScannerState,
    scannedCode,
  };
};

type FoodBarcodeScannerScaffoldProps = FoodBarcodeScannerModalProps & {
  cameraNode: React.ReactNode;
  hasPermission: boolean;
  isPreparing: boolean;
  locked: boolean;
  modalVisible: boolean;
  onFinderLayout: (layout: LayoutRectangle) => void;
  onRequestPermission: () => void | Promise<void>;
  scannedCode: string | null;
  onDismissResultModal: () => void;
};

export const FoodBarcodeScannerScaffold = ({
  visible,
  onClose,
  cameraNode,
  hasPermission,
  isPreparing,
  locked,
  modalVisible,
  onFinderLayout,
  onRequestPermission,
  onDismissResultModal,
  scannedCode,
}: FoodBarcodeScannerScaffoldProps) => {
  const insets = useSafeAreaInsets();
  const finderRef = React.useRef<View | null>(null);

  const reportFinderLayout = React.useCallback(() => {
    const node = finderRef.current;
    if (!node) {
      return;
    }

    requestAnimationFrame(() => {
      node.measureInWindow((x, y, width, height) => {
        onFinderLayout({ x, y, width, height });
      });
    });
  }, [onFinderLayout]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        {hasPermission ? (
          isPreparing ? (
            <View style={styles.cameraFallback}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.fallbackTitle}>Preparing camera</Text>
              <Text style={styles.fallbackText}>
                We are getting the barcode scanner ready for a quick read.
              </Text>
            </View>
          ) : (
            cameraNode
          )
        ) : (
          <View style={styles.cameraFallback}>
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Text style={styles.permissionText}>
                Allow access so you can scan EAN and UPC barcodes here.
              </Text>
              <Pressable
                onPress={() => void onRequestPermission()}
                style={({ pressed }) => [
                  styles.permissionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.permissionButtonText}>
                  Allow camera access
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.headerRow}>
            <View style={styles.headerGroup}>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>Barcode Scanner</Text>
              </View>
              <View style={styles.backendBadge}>
                <Text style={styles.backendBadgeText}>Expo Camera</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityLabel="Close barcode scanner"
            >
              <XIcon size={18} color="#F8FAFC" weight="bold" />
            </Pressable>
          </View>

          <View style={styles.finderWrap} pointerEvents="none">
            <View
              ref={finderRef}
              style={styles.finderFrame}
              onLayout={(_: LayoutChangeEvent) => reportFinderLayout()}
            >
              <View style={styles.scanLine} />
            </View>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Scan a barcode</Text>
            <Text style={styles.footerText}>
              Keep the barcode centered inside the finder frame. Only codes
              detected in that window will trigger a lookup.
            </Text>
            <Text style={styles.footerHint}>
              {locked
                ? "Scanner is paused until you close the current result."
                : "Expo Camera is active for this session."}
            </Text>
          </View>
        </View>

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={onDismissResultModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Scanned Barcode</Text>
              <Text style={styles.modalValue}>
                {scannedCode ?? "No barcode value found"}
              </Text>
              <Pressable
                onPress={onDismissResultModal}
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  cameraFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: "#0F172A",
  },
  fallbackTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "900",
  },
  fallbackText: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.28)",
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    padding: 22,
    gap: 12,
  },
  permissionTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "900",
  },
  permissionText: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
  },
  permissionButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#EA580C",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  headerBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerBadgeText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  backendBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(251, 146, 60, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.34)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backendBadgeText: {
    color: "#FDBA74",
    fontSize: 12,
    fontWeight: "800",
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  finderWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  finderFrame: {
    width: "86%",
    aspectRatio: 1.2,
    maxWidth: 320,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    justifyContent: "center",
  },
  scanLine: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#FB923C",
    shadowColor: "#FB923C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  footerCard: {
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
  },
  footerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  footerText: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  footerHint: {
    color: "#FDBA74",
    fontSize: 12,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 22,
    alignItems: "center",
  },
  modalTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  modalValue: {
    color: "#EA580C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 18,
  },
  modalButton: {
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.9,
  },
});
