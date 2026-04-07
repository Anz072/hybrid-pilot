import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LighthouseIcon } from "phosphor-react-native";
import { useAppSelector } from "../../store/hooks";
import { SpriteAnimator } from "../../splash/spriteAnimator";

const HomeScreen = () => {
  const user = useAppSelector((state) => state.user.currentUser);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is the Home Screen</Text>
      <Text style={styles.text}>Welcome, {user?.displayName}!</Text>
      <LighthouseIcon size={32} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  text: {
    fontSize: 20,
    fontWeight: "600",
  },
});

export default HomeScreen;
