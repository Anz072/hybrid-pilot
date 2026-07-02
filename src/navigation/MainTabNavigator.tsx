import React from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  getFocusedRouteNameFromRoute,
  StackActions,
  useNavigation,
} from "@react-navigation/native";
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
  BowlFoodIcon,
  CookingPotIcon,
  DotsThreeIcon,
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
import { formatFoodDateKey } from "../screens/Food/foodUtils";
import {
  resolveFoodLogContext,
  toFoodLogRouteParams,
} from "../screens/Food/foodLogContext";
import {
  getShortcutRecents,
  saveShortcutRecents,
} from "../storage/localStore";
import { refreshAdaptiveRecommendationForUser } from "../screens/User_Settings/adaptiveCaloriesActions";
import { appColors } from "../theme/colors";
import { appTypography } from "../theme/typography";

export type MainTabParamList = {
  Home: undefined;
  Food: NavigatorScreenParams<FoodStackParamList> | undefined;
  Shortcuts: undefined;
  Weight: undefined;
  More: NavigatorScreenParams<MoreParamList> | undefined;
};

const FOCUSED_COLOR = "#070707";
const UNFOCUSED_COLOR = "rgba(7, 7, 7, 0.64)";
const TAB_BAR_BACKGROUND = appColors.surfaceCard;
const TAB_BAR_BORDER = appColors.borderSoft;
const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.4);
const Tab = createBottomTabNavigator<MainTabParamList>();
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type Shortcut =
  | "search"
  | "barcode"
  | "weight"
  | "quick_add"
  | "recipe"
  | "custom_meal";

const PRIMARY_SHORTCUTS: Shortcut[] = ["barcode", "quick_add", "weight"];
const SECONDARY_SHORTCUTS: Shortcut[] = ["search", "recipe", "custom_meal"];
const SHORTCUT_LABELS: Record<Shortcut, string> = {
  barcode: "Scan",
  quick_add: "Quick Add",
  weight: "Weight",
  search: "Search",
  recipe: "Recipe",
  custom_meal: "Custom Meal",
};

const isShortcut = (value: string): value is Shortcut =>
  [
    "search",
    "barcode",
    "weight",
    "quick_add",
    "recipe",
    "custom_meal",
  ].includes(value);

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
  const [recentShortcuts, setRecentShortcuts] = React.useState<Shortcut[]>([]);
  const sheetProgress = React.useRef(new Animated.Value(0)).current;
  const afterCloseActionRef = React.useRef<null | (() => void)>(null);

  React.useEffect(() => {
    let cancelled = false;

    const loadRecentShortcuts = async () => {
      const stored = await getShortcutRecents();
      if (!cancelled) {
        setRecentShortcuts(stored.filter(isShortcut));
      }
    };

    void loadRecentShortcuts();

    return () => {
      cancelled = true;
    };
  }, []);

  const rememberShortcut = React.useCallback((shortcut: Shortcut) => {
    setRecentShortcuts((current) => {
      const next = [
        shortcut,
        ...current.filter((item) => item !== shortcut),
      ].slice(0, 2);

      void saveShortcutRecents(next);
      return next;
    });
  }, []);

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
    (shortcut: Shortcut) => {
      rememberShortcut(shortcut);
      
      const openFoodScreen = (screen: any) => {
        const now = new Date();
        const date = formatFoodDateKey(now);
        const foodLogContext = resolveFoodLogContext({ date });

        closeShortcuts(() =>
          rootNavigation.navigate(screen, {
            ...toFoodLogRouteParams(foodLogContext),
          }),
        );
      };

      switch (shortcut) {
        case "weight":
          closeShortcuts(() => setWeightModalVisible(true));
          return;

        case "barcode":
          closeShortcuts(() => setBarcodeModalScannerVisible(true));
          return;

        case "quick_add":
          openFoodScreen("QuickAddFood");
          return;

        case "recipe":
          openFoodScreen("CreateRecipe");
          return;

        case "search":
          openFoodScreen("AddFood");
          return;

        case "custom_meal":
          openFoodScreen("CreateCustomFood");
          return;
      }
    },
    [closeShortcuts, rememberShortcut, rootNavigation],
  );

  const handleShortcutWeightSave = React.useCallback(
    async (draft: WeightEntryDraft) => {
      try {
        const currentUser = await DB.getUser();
        const resolvedUserId = currentUser?.externalId;

        if (!resolvedUserId) {
          setWeightModalVisible(false);
          Alert.alert("Session expired", "Please sign in with email again.");
          return;
        }

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
        try {
          await refreshAdaptiveRecommendationForUser({
            userExternalId: resolvedUserId,
          });
        } catch {
          // Saving the weight entry should not fail because adaptive refresh did.
        }

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
      const foodLogContext = resolveFoodLogContext({ date });

      const scannedFoodParams: RootStackParamList["ScannedFood"] = {
        ...toFoodLogRouteParams(foodLogContext),
        foodId: result.foodId,
        barcode: result.barcode,
        scanStatus: result.status,
      };

      setBarcodeModalScannerVisible(false);
      rootNavigation.dispatch(
        StackActions.push("ScannedFood", scannedFoodParams),
      );
    },
    [rootNavigation],
  );

  const renderShortcutIcon = (shortcut: Shortcut, size = 26) => {
    switch (shortcut) {
      case "barcode":
        return <BarcodeIcon size={size} color={appColors.textPrimary} />;
      case "quick_add":
        return (
          <LightningIcon
            size={size}
            color={appColors.textPrimary}
            weight="fill"
          />
        );
      case "weight":
        return <ScalesIcon size={size} color={appColors.textPrimary} />;
      case "recipe":
        return <CookingPotIcon size={size} color={appColors.textPrimary} />;
      case "custom_meal":
        return <BowlFoodIcon size={size} color={appColors.textPrimary} />;
      case "search":
      default:
        return (
          <MagnifyingGlassIcon
            size={size}
            color={appColors.textPrimary}
            weight="bold"
          />
        );
    }
  };

  const renderShortcutButton = (
    shortcut: Shortcut,
    variant: "primary" | "secondary" = "secondary",
  ) => (
    <Pressable
      key={shortcut}
      onPress={() => handleShortcutPress(shortcut)}
      accessibilityLabel={SHORTCUT_LABELS[shortcut]}
      style={({ pressed }) => [
        styles.shortcutCard,
        variant === "primary" && styles.shortcutCardPrimary,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.shortcutIconWrap,
          variant === "primary" && styles.shortcutIconWrapPrimary,
        ]}
      >
        {renderShortcutIcon(shortcut, variant === "primary" ? 28 : 25)}
      </View>
      <Text style={styles.shortcutLabel}>{SHORTCUT_LABELS[shortcut]}</Text>
    </Pressable>
  );

  const backdropOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sheetBottomInset = Math.max(insets.bottom, 0);
  const sheetHeight = SHEET_HEIGHT + sheetBottomInset;
  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight + 48, 0],
  });
  const visibleTabBarStyle = React.useMemo(
    () => [
      styles.tabBar,
      {
        height: 68 + insets.bottom,
        paddingBottom: Math.max(insets.bottom, 8),
      },
    ],
    [insets.bottom],
  );

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: FOCUSED_COLOR,
          tabBarInactiveTintColor: UNFOCUSED_COLOR,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          tabBarStyle: visibleTabBarStyle,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <HouseSimpleIcon
                size={26}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                weight={focused ? "bold" : "regular"}
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
          options={({ route }) => {
            const focusedRouteName =
              getFocusedRouteNameFromRoute(route) ?? "Diary";

            return {
              tabBarStyle:
                focusedRouteName === "Diary"
                  ? visibleTabBarStyle
                  : styles.tabBarHidden,
              tabBarIcon: ({ focused }) => (
                <ForkKnifeIcon
                  size={26}
                  color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                  weight={focused ? "bold" : "regular"}
                />
              ),
            };
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
                <PlusIcon size={31} color={FOCUSED_COLOR} weight="regular" />
                <Text style={styles.shortcutTabLabel}>Add</Text>
              </Pressable>
            ),
          }}
        />
        <Tab.Screen
          name="Weight"
          options={{
            tabBarIcon: ({ focused }) => (
              <ScalesIcon
                size={26}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                weight={focused ? "bold" : "regular"}
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
              <DotsThreeIcon
                size={26}
                color={focused ? FOCUSED_COLOR : UNFOCUSED_COLOR}
                weight={focused ? "bold" : "regular"}
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
                height: sheetHeight,
                paddingBottom: Math.max(sheetBottomInset, 16),
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
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

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.shortcutScrollContent}
            >
              <View style={styles.shortcutsGrid}>
                {PRIMARY_SHORTCUTS.map((shortcut) =>
                  renderShortcutButton(shortcut, "primary"),
                )}
              </View>

              <View style={styles.shortcutsGrid}>
                {SECONDARY_SHORTCUTS.map((shortcut) =>
                  renderShortcutButton(shortcut),
                )}
              </View>
            </ScrollView>
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
    backgroundColor: TAB_BAR_BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: TAB_BAR_BORDER,
    paddingTop: 6,
    shadowColor: appColors.borderStrong,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 10,
  },
  tabBarHidden: {
    display: "none",
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarLabel: {
    color: appColors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0,
  },
  shortcutTabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    gap: 0,
  },
  shortcutTabLabel: {
    color: FOCUSED_COLOR,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: appColors.surfaceOverlay,
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
    borderColor: appColors.surfaceGhostStrong,
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
    backgroundColor: appColors.slate100,
    marginTop: 6,
    marginBottom: 24,
    marginHorizontal:24
  },
  shortcutSectionLabel: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
  },
  shortcutScrollContent: {
    paddingBottom: 18,
  },
  recentShortcutGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  shortcutsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  shortcutCard: {
    width: "30%",
    alignItems: "center",
    gap: 10,
    minHeight: 98,
  },
  shortcutCardPrimary: {
    flex: 1,
    width: undefined,
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
  shortcutIconWrapPrimary: {
    width: 70,
    height: 70,
    backgroundColor: appColors.surfaceGhost,
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
