import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodItem } from "../../store/DB_TYPES";
import FoodScreenHeader from "./FoodScreenHeader";
import { appColors } from "../../theme/colors";

type FoodLibraryNav = NativeStackNavigationProp<FoodStackParamList, "FoodLibrary">;

type DebugField = {
  label: string;
  value: string;
};

const formatDebugValue = (value: unknown) => {
  if (value == null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    return prettyJson(value);
  }

  return String(value);
};

const prettyJson = (value: unknown): string => JSON.stringify(value, null, 2);

const parseRawPayload = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getDebugFields = (item: DBFoodItem): DebugField[] => {
  const rawPayload = parseRawPayload(item.rawPayload);
  const nutriments = rawPayload?.nutriments ?? null;
  const fields = Object.entries(item).map(([label, value]) => ({
    label,
    value:
      label === "rawPayload" && rawPayload
        ? prettyJson(rawPayload)
        : formatDebugValue(value),
  }));
  const rawPayloadIndex = fields.findIndex((field) => field.label === "rawPayload");
  const nutrimentsField = {
    label: "nutriments",
    value: nutriments ? prettyJson(nutriments) : "null",
  };

  if (rawPayloadIndex === -1) {
    return [...fields, nutrimentsField];
  }

  return [
    ...fields.slice(0, rawPayloadIndex),
    nutrimentsField,
    ...fields.slice(rawPayloadIndex),
  ];
};

const FoodLibraryScreen = () => {
  const navigation = useNavigation<FoodLibraryNav>();

  const [items, setItems] = useState<DBFoodItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    const rows = await DB.listFoodItems({
      query,
      limit: query.trim() ? 300 : 200,
    });

    setItems(rows);

    if (selectedItemId != null && !rows.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [query, selectedItemId]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems]),
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const selectedFields = useMemo(
    () => (selectedItem ? getDebugFields(selectedItem) : []),
    [selectedItem],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedItem || isDeleting) {
      return;
    }

    Alert.alert(
      "Delete food item?",
      `This will remove "${selectedItem.name}" from the local food DB, along with related local logs and favorites.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setIsDeleting(true);
                await DB.deleteFoodItem(selectedItem.id);
                setSelectedItemId(null);
                await loadItems();
              } catch (error) {
                Alert.alert(
                  "Delete failed",
                  error instanceof Error
                    ? error.message
                    : "That item could not be deleted.",
                );
              } finally {
                setIsDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }, [isDeleting, loadItems, selectedItem]);

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
        <FoodScreenHeader
          eyebrow="Debug"
          title="Food library"
          subtitle="Debug viewer for the active food catalog."
          onBack={() => navigation.goBack()}
        />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Items</Text>
          <Text style={styles.panelMeta}>{items.length} loaded</Text>
          <TextInput
            placeholder="Search by name, brand, or barcode"
            placeholderTextColor={appColors.gray500}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />

          <View style={styles.list}>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>No items found.</Text>
            ) : (
              items.map((item) => {
                const isSelected = item.id === selectedItemId;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setSelectedItemId((current) => (current === item.id ? null : item.id))
                    }
                    style={({ pressed }) => [
                      styles.row,
                      isSelected && styles.rowSelected,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>
                        {item.id} · {item.name}
                      </Text>
                      <Text style={styles.rowSubtitle}>
                        {item.source}
                        {item.brand ? ` · ${item.brand}` : ""}
                        {item.barcode ? ` · ${item.barcode}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.rowChevron}>{isSelected ? "Hide" : "View"}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Selected item</Text>
          {selectedItem ? (
            <View style={styles.details}>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleDeleteSelected}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    (pressed || isDeleting) && styles.rowPressed,
                  ]}
                >
                  <Text style={styles.deleteButtonText}>
                    {isDeleting ? "Deleting..." : "Delete item"}
                  </Text>
                </Pressable>
              </View>
              {selectedFields.map((field) => (
                <View key={field.label} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text selectable style={styles.fieldValue}>
                    {field.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Tap an item above to inspect all DB fields.</Text>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  panel: {
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.slate300,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  panelTitle: {
    color: appColors.slate900,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  panelMeta: {
    color: appColors.slate600,
    fontSize: 13,
    marginBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: appColors.slate300,
    borderRadius: 10,
    backgroundColor: appColors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: appColors.slate900,
    fontSize: 15,
    marginBottom: 10,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: appColors.slate200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: appColors.white,
  },
  rowSelected: {
    borderColor: appColors.slate900,
    backgroundColor: appColors.slate50,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: appColors.slate900,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  rowSubtitle: {
    color: appColors.slate600,
    fontSize: 12,
    lineHeight: 17,
  },
  rowChevron: {
    color: appColors.slate700,
    fontSize: 12,
    fontWeight: "700",
  },
  details: {
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: appColors.danger600,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: appColors.dangerSurface,
  },
  deleteButtonText: {
    color: appColors.danger700,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldRow: {
    borderBottomWidth: 1,
    borderBottomColor: appColors.slate200,
    paddingBottom: 8,
  },
  fieldLabel: {
    color: appColors.slate700,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  fieldValue: {
    color: appColors.slate900,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "monospace",
  },
  emptyText: {
    color: appColors.slate500,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default FoodLibraryScreen;
