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
import { StackActions, useNavigation } from "@react-navigation/native";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "../screens/Home/HomeScreen";
import WeightScreen from "../screens/Weight/WeightScreen";
import FoodNavigator from "./FoodNavigator";
import type { FoodStackParamList } from "./foodTypes";
import MoreNavigator, { type MoreParamList } from "./MoreNavigator";
import type { RootStackParamList } from "./AppNavigator";
import {
  BarcodeIcon,
  CookingPotIcon,
  DotsThreeCircleIcon,
  FireIcon,
  ForkKnifeIcon,
  HouseSimpleIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ScalesIcon,
  XIcon,
} from "phosphor-react-native";
import { DB } from "../store/DB";
import WeightEntryModal, {
  type WeightEntryDraft,
} from "../screens/Weight/WeightEntryModal";
import { generateUuid } from "../screens/Weight/weightUtils";
import FoodBarcodeScannerModal from "../screens/Food/FoodBarcodeScannerModal";
import type { ScannedFoodLookupResult } from "../screens/Food/FoodBarcodeScannerShared";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  formatFoodLoggedTime,
} from "../screens/Food/foodUtils";
import { appColors } from "../theme/colors";
import { appTypography } from "../theme/typography";

export type MainTabParamList = {
  Home: undefined;
  Food: NavigatorScreenParams<FoodStackParamList> | undefined;
  Shortcuts: undefined;
  Weight: undefined;
  More: NavigatorScreenParams<MoreParamList> | undefined;
  Debug: NavigatorScreenParams<MoreParamList> | undefined;
  Library: undefined;
};

const FOCUSED_COLOR = appColors.textPrimary;
const UNFOCUSED_COLOR = appColors.textMuted;
const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.41);
const Tab = createBottomTabNavigator<MainTabParamList>();
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const ShortcutPlaceholderScreen = () => (
  <View style={styles.placeholderScreen} />
);

const MainTabNavigator = () => {
  const rootNavigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();
  const [shortcutsVisible, setShortcutsVisible] = React.useState(false);
  const [weightModalVisible, setWeightModalVisible] = React.useState(false);
  const [weightRefreshToken, setWeightRefreshToken] = React.useState(0);
  const [barcodeModalScannerVisible, setBarcodeModalScannerVisible] =
    React.useState(false);
  const sheetProgress = React.useRef(new Animated.Value(0)).current;
  const afterCloseActionRef = React.useRef<null | (() => void)>(null);

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

  const closeShortcuts = React.useCallback(
    (afterClose?: () => void) => {
      afterCloseActionRef.current = afterClose ?? null;
      Animated.timing(sheetProgress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShortcutsVisible(false);
          const callback = afterCloseActionRef.current;
          afterCloseActionRef.current = null;
          callback?.();
        }
      });
    },
    [sheetProgress],
  );

  const handleCloseShortcuts = React.useCallback(() => {
    closeShortcuts();
  }, [closeShortcuts]);

  const handleShortcutPress = React.useCallback(
    (shortcut: "search" | "barcode" | "weight" | "quick_add" | "recipe") => {
      if (shortcut === "weight") {
        closeShortcuts(() => setWeightModalVisible(true));
      } else if (shortcut === "barcode") {
        closeShortcuts(() => setBarcodeModalScannerVisible(true));
      } else if (shortcut === "quick_add") {
        const now = new Date();
        const date = formatFoodDateKey(now);
        const loggedAt = buildFoodLoggedAt(
          date,
          now.getHours(),
          now.getMinutes(),
        );

        closeShortcuts(() =>
          rootNavigation.navigate("QuickAddFood", {
            contextLabel: formatFoodLoggedTime(loggedAt),
            date,
            loggedAt,
            mealType: null,
          }),
        );
      } else if (shortcut === "recipe") {
        const now = new Date();
        const date = formatFoodDateKey(now);
        const loggedAt = buildFoodLoggedAt(
          date,
          now.getHours(),
          now.getMinutes(),
        );

        closeShortcuts(() =>
          rootNavigation.navigate("CreateRecipe", {
            contextLabel: formatFoodLoggedTime(loggedAt),
            date,
            loggedAt,
            mealType: null,
          }),
        );
      } else if (shortcut === "search") {
        const now = new Date();
        const date = formatFoodDateKey(now);
        const loggedAt = buildFoodLoggedAt(
          date,
          now.getHours(),
          now.getMinutes(),
        );

        closeShortcuts(() =>
          rootNavigation.navigate("AddFood", {
            contextLabel: formatFoodLoggedTime(loggedAt),
            date,
            loggedAt,
            mealType: null,
          }),
        );
      }
    },
    [closeShortcuts, rootNavigation],
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

        setWeightRefreshToken((current) => current + 1);
        setWeightModalVisible(false);
      } catch {
        Alert.alert("Could not save entry", "Please try again.");
      }
    },
    [],
  );

  const handleShortcutScannedFoodResolved = React.useCallback(
    (result: ScannedFoodLookupResult) => {
      const now = new Date();
      const date = formatFoodDateKey(now);
      const loggedAt = buildFoodLoggedAt(
        date,
        now.getHours(),
        now.getMinutes(),
      );

      const scannedFoodParams: RootStackParamList["ScannedFood"] = {
        foodId: result.foodId,
        barcode: result.barcode,
        scanStatus: result.status,
        contextLabel: formatFoodLoggedTime(loggedAt),
        date,
        loggedAt,
        mealType: null,
      };

      setBarcodeModalScannerVisible(false);
      rootNavigation.dispatch(
        StackActions.push("ScannedFood", scannedFoodParams),
      );
    },
    [rootNavigation],
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
                weight={focused ? "bold" : "light"}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Food"
          component={FoodNavigator}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              event.preventDefault();
              navigation.navigate("Food", {
                screen: "Diary",
              });
            },
          })}
          options={{
            tabBarIcon: ({ focused }) => (
              <ForkKnifeIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                weight={focused ? "bold" : "light"}
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
                  <PlusIcon
                    size={26}
                    color={appColors.revolutDark}
                    weight="bold"
                  />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tab.Screen
          name="Weight"
          options={{
            tabBarIcon: ({ focused }) => (
              <FireIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                weight={focused ? "bold" : "light"}
              />
            ),
          }}
        >
          {() => <WeightScreen externalRefreshToken={weightRefreshToken} />}
        </Tab.Screen>
        <Tab.Screen
          name="More"
          component={MoreNavigator}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              event.preventDefault();
              navigation.navigate("More", {
                screen: "MoreMainScreen",
              });
            },
          })}
          options={{
            tabBarIcon: ({ focused }) => (
              <DotsThreeCircleIcon
                size={24}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                weight={focused ? "bold" : "light"}
              />
            ),
          }}
        />
      </Tab.Navigator>

      <Modal
        visible={shortcutsVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseShortcuts}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleCloseShortcuts}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                height: SHEET_HEIGHT,
                paddingBottom: Math.max(insets.bottom + 8, 24),
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.headerSpacer} />

              <Text style={styles.sheetTitle}>SHORTCUTS</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close shortcuts"
                onPress={handleCloseShortcuts}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <XIcon size={24} color={appColors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.sheetDivider} />

            <View style={styles.shortcutsGrid}>
              <Pressable
                onPress={() => handleShortcutPress("quick_add")}
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shortcutIconWrap}>
                  <LightningIcon size={26} color={appColors.textPrimary} />
                </View>
                <Text style={styles.shortcutLabel}>Quick Add</Text>
              </Pressable>

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
                    color={appColors.textPrimary}
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
                  <BarcodeIcon size={26} color={appColors.textPrimary} />
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
                  <ScalesIcon size={26} color={appColors.textPrimary} />
                </View>
                <Text style={styles.shortcutLabel}>Weight</Text>
              </Pressable>

              <Pressable
                onPress={() => handleShortcutPress("recipe")}
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shortcutIconWrap}>
                  <CookingPotIcon size={26} color={appColors.textPrimary} />
                </View>
                <Text style={styles.shortcutLabel}>Recipe</Text>
              </Pressable>

              <View style={styles.shortcutCard}></View>
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
        onFoodResolved={handleShortcutScannedFoodResolved}
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
    backgroundColor: appColors.surfaceCanvas,
  },
  tabBar: {
    backgroundColor: appColors.surfaceBase,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
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
    backgroundColor: appColors.revolutLight,
    borderWidth: 3,
    borderColor: appColors.surfaceBase,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: appColors.tabScrim,
  },
  sheet: {
    backgroundColor: appColors.surfaceBase,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: appColors.textMuted,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 2,
    borderColor: appColors.whiteOverlay18,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  sheetTitle: {
    ...appTypography.label,
    color: appColors.textSecondary,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: appColors.borderSoft,
    marginTop: 2,
    marginBottom: 18,
  },
  shortcutsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  shortcutCard: {
    width: "30%",
    alignItems: "center",
    gap: 12,
  },
  shortcutIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    ...appTypography.bodySmall,
    color: appColors.textPrimary,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
});

export default MainTabNavigator;
