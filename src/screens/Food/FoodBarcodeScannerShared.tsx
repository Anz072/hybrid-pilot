import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutRectangle,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "phosphor-react-native";
import { DB } from "../../store/DB";
import { API } from "../../API/apiCaller";
import { appColors } from "../../theme/colors";

export type FoodBarcodeScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onFoodResolved?: (result: ScannedFoodLookupResult) => void;
};

export type ScannedFoodLookupResult = {
  foodId: number;
  barcode: string;
  status: "existing" | "created";
  foodName: string;
};

const SCAN_DEBOUNCE_MS = 1000;

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

export const useBarcodeDebugScanner = (
  visible: boolean,
  onFoodResolved?: (result: ScannedFoodLookupResult) => void,
) => {
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
    async (
      rawValue?: string | null,
      rawType?: SupportedBarcodeType | string | null,
    ) => {
      console.log("[BarcodeScanner] Registering scan", {
        rawType,
        rawValue,
      });
      if (lockRef.current || locked) {
        return false;
      }

      const nextValue = normalizeBarcodeValue(rawValue);
      if (!nextValue) {
        console.log("[BarcodeScanner] Ignoring non-numeric barcode", {
          rawType,
          rawValue,
        });
        return false;
      }

      if (!validateBarcode(nextValue, rawType)) {
        console.log("[BarcodeScanner] Ignoring invalid food barcode", {
          rawType,
          value: nextValue,
        });
        return false;
      }

      lockRef.current = true;
      setLocked(true);
      setScannedCode(nextValue);

      const resolveFood = (result: ScannedFoodLookupResult) => {
        if (onFoodResolved) {
          onFoodResolved(result);
          return;
        }

        setScannedCode(
          `${result.foodName}\n${result.status === "created" ? "Added to library" : "Found in library"}`,
        );
        setModalVisible(true);
      };

      try {
        const localFood = await DB.getFoodItemByBarcode(nextValue);

        if (localFood) {
          resolveFood({
            foodId: localFood.id,
            barcode: nextValue,
            status: "existing",
            foodName: localFood.name,
          });
          return true;
        }

        const foodData = await API.openFoodsAPI.getByBarcode(nextValue);
        if (!foodData) {
          setScannedCode(`Could not look up barcode ${nextValue}.`);
          setModalVisible(true);
          return true;
        }

        if (!foodData.valid || !foodData.foodItem) {
          setScannedCode(`No food found for barcode ${nextValue}.`);
          setModalVisible(true);
          return true;
        }

        const foodId = await DB.saveFoodItem(foodData.foodItem);
        const savedFood = await DB.getFoodItemById(foodId);

        resolveFood({
          foodId,
          barcode: nextValue,
          status: "created",
          foodName: savedFood?.name ?? foodData.foodItem.name,
        });
      } catch (error) {
        console.error("[BarcodeScanner] Could not resolve scanned food", error);
        setScannedCode("Could not load this barcode. Please try again.");
        setModalVisible(true);
      }

      return true;
    },
    [locked, onFoodResolved],
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
  onManualBarcodeSubmit: (barcode: string) => Promise<boolean> | boolean;
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
  onManualBarcodeSubmit,
  onRequestPermission,
  onDismissResultModal,
  scannedCode,
}: FoodBarcodeScannerScaffoldProps) => {
  const insets = useSafeAreaInsets();
  const [manualBarcode, setManualBarcode] = React.useState("");
  const [manualBarcodeError, setManualBarcodeError] = React.useState<
    string | null
  >(null);
  const screenRef = React.useRef<View | null>(null);
  const finderRef = React.useRef<View | null>(null);

  const reportFinderLayout = React.useCallback(() => {
    const screenNode = screenRef.current;
    const finderNode = finderRef.current;
    if (!screenNode || !finderNode) {
      return;
    }

    requestAnimationFrame(() => {
      screenNode.measureInWindow((screenX, screenY) => {
        finderNode.measureInWindow((x, y, width, height) => {
          onFinderLayout({
            x: x - screenX,
            y: y - screenY,
            width,
            height,
          });
        });
      });
    });
  }, [onFinderLayout]);

  React.useEffect(() => {
    if (visible) {
      return;
    }

    setManualBarcode("");
    setManualBarcodeError(null);
  }, [visible]);

  const handleManualBarcodeSubmit = React.useCallback(async () => {
    const normalized = normalizeBarcodeValue(manualBarcode);

    if (!normalized) {
      setManualBarcodeError("Enter the barcode digits first.");
      return;
    }

    if (!validateBarcode(normalized)) {
      setManualBarcodeError("Enter a valid EAN, UPC, or GTIN barcode.");
      return;
    }

    setManualBarcodeError(null);
    const accepted = await onManualBarcodeSubmit(normalized);

    if (accepted) {
      setManualBarcode("");
    }
  }, [manualBarcode, onManualBarcodeSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar style="light" backgroundColor={appColors.slate950} animated />
      <View
        ref={screenRef}
        style={styles.screen}
        onLayout={() => reportFinderLayout()}
      >
        {hasPermission ? (
          isPreparing ? (
            <View style={styles.cameraFallback}>
              <ActivityIndicator size="small" color={appColors.white} />
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

        <KeyboardAvoidingView
          style={styles.overlayAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          pointerEvents="box-none"
        >
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
              <View style={styles.headerGroup} />
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityLabel="Close barcode scanner"
              >
                <XIcon size={18} color={appColors.slate50} weight="bold" />
              </Pressable>
            </View>

            <View style={styles.finderWrap} pointerEvents="none">
              <View
                ref={finderRef}
                style={styles.finderFrame}
                onLayout={() => reportFinderLayout()}
              >
                <View style={styles.scanLine} />
              </View>
            </View>

            <View style={styles.manualCard}>
              <Text style={styles.manualTitle}>Scan or enter barcode</Text>
              <Text style={styles.manualText}>
                Type the EAN, UPC, or GTIN digits if the camera cannot catch the label.
              </Text>
              <View style={styles.manualRow}>
                <TextInput
                  value={manualBarcode}
                  onChangeText={(value) => {
                    setManualBarcode(value);
                    setManualBarcodeError(null);
                  }}
                  editable={!locked}
                  keyboardType="number-pad"
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    void handleManualBarcodeSubmit();
                  }}
                  placeholder="e.g. 737628064502"
                  placeholderTextColor={appColors.slate400}
                  style={[
                    styles.manualInput,
                    locked && styles.manualInputDisabled,
                  ]}
                />
                <Pressable
                  onPress={() => {
                    void handleManualBarcodeSubmit();
                  }}
                  disabled={locked}
                  style={({ pressed }) => [
                    styles.manualButton,
                    locked && styles.manualButtonDisabled,
                    pressed && !locked && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.manualButtonText}>
                    {locked ? "Looking..." : "Look up"}
                  </Text>
                </Pressable>
              </View>
              {manualBarcodeError ? (
                <Text style={styles.manualError}>{manualBarcodeError}</Text>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>

        {locked && !modalVisible ? (
          <View style={styles.lookupBanner} pointerEvents="none">
            <ActivityIndicator size="small" color={appColors.white} />
            <View style={styles.lookupCopy}>
              <Text style={styles.lookupTitle}>Barcode detected</Text>
              <Text style={styles.lookupText}>
                {scannedCode
                  ? `Looking up ${scannedCode}`
                  : "Checking your food library"}
              </Text>
            </View>
          </View>
        ) : null}

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
    backgroundColor: appColors.slate950,
  },
  cameraFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: appColors.slate900,
  },
  fallbackTitle: {
    color: appColors.slate50,
    fontSize: 22,
    fontWeight: "900",
  },
  fallbackText: {
    color: appColors.slate300,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.brand700,
    backgroundColor: appColors.surfaceOverlay,
    padding: 22,
    gap: 12,
  },
  permissionTitle: {
    color: appColors.slate50,
    fontSize: 22,
    fontWeight: "900",
  },
  permissionText: {
    color: appColors.slate300,
    fontSize: 14,
    lineHeight: 20,
  },
  permissionButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: appColors.brand500,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  overlayAvoiding: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: appColors.surfaceOverlay,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerBadgeText: {
    color: appColors.slate50,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  backendBadge: {
    borderRadius: 999,
    backgroundColor: appColors.brand800,
    borderWidth: 1,
    borderColor: appColors.brand700,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backendBadgeText: {
    color: appColors.brand300,
    fontSize: 12,
    fontWeight: "800",
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceOverlay,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
  },
  finderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  finderFrame: {
    width: "86%",
    aspectRatio: 1.2,
    maxWidth: 320,
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.white,
    backgroundColor: appColors.surfaceGhost,
    overflow: "hidden",
    justifyContent: "center",
  },
  scanLine: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 999,
    backgroundColor: appColors.brand400,
    shadowColor: appColors.brand400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  footerCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceOverlay,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
    padding: 18,
  },
  footerTitle: {
    color: appColors.slate50,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  footerText: {
    color: appColors.slate300,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  footerHint: {
    color: appColors.brand300,
    fontSize: 12,
    fontWeight: "700",
  },
  manualCard: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceOverlay,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
    padding: 16,
  },
  manualTitle: {
    color: appColors.slate50,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  manualText: {
    color: appColors.slate300,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  manualInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
    backgroundColor: appColors.surfaceOverlay,
    color: appColors.slate50,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  manualInputDisabled: {
    opacity: 0.7,
  },
  manualButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: appColors.brand500,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  manualButtonDisabled: {
    opacity: 0.7,
  },
  manualButtonText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  manualError: {
    color: appColors.dangerText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 10,
  },
  lookupBanner: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 196,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceOverlay,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lookupCopy: {
    flex: 1,
  },
  lookupTitle: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  lookupText: {
    color: appColors.brand300,
    fontSize: 12,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: appColors.surfaceOverlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 8,
    backgroundColor: appColors.white,
    padding: 22,
    alignItems: "center",
  },
  modalTitle: {
    color: appColors.gray900,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  modalValue: {
    color: appColors.brand500,
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
    borderRadius: 8,
    backgroundColor: appColors.gray900,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.9,
  },
});

