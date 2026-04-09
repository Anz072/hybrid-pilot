import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { appColors } from "../../theme/colors";

const LoginScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: appColors.raw_hex_f5f7fb,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    color: appColors.gray800,
  },
  button: {
    backgroundColor: appColors.sky500,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: {
    color: appColors.white,
    fontWeight: '600',
  },
});

export default LoginScreen;
