import React, { useEffect, useRef, useState } from "react";
import { Image, ImageSourcePropType, StyleProp, ImageStyle } from "react-native";

type SpriteAnimatorProps = {
  frames: ImageSourcePropType[];
  durations?: number[];
  style?: StyleProp<ImageStyle>;
};

export function SpriteAnimator({
  frames,
  durations,
  style,
}: SpriteAnimatorProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!frames.length) return;

    const frameDurations =
      durations && durations.length === frames.length
        ? durations
        : new Array(frames.length).fill(180);

    const tick = (index: number) => {
      timeoutRef.current = setTimeout(() => {
        const next = (index + 1) % frames.length;
        setFrameIndex(next);
        tick(next);
      }, frameDurations[index]);
    };

    tick(0);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [frames, durations]);

  return <Image source={frames[frameIndex]} style={style} resizeMode="contain" />;
}