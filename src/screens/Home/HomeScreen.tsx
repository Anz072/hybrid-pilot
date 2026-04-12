import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BarbellIcon,
  ForkKnifeIcon,
  SparkleIcon,
  TrendUpIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSelector } from "../../store/hooks";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.user.currentUser);

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Hybrid Pilot</Text>
          <Text style={styles.title}>
            {user?.displayName
              ? `${user.displayName}, keep the plan tight.`
              : "Keep the plan tight."}
          </Text>
          <Text style={styles.subtitle}>
            Dark, focused surfaces with fast access to food, trend, and weekly
            targets.
          </Text>

          <View style={styles.heroMetricRow}>
            <View style={styles.metricPill}>
              <SparkleIcon size={16} color={appColors.foodPrimary} weight="fill" />
              <Text style={styles.metricPillText}>Product mode</Text>
            </View>
            <View style={styles.metricPill}>
              <TrendUpIcon size={16} color={appColors.revolutTeal} weight="bold" />
              <Text style={styles.metricPillText}>Weekly pacing</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionCard}>
            <View style={styles.cardIcon}>
              <ForkKnifeIcon
                size={18}
                color={appColors.textPrimary}
                weight="fill"
              />
            </View>
            <Text style={styles.cardTitle}>Food diary</Text>
            <Text style={styles.cardText}>
              Search, scan, or build recipes without leaving the darker workflow.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={[styles.cardIcon, styles.cardIconAlt]}>
              <TrendUpIcon
                size={18}
                color={appColors.textPrimary}
                weight="bold"
              />
            </View>
            <Text style={styles.cardTitle}>Weight trend</Text>
            <Text style={styles.cardText}>
              See progress, averages, and goal pacing on flatter, high-contrast
              cards.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <View style={styles.featureIcon}>
              <BarbellIcon
                size={18}
                color={appColors.revolutDark}
                weight="fill"
              />
            </View>
            <Text style={styles.featureEyebrow}>This pass</Text>
          </View>
          <Text style={styles.featureTitle}>Revolut-inspired dark shell</Text>
          <Text style={styles.featureText}>
            Bigger headlines, pill actions, zero shadows, and a cleaner neutral
            palette now drive the app chrome.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 20,
  },
  orbTop: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbTop,
  },
  orbBottom: {
    position: "absolute",
    bottom: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: appColors.foodOrbBottom,
  },
  heroCard: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    ...appTypography.label,
    alignSelf: "flex-start",
    color: appColors.textSecondary,
    backgroundColor: appColors.surfaceGhost,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  title: {
    ...appTypography.displayHero,
    color: appColors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: 18,
  },
  heroMetricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  metricPillText: {
    ...appTypography.bodySmall,
    color: appColors.textPrimary,
  },
  sectionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  sectionCard: {
    flex: 1,
    backgroundColor: appColors.surfaceCardAlt,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 16,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.foodPrimaryDark,
    marginBottom: 14,
  },
  cardIconAlt: {
    backgroundColor: appColors.revolutTeal,
  },
  cardTitle: {
    ...appTypography.title,
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  cardText: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
  },
  featureCard: {
    backgroundColor: appColors.revolutLight,
    borderRadius: 28,
    padding: 18,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.foodPrimaryDark,
  },
  featureEyebrow: {
    ...appTypography.label,
    color: appColors.revolutDark,
  },
  featureTitle: {
    ...appTypography.displayCard,
    color: appColors.revolutDark,
    marginBottom: 6,
  },
  featureText: {
    ...appTypography.body,
    color: appColors.slate600,
  },
});

export default HomeScreen;
