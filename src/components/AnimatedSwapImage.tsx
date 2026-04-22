import React from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type AnimatedSwapImageProps = {
  firstSource: ImageSourcePropType;
  secondSource: ImageSourcePropType;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
  frameDurationMs?: number;
  firstHoldMs?: number;
  secondHoldMs?: number;
  bobDurationMs?: number;
  bobDistance?: number;
};

const AnimatedSwapImage = ({
  firstSource,
  secondSource,
  containerStyle,
  imageStyle,
  resizeMode = "contain",
  frameDurationMs = 650,
  firstHoldMs = 600,
  secondHoldMs = 450,
  bobDurationMs = 1500,
  bobDistance = 5,
}: AnimatedSwapImageProps) => {
  const frame = React.useRef(new Animated.Value(0)).current;
  const bob = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const frameLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(frame, {
          toValue: 1,
          duration: frameDurationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(firstHoldMs),
        Animated.timing(frame, {
          toValue: 0,
          duration: frameDurationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(secondHoldMs),
      ]),
    );

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: bobDurationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: bobDurationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    frameLoop.start();
    bobLoop.start();

    return () => {
      frameLoop.stop();
      bobLoop.stop();
    };
  }, [
    bob,
    bobDurationMs,
    firstHoldMs,
    frame,
    frameDurationMs,
    secondHoldMs,
  ]);

  const firstOpacity = frame.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const secondOpacity = frame.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -Math.abs(bobDistance)],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        { transform: [{ translateY }] },
      ]}
    >
      <Animated.Image
        source={firstSource}
        resizeMode={resizeMode}
        style={[styles.image, styles.imageLayer, imageStyle, { opacity: firstOpacity }]}
      />
      <Animated.Image
        source={secondSource}
        resizeMode={resizeMode}
        style={[styles.image, styles.imageLayer, imageStyle, { opacity: secondOpacity }]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 84,
    height: 84,
  },
  imageLayer: {
    position: "absolute",
  },
});

export default AnimatedSwapImage;
