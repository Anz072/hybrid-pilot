import React from "react";
import { StyleSheet, Text, View } from "react-native";

const FoodScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Food Diary</Text>
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

export default FoodScreen;
