import {
  getCustomMealEditorId,
  getLibraryFoodIdentity,
} from "../../domain/libraryFoodIdentity";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CookingPotIcon,
  ForkKnifeIcon,
  PencilSimpleIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { DB } from "../../store/DB";
import type { DBFoodItem } from "../../store/DB_TYPES";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  appBorders,
  appRadius,
  appSpacing,
  appStates,
  appSurfaces,
} from "../../theme/tokens";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  formatFoodItemServing,
  formatFoodNumber,
} from "../Food/foodUtils";
import SettingsStackHeader from "./SettingsStackHeader";

type LibraryKind = "recipes" | "custom_meals";

type UserCreatedFoodLibraryNav = CompositeNavigationProp<
  NativeStackNavigationProp<MoreParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type LibraryScreenConfig = {
  emptyText: string;
  eyebrow: string;
  listLabel: string;
  subtitle: string;
  title: string;
};

const SCREEN_CONFIG: Record<LibraryKind, LibraryScreenConfig> = {
  recipes: {
    eyebrow: "Recipes",
    title: "Your Recipes",
    subtitle: "Saved recipes you created. Tap any row to open the full editor.",
    listLabel: "recipes",
    emptyText:
      "No recipes created yet. Build one from the diary or Add Food flow and it will appear here.",
  },
  custom_meals: {
    eyebrow: "Custom Meals",
    title: "Your Custom Meals",
    subtitle:
      "Saved meals you created. Tap any row to update macros, serving size, or visibility.",
    listLabel: "custom meals",
    emptyText:
      "No custom meals created yet. Create one from the diary or Add Food flow and it will appear here.",
  },
};

const parseLibraryPayload = (rawPayload: string | null) => {
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const getRecipeId = (food: DBFoodItem) => {
  const identity = getLibraryFoodIdentity(food);
  return identity?.kind === "custom_recipe" ? identity.id : null;
};
const getMealId = (food: DBFoodItem) => {
  return getCustomMealEditorId(food);
};

const formatUpdatedLabel = (iso: string) =>
  `Updated ${new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

const getServingsLabel = (food: DBFoodItem) => {
  const servings = Number(parseLibraryPayload(food.rawPayload)?.servings);

  if (!Number.isFinite(servings) || servings <= 0) {
    return "1 serving";
  }

  const rounded = Number.isInteger(servings)
    ? String(servings)
    : servings.toFixed(1);
  return `${rounded} servings`;
};

const buildLibraryEditContext = () => {
  const date = formatFoodDateKey(new Date());

  return {
    contextLabel: "Library",
    date,
    loggedAt: buildFoodLoggedAt(date, 12, 0),
    mealType: null as null,
  };
};

const UserCreatedFoodLibraryScreen = ({ kind }: { kind: LibraryKind }) => {
  const config = SCREEN_CONFIG[kind];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<UserCreatedFoodLibraryNav>();
  const user = useAppSelector((state) => state.user.currentUser);
  const [items, setItems] = React.useState<DBFoodItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadItems = React.useCallback(
    async (silent = false) => {
      if (!user) {
        setItems([]);
        setLoadError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setLoadError(null);

        const nextItems =
          kind === "recipes"
            ? await DB.listUserCreatedRecipeFoods(user.externalId, 500)
            : await DB.listUserCreatedCustomMealFoods(user.externalId, 500);

        setItems(nextItems);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [kind, user],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadItems();
    }, [loadItems]),
  );

  const handleEdit = React.useCallback(
    (item: DBFoodItem) => {
      const context = buildLibraryEditContext();

      if (kind === "recipes") {
        const recipeId = getRecipeId(item);

        if (recipeId == null) {
          Alert.alert(
            "Recipe unavailable",
            "That recipe could not be opened for editing.",
          );
          return;
        }

        navigation.navigate("CreateRecipe", {
          ...context,
          recipeId,
        });
        return;
      }

      const mealId = getMealId(item);
      if (mealId == null) {
        Alert.alert(
          "Custom meal unavailable",
          "That custom meal could not be opened for editing.",
        );
        return;
      }

      navigation.navigate("CreateCustomFood", {
        ...context,
        mealId,
      });
    },
    [kind, navigation],
  );

  const publicCount = React.useMemo(
    () => items.filter((item) => item.isPublic).length,
    [items],
  );

  const renderHeader = React.useMemo(
    () => (
      <View>
        <SettingsStackHeader
          onBack={() => navigation.goBack()}
          title={config.title}
        />
      </View>
    ),
    [
      config.listLabel,
      config.subtitle,
      config.title,
      items.length,
      kind,
      navigation,
      publicCount,
    ],
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="small" color={appColors.brand500} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const payload = parseLibraryPayload(item.rawPayload);
          const supplementalText =
            kind === "recipes"
              ? item.ingredientsText
              : typeof payload?.description === "string"
                ? payload.description
                : null;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
              onPress={() => handleEdit(item)}
              style={({ pressed }) => [
                styles.row,
                index === 0 && styles.rowFirst,
                index === items.length - 1 && styles.rowLast,
                pressed && styles.rowPressed,
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryText}>{item.name}</Text>
                  <Text style={styles.secondaryText}>
                    {formatFoodNumber(item.calories, " kcal")} ·{" "}
                    {kind === "recipes"
                      ? getServingsLabel(item)
                      : formatFoodItemServing(item)}{" "}
                    · {item.isPublic ? "Public" : "Private"}
                  </Text>
                </View>
                <PencilSimpleIcon size={18} color={appColors.textSecondary} />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            {kind === "recipes" ? (
              <CookingPotIcon
                size={28}
                color={appColors.brand700}
                weight="fill"
              />
            ) : (
              <ForkKnifeIcon
                size={28}
                color={appColors.brand700}
                weight="fill"
              />
            )}
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>{config.emptyText}</Text>
          </View>
        }
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadItems(true)}
            tintColor={appColors.slate900}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {loadError ? (
        <View style={[styles.inlineError, { bottom: insets.bottom + 18 }]}>
          <Text style={styles.inlineErrorText}>{loadError}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const UserCreatedRecipesScreen = () => (
  <UserCreatedFoodLibraryScreen kind="recipes" />
);

export const UserCreatedCustomMealsScreen = () => (
  <UserCreatedFoodLibraryScreen kind="custom_meals" />
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: appSpacing.gutter,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceCanvas,
  },
  summaryCard: {
    flexDirection: "row",
    gap: appSpacing.sm,
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    padding: appSpacing.md,
    marginBottom: 14,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.soft,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
    marginBottom: 4,
  },
  summaryText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: appRadius.md,
    borderTopRightRadius: appRadius.md,
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    borderBottomWidth: 0,
  },
  headerCell: {
    justifyContent: "center",
  },
  tableHeaderLabel: {
    ...appTypography.label,
    color: appColors.textSecondary,
  },
  row: {
    backgroundColor: appSurfaces.card,
    borderLeftWidth: appBorders.width,
    borderRightWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowFirst: {
    borderTopWidth: appBorders.width,
  },
  rowLast: {
    borderBottomWidth: appBorders.width,
    borderBottomLeftRadius: appRadius.md,
    borderBottomRightRadius: appRadius.md,
    marginBottom: appSpacing.md,
  },
  rowPressed: {
    opacity: appStates.pressedOpacity,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowCell: {
    justifyContent: "center",
  },
  nameColumn: {
    flex: 1.3,
  },
  detailColumn: {
    flex: 0.9,
  },
  stateColumn: {
    flex: 0.8,
  },
  actionColumn: {
    width: 22,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  primaryText: {
    ...appTypography.body,
    color: appColors.textPrimary,
    fontWeight: "600",
    marginBottom: 2,
  },
  primaryMetaText: {
    ...appTypography.bodySmall,
    color: appColors.textPrimary,
    fontWeight: "600",
    marginBottom: 2,
  },
  secondaryText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  supplementalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
  },
  supplementalText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  statusText: {
    ...appTypography.bodySmallStrong,
    marginBottom: 4,
  },
  statusTextPublic: {
    color: appColors.brand500,
  },
  statusTextPrivate: {
    color: appColors.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    padding: appSpacing.xl,
    marginTop: appSpacing.sm,
  },
  emptyTitle: {
    ...appTypography.displayCard,
    color: appColors.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    ...appTypography.body,
    color: appColors.textSecondary,
    textAlign: "center",
  },
  inlineError: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.card,
    borderWidth: appBorders.width,
    borderColor: appColors.dangerText,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineErrorText: {
    ...appTypography.bodySmall,
    color: appColors.dangerText,
    textAlign: "center",
  },
});
