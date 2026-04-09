import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { appColors } from "../../theme/colors";

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
    backgroundColor: appColors.white,
  },
  text: {
    fontSize: 20,
    fontWeight: "600",
  },
});

export default FoodScreen;
