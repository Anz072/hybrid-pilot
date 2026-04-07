import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { FoodStackParamList } from "../../navigation/foodTypes";
import { DB } from "../../store/DB";
import type { DBFoodItem } from "../../store/DB_TYPES";
import FoodScreenHeader from "./FoodScreenHeader";

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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FoodScreenHeader
          eyebrow="Debug"
          title="Food library"
          subtitle="Simple local DB viewer for generic food items."
          onBack={() => navigation.goBack()}
        />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Items</Text>
          <Text style={styles.panelMeta}>{items.length} loaded</Text>
          <TextInput
            placeholder="Search by name, brand, or barcode"
            placeholderTextColor="#6B7280"
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
                        {item.id} | {item.name}
                      </Text>
                      <Text style={styles.rowSubtitle}>
                        {item.source}
                        {item.brand ? ` | ${item.brand}` : ""}
                        {item.barcode ? ` | ${item.barcode}` : ""}
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  panelTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  panelMeta: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0F172A",
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
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    borderColor: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  rowSubtitle: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },
  rowChevron: {
    color: "#334155",
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
    borderColor: "#DC2626",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FEF2F2",
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
  },
  fieldRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 8,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  fieldValue: {
    color: "#0F172A",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "monospace",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },
});

export default FoodLibraryScreen;
