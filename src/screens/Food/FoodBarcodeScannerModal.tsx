import React from "react";
import { Alert, LayoutRectangle, StyleSheet } from "react-native";
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from "expo-camera";
import {
  FoodBarcodeScannerScaffold,
  type FoodBarcodeScannerModalProps,
  useBarcodeDebugScanner,
} from "./FoodBarcodeScannerShared";

const FoodBarcodeScannerModal = ({
  visible,
  onClose,
  onFoodResolved,
}: FoodBarcodeScannerModalProps) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanWindow, setScanWindow] = React.useState<LayoutRectangle | null>(
    null,
  );

  const {
    dismissResultModal,
    locked,
    modalVisible,
    registerScan,
    resetScannerState,
    scannedCode,
  } = useBarcodeDebugScanner(visible, onFoodResolved);

  const handleCloseScanner = () => {
    resetScannerState();
    onClose();
  };

  const isWithinScanWindow = React.useCallback(
    (result: BarcodeScanningResult) => {
      if (!scanWindow) {
        return false;
      }

      const cornerPoints = result.cornerPoints ?? [];
      const points =
        cornerPoints.length > 0
          ? cornerPoints
          : [
              result.bounds.origin,
              {
                x: result.bounds.origin.x + result.bounds.size.width,
                y: result.bounds.origin.y + result.bounds.size.height,
              },
            ];

      if (points.length === 0) {
        return false;
      }

      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

      return (
        centerX >= scanWindow.x &&
        centerX <= scanWindow.x + scanWindow.width &&
        centerY >= scanWindow.y &&
        centerY <= scanWindow.y + scanWindow.height
      );
    },
    [scanWindow],
  );

  const handleBarcodeScanned = React.useCallback(
    (result: BarcodeScanningResult) => {
      if (!isWithinScanWindow(result)) {
        return;
      }

      console.log("[BarcodeScanner] Expo barcode event", {
        data: result.data,
        type: result.type,
      });
      void registerScan(result.data, result.type);
    },
    [isWithinScanWindow, registerScan],
  );

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        "Camera permission needed",
        "Allow camera access to scan barcodes in the food flow.",
      );
    }
  };

  return (
    <FoodBarcodeScannerScaffold
      visible={visible}
      onClose={handleCloseScanner}
      cameraNode={
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => console.log("[BarcodeScanner] Camera ready")}
          onMountError={(error) =>
            console.warn("[BarcodeScanner] Camera mount error", error)
          }
          onBarcodeScanned={locked ? undefined : handleBarcodeScanned}
        />
      }
      hasPermission={!!permission?.granted}
      isPreparing={permission === null}
      locked={locked}
      modalVisible={modalVisible}
      onDismissResultModal={dismissResultModal}
      onFinderLayout={setScanWindow}
      onRequestPermission={() => void handleRequestPermission()}
      scannedCode={scannedCode}
    />
  );
};

export default FoodBarcodeScannerModal;
