import React from "react";
import { Provider } from "react-redux";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts as usePlexSansFonts,
} from "@expo-google-fonts/ibm-plex-sans";
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
  useFonts as useNewsreaderFonts,
} from "@expo-google-fonts/newsreader";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import AppNavigator from "./src/navigation/AppNavigator";
import { store } from "./src/store/appStore";
import { applyFontDefaults } from "./src/theme/applyFontDefaults";
import { appColors } from "./src/theme/colors";
import { loadDisplayPreferences } from "./src/preferences/displayPreferences";

applyFontDefaults();

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

  const [plexSansLoaded, plexSansError] = usePlexSansFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });
  const [newsreaderLoaded, newsreaderError] = useNewsreaderFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
  });

  const fontsLoaded = plexSansLoaded && newsreaderLoaded;
  const fontError = plexSansError ?? newsreaderError;

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
