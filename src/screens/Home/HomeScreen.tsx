import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lighthouse  } from "phosphor-react-native";

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home Screen</Text>
      <Lighthouse  size={32} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
  },
});

export default HomeScreen;
