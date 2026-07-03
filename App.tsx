import React from "react";
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
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import AppNavigator from "./src/navigation/AppNavigator";
import { store } from "./src/store/appStore";
import { applyInterFontDefaults } from "./src/theme/applyInterFontDefaults";
import { appColors } from "./src/theme/colors";
import { loadDisplayPreferences } from "./src/preferences/displayPreferences";

applyInterFontDefaults();

export default function App() {
  const [preferencesReady, setPreferencesReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void loadDisplayPreferences().finally(() => {
      if (active) {
        setPreferencesReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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

  if ((!fontsLoaded && !fontError) || !preferencesReady) {
    return null;
  }

  if (fontError) {
    console.error("[App] Font loading failed", fontError);
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: appColors.surfaceCanvas }}
    >
      <StatusBar
        style="dark"
        backgroundColor={appColors.surfaceCanvas}
        animated
      />
      <SafeAreaProvider>
        <Provider store={store}>
          <AppNavigator />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
