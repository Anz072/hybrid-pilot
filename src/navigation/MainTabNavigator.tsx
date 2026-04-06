import React from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "../screens/Home/HomeScreen";
import WeightScreen from "../screens/Weight/WeightScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import MoreScreen from "../screens/User_Settings/MoreScreen";
import FoodNavigator from "./FoodNavigator";
import type { FoodStackParamList } from "./foodTypes";
import {
  BarcodeIcon,
  BooksIcon,
  BugDroidIcon,
  DotsThreeCircleIcon,
  FireIcon,
  ForkKnifeIcon,
  HouseSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ScalesIcon,
  SparkleIcon,
  XIcon,
} from "phosphor-react-native";
import FoodLibraryScreen from "../screens/Food/FoodLibraryScreen";
import { DB } from "../store/DB";
import WeightEntryModal, {
  type WeightEntryDraft,
} from "../screens/Weight/WeightEntryModal";
import { generateUuid } from "../screens/Weight/weightUtils";
import FoodBarcodeScannerModal from "../screens/Food/FoodBarcodeScannerModal";

export type MainTabParamList = {
  Home: undefined;
  Food: NavigatorScreenParams<FoodStackParamList> | undefined;
  Shortcuts: undefined;
  Weight: undefined;
  More: undefined;
  Debug: undefined;
  Library: undefined;
};

const FOCUSED_COLOR = "#5B33B5";
const UNFOCUSED_COLOR = "#222";
const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.5);
const Tab = createBottomTabNavigator<MainTabParamList>();

const ShortcutPlaceholderScreen = () => (
  <View style={styles.placeholderScreen} />
);

const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const [shortcutsVisible, setShortcutsVisible] = React.useState(false);
  const [weightModalVisible, setWeightModalVisible] = React.useState(false);
  const [barcodeModalScannerVisible, setBarcodeModalScannerVisible] =
    React.useState(false);
  const sheetProgress = React.useRef(new Animated.Value(0)).current;

  const openShortcuts = React.useCallback(() => {
    sheetProgress.setValue(0);
    setShortcutsVisible(true);

    requestAnimationFrame(() => {
      Animated.timing(sheetProgress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [sheetProgress]);

  const closeShortcuts = React.useCallback(() => {
    Animated.timing(sheetProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShortcutsVisible(false);
      }
    });
  }, [sheetProgress]);

  const handleShortcutPress = React.useCallback(
    (shortcut: "search" | "barcode" | "weight") => {
      console.log(`[Shortcuts] ${shortcut} pressed`);
      if (shortcut === "weight") {
        setWeightModalVisible(true);
      } else if (shortcut === "barcode") {
        setBarcodeModalScannerVisible(true);
      } else if (shortcut === "search") {
      }
      closeShortcuts();
    },
    [closeShortcuts],
  );

  const handleShortcutWeightSave = React.useCallback(
    async (draft: WeightEntryDraft) => {
      try {
        const currentUser = await DB.getUser();
        const resolvedUserId = currentUser?.externalId ?? "guest-local";
        const entryId = generateUuid();

        await DB.saveWeightEntry({
          id: entryId,
          userExternalId: resolvedUserId,
          measuredAt: draft.measuredAt,
          measuredAtLocalIso: draft.measuredAtLocalIso,
          zoneOffsetMinutes: draft.zoneOffsetMinutes,
          valueKg: draft.valueOriginal,
          valueOriginal: draft.valueOriginal,
          unitOriginal: "kg",
          source: draft.source,
          notes: draft.notes ?? null,
          clientGeneratedId: entryId,
        });

        setWeightModalVisible(false);
      } catch {
        Alert.alert("Could not save entry", "Please try again.");
      }
    },
    [],
  );

  const backdropOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_HEIGHT + 48, 0],
  });

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: FOCUSED_COLOR,
          tabBarInactiveTintColor: UNFOCUSED_COLOR,
          tabBarStyle: [
            styles.tabBar,
            {
              height: 70 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ],
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <HouseSimpleIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Food"
          component={FoodNavigator}
          options={{
            tabBarIcon: ({ focused }) => (
              <ForkKnifeIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Shortcuts"
          component={ShortcutPlaceholderScreen}
          options={{
            tabBarLabel: () => null,
            tabBarButton: () => (
              <Pressable
                onPress={openShortcuts}
                style={({ pressed }) => [
                  styles.shortcutTabSlot,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shortcutTabButton}>
                  <PlusIcon size={26} color="#FFFFFF" weight="bold" />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tab.Screen
          name="Weight"
          component={WeightScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <FireIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
              />
            ),
          }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <DotsThreeCircleIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
              />
            ),
          }}
        />
        {/* <Tab.Screen
          name="Debug"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <BugDroidIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Library"
          component={FoodLibraryScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <BooksIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
              />
            ),
          }} 
        />*/}
      </Tab.Navigator>

      <Modal
        visible={shortcutsVisible}
        transparent
        animationType="none"
        onRequestClose={closeShortcuts}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeShortcuts}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                height: SHEET_HEIGHT,
                paddingBottom: Math.max(insets.bottom, 18),
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close shortcuts"
                onPress={closeShortcuts}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <XIcon size={22} color="#FFFFFF" weight="bold" />
              </Pressable>

              <Text style={styles.sheetTitle}>Shortcuts</Text>

              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.sheetDivider} />

            <View style={styles.shortcutsGrid}>
              <Pressable
                onPress={() => handleShortcutPress("search")}
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shortcutIconWrap}>
                  <MagnifyingGlassIcon
                    size={26}
                    color="#FFFFFF"
                    weight="bold"
                  />
                </View>
                <Text style={styles.shortcutLabel}>Search</Text>
              </Pressable>

              <Pressable
                onPress={() => handleShortcutPress("barcode")}
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shortcutIconWrap}>
                  <BarcodeIcon size={26} color="#FFFFFF" weight="bold" />
                </View>
                <Text style={styles.shortcutLabel}>Barcode</Text>
              </Pressable>

              <Pressable
                onPress={() => handleShortcutPress("weight")}
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shortcutIconWrap}>
                  <ScalesIcon size={26} color="#FFFFFF" weight="bold" />
                </View>
                <Text style={styles.shortcutLabel}>Weight</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <WeightEntryModal
        visible={weightModalVisible}
        mode="create"
        onClose={() => setWeightModalVisible(false)}
        onSave={(draft) => void handleShortcutWeightSave(draft)}
      />
      <FoodBarcodeScannerModal
        visible={barcodeModalScannerVisible}
        onClose={() => setBarcodeModalScannerVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placeholderScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E9E1F7",
    paddingTop: 8,
  },
  shortcutTabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutTabButton: {
    width: 54,
    height: 54,
    borderRadius: 999,
    // backgroundColor: "#1F1831",
    backgroundColor: "#bfbdc5",
    borderWidth: 3,
    borderColor: "#b3b1b9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 10, 24, 0.52)",
  },
  sheet: {
    backgroundColor: "#17131F",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#4A435A",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#26212F",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#2B2535",
    marginBottom: 22,
  },
  shortcutsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  shortcutCard: {
    flex: 1,
    alignItems: "center",
    gap: 12,
  },
  shortcutIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#2A2436",
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.88,
  },
});

export default MainTabNavigator;
