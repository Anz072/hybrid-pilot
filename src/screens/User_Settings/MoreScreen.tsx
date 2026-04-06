import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, View, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import { useAppSelector } from "../../store/hooks";

type MoreScreenNav = NativeStackNavigationProp<MoreParamList, "MoreMainScreen">;

const MoreScreen = () => {
  const user = useAppSelector((state) => state.user.currentUser);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MoreScreenNav>();

  return (
    <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopBar}>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroTitle}>Hello, {user?.displayName}</Text>
          <Image
            source={require("../../../assets/images/temp-profile-pic.jpg")}
            style={{ width: 100, height: 100 }}
          />
        </View>
        <View>
          <Text style={styles.title}>DEBUG MENU</Text>
          <Pressable onPress={() => navigation.navigate("SettingsScreen")}>
            <View style={styles.button}>
              <Text style={styles.buttonText}>Debug</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("FoodLibrary")}>
            <View style={styles.button}>
              <Text style={styles.buttonText}>Local Food Item Library</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 20,
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  heroTopBar: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginBottom: 18,
  },
  heroTitle: {
    color: "#221C2D",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginHorizontal: 6,
    borderTopWidth: 1,
    borderColor: "#ececec",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2,
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 12,
    marginTop: 24,
  },
});
export default MoreScreen;
