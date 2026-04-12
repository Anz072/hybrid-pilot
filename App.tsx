import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Provider } from "react-redux";
import {
  Inter_100Thin,
  Inter_100Thin_Italic,
  Inter_200ExtraLight,
  Inter_200ExtraLight_Italic,
  Inter_300Light,
  Inter_300Light_Italic,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_500Medium_Italic,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
  Inter_700Bold,
  Inter_700Bold_Italic,
  Inter_800ExtraBold,
  Inter_800ExtraBold_Italic,
  Inter_900Black,
  Inter_900Black_Italic,
  useFonts,
} from "@expo-google-fonts/inter";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import AppNavigator from "./src/navigation/AppNavigator";
import { store } from "./src/store/appStore";
import { applyInterFontDefaults } from "./src/theme/applyInterFontDefaults";
import { appColors } from "./src/theme/colors";
import { SpriteAnimator } from "./src/splash/spriteAnimator";

applyInterFontDefaults();

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Inter_100Thin,
    Inter_100Thin_Italic,
    Inter_200ExtraLight,
    Inter_200ExtraLight_Italic,
    Inter_300Light,
    Inter_300Light_Italic,
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_500Medium_Italic,
    Inter_600SemiBold,
    Inter_600SemiBold_Italic,
    Inter_700Bold,
    Inter_700Bold_Italic,
    Inter_800ExtraBold,
    Inter_800ExtraBold_Italic,
    Inter_900Black,
    Inter_900Black_Italic,
  });
  const appReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (!appReady) return;

    if (fontError) {
      console.error("[App] Font loading failed", fontError);
    }

    const timer = setTimeout(() => {
      setShowAnimatedSplash(false);
    }, 1600);

    return () => clearTimeout(timer);
  }, [appReady, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  if (showAnimatedSplash) {
    return (
      <View
        style={{ flex: 1, backgroundColor: appColors.surfaceCanvas }}
        onLayout={onLayoutRootView}
      >
        <StatusBar style="light" />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SpriteAnimator
            frames={[
              require("./assets/images/cat-1.png"),
              require("./assets/images/cat-2.png"),
            ]}
            durations={[260, 140]}
            style={{ width: 160, height: 160 }}
          />
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar style="light" />
      <Provider store={store}>
        <AppNavigator />
      </Provider>
    </GestureHandlerRootView>
  );
}
