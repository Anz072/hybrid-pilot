import React from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
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
  CarrotIcon,
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
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  getDefaultMealSlotForNow,
  MEAL_SLOT_DEFAULT_HOUR,
  MEAL_SLOT_LABELS,
} from "../screens/Food/foodUtils";
import {
  resolveFoodLogContext,
  toFoodLogRouteParams,
} from "../screens/Food/foodLogContext";
import { FoodDiaryDateProvider } from "../screens/Food/foodDiaryDateContext";
import {
  getShortcutRecents,
  saveShortcutRecents,
} from "../storage/localStore";
import { refreshAdaptiveRecommendationForUser } from "../screens/User_Settings/adaptiveCaloriesActions";
import { appColors } from "../theme/colors";
import { appTypography } from "../theme/typography";
import { IconButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import {
  appBorders,
  appRadius,
  appSpacing,
  appStates,
  appSurfaces,
} from "../theme/tokens";

export type MainTabParamList = {
  Home: undefined;
  Food: NavigatorScreenParams<FoodStackParamList> | undefined;
  Shortcuts: undefined;
  Weight: undefined;
  More: NavigatorScreenParams<MoreParamList> | undefined;
};

const FOCUSED_COLOR = appColors.textPrimary;
const UNFOCUSED_COLOR = appColors.textMuted;
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
  | "custom_meal"
  | "custom_food";

const PRIMARY_SHORTCUTS: Shortcut[] = ["barcode", "quick_add", "weight"];
const SECONDARY_SHORTCUTS: Shortcut[] = [
  "search",
  "recipe",
  "custom_meal",
  "custom_food",
];
const ALL_SHORTCUTS: Shortcut[] = [...PRIMARY_SHORTCUTS, ...SECONDARY_SHORTCUTS];
const SHORTCUT_LABELS: Record<Shortcut, string> = {
  barcode: "Scan",
  quick_add: "Quick Add",
  weight: "Weight",
  search: "Search",
  recipe: "Recipe",
  custom_meal: "Custom Meal",
  custom_food: "Create Food",
};

const isShortcut = (value: string): value is Shortcut =>
  [
    "search",
    "barcode",
    "weight",
    "quick_add",
    "recipe",
    "custom_meal",
    "custom_food",
  ].includes(value);

const ShortcutPlaceholderScreen = () => (
  <View style={styles.placeholderScreen} />
);

const MainTabNavigator = () => {
  const rootNavigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();
  const [selectedFoodDiaryDateKey, setSelectedFoodDiaryDateKey] =
    React.useState(() => formatFoodDateKey(new Date()));
  const [selectedFoodDiaryMeal, setSelectedFoodDiaryMeal] = React.useState(
    () => getDefaultMealSlotForNow(),
  );
  const currentDayKeyRef = React.useRef(formatFoodDateKey(new Date()));
  const [shortcutsVisible, setShortcutsVisible] = React.useState(false);
  const [weightModalVisible, setWeightModalVisible] = React.useState(false);
  const [weightRefreshToken, setWeightRefreshToken] = React.useState(0);
  const [barcodeModalScannerVisible, setBarcodeModalScannerVisible] =
    React.useState(false);
  const [recentShortcuts, setRecentShortcuts] = React.useState<Shortcut[]>([]);
  const sheetProgress = React.useRef(new Animated.Value(0)).current;
  const afterCloseActionRef = React.useRef<null | (() => void)>(null);

  const getSelectedFoodDiaryDateKey = React.useCallback(() => {
    const nextCurrentDayKey = formatFoodDateKey(new Date());
    const previousCurrentDayKey = currentDayKeyRef.current;
    currentDayKeyRef.current = nextCurrentDayKey;

    if (
      selectedFoodDiaryDateKey === previousCurrentDayKey &&
      nextCurrentDayKey !== previousCurrentDayKey
    ) {
      setSelectedFoodDiaryDateKey(nextCurrentDayKey);
      return nextCurrentDayKey;
    }

    return selectedFoodDiaryDateKey;
  }, [selectedFoodDiaryDateKey]);

  const getShortcutFoodLogContext = React.useCallback(() => {
    const date = getSelectedFoodDiaryDateKey();
    const now = new Date();
    const currentDateKey = formatFoodDateKey(now);
    const useCurrentTime =
      date === currentDateKey &&
      selectedFoodDiaryMeal === getDefaultMealSlotForNow();
    const loggedAt = useCurrentTime
      ? buildFoodLoggedAt(date, now.getHours(), now.getMinutes())
      : buildFoodLoggedAt(
          date,
          MEAL_SLOT_DEFAULT_HOUR[selectedFoodDiaryMeal],
        );
    const mealLabel = MEAL_SLOT_LABELS[selectedFoodDiaryMeal];

    return resolveFoodLogContext({
      contextLabel: mealLabel,
      date,
      loggedAt,
      mealType: mealLabel,
    });
  }, [getSelectedFoodDiaryDateKey, selectedFoodDiaryMeal]);

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
        const foodLogContext = getShortcutFoodLogContext();

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

        case "custom_food":
          openFoodScreen("CreateFoodItem");
          return;
      }
    },
    [
      closeShortcuts,
      getShortcutFoodLogContext,
      rememberShortcut,
      rootNavigation,
    ],
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
      const foodLogContext = getShortcutFoodLogContext();

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
    [getShortcutFoodLogContext, rootNavigation],
  );

  const handleShortcutScannedFoodNotFound = React.useCallback(
    (barcode: string) => {
      const foodLogContext = getShortcutFoodLogContext();

      setBarcodeModalScannerVisible(false);
      rootNavigation.dispatch(
        StackActions.push("CreateFoodItem", {
          ...toFoodLogRouteParams(foodLogContext),
          barcode,
        }),
      );
    },
    [getShortcutFoodLogContext, rootNavigation],
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
      case "custom_food":
        return <CarrotIcon size={size} color={appColors.textPrimary} />;
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

  const renderShortcutRow = (shortcut: Shortcut, isLast: boolean) => (
    <Pressable
      key={shortcut}
      accessibilityRole="button"
      onPress={() => handleShortcutPress(shortcut)}
      accessibilityLabel={SHORTCUT_LABELS[shortcut]}
      style={({ pressed }) => [
        styles.shortcutRow,
        !isLast && styles.shortcutRowDivider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.shortcutIconWrap}>{renderShortcutIcon(shortcut, 22)}</View>
      <AppText style={styles.shortcutRowLabel} variant="body">
        {SHORTCUT_LABELS[shortcut]}
      </AppText>
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
  const foodDiaryDateContextValue = React.useMemo(
    () => ({
      selectedDateKey: selectedFoodDiaryDateKey,
      selectedMeal: selectedFoodDiaryMeal,
      setSelectedDateKey: setSelectedFoodDiaryDateKey,
      setSelectedMeal: setSelectedFoodDiaryMeal,
    }),
    [selectedFoodDiaryDateKey, selectedFoodDiaryMeal],
  );

  return (
    <View style={styles.container}>
      <FoodDiaryDateProvider value={foodDiaryDateContextValue}>
        <Tab.Navigator
          initialRouteName="Food"
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
                accessibilityLabel="Open shortcuts"
                accessibilityRole="button"
                onPress={openShortcuts}
                style={({ pressed }) => [
                  styles.shortcutTabSlot,
                  pressed && styles.pressed,
                ]}
              >
                <PlusIcon size={31} color={FOCUSED_COLOR} weight="regular" />
                <AppText style={styles.shortcutTabLabel} variant="bodySmall">
                  Add
                </AppText>
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
      </FoodDiaryDateProvider>

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
              <AppText color="secondary" style={styles.sheetTitle} variant="label">
                SHORTCUTS
              </AppText>

              <IconButton
                accessibilityLabel="Close shortcuts"
                onPress={handleCloseShortcuts}
                style={styles.closeButton}
              >
                <XIcon size={24} color={appColors.textSecondary} />
              </IconButton>
            </View>

            <View style={styles.sheetDivider} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.shortcutScrollContent}
            >
              <View style={styles.shortcutList}>
                {ALL_SHORTCUTS.map((shortcut, index) =>
                  renderShortcutRow(shortcut, index === ALL_SHORTCUTS.length - 1),
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
        onFoodNotFound={handleShortcutScannedFoodNotFound}
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
  },
  tabBarHidden: {
    display: "none",
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarLabel: {
    ...appTypography.bodySmall,
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
    ...appTypography.bodySmall,
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
    backgroundColor: appSurfaces.canvas,
    borderTopLeftRadius: appRadius.xl,
    borderTopRightRadius: appRadius.xl,
    borderTopWidth: appBorders.width,
    borderTopColor: appBorders.soft,
    paddingHorizontal: appSpacing.lg,
    paddingTop: appSpacing.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: appSpacing.xs,
  },
  closeButton: {
    backgroundColor: appSurfaces.ghost,
    borderColor: appSurfaces.ghostStrong,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  sheetTitle: {
    ...appTypography.label,
  },
  sheetDivider: {
    height: appBorders.width,
    backgroundColor: appBorders.soft,
    marginTop: appSpacing.xs,
    marginBottom: appSpacing.xl,
    marginHorizontal: appSpacing.xl,
  },
  shortcutScrollContent: {
    paddingBottom: appSpacing.gutter,
  },
  shortcutList: {
    gap: 0,
  },
  shortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.md,
    minHeight: 56,
    paddingVertical: appSpacing.sm,
  },
  shortcutRowDivider: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
  },
  shortcutIconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutRowLabel: {
    flex: 1,
    ...appTypography.body,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
});

export default MainTabNavigator;
