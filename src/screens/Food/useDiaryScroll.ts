import React from "react";
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useReducedMotion } from "../../theme/useReducedMotion";
import { diaryAnchorHeight, diaryRevealOffset } from "./diaryScrollGeometry";

export type DiaryEntryReveal = { id: number; date: string };

export const useDiaryScroll = ({
  dateKey,
  pendingEntry,
  enabled,
  onRevealed,
  bottomInset,
}: {
  dateKey: string;
  pendingEntry: DiaryEntryReveal | null;
  enabled: boolean;
  onRevealed: () => void;
  bottomInset: number;
}) => {
  const scrollRef = React.useRef<ScrollView>(null);
  const entryViews = React.useRef(new Map<number, View>());
  const scrollY = React.useRef(0);
  const viewportHeight = React.useRef(0);
  const anchorHeightRef = React.useRef(0);
  const [anchorHeight, setAnchorHeight] = React.useState(0);
  const [highlightedEntryId, setHighlightedEntryId] = React.useState<
    number | null
  >(null);
  const reducedMotion = useReducedMotion();
  const latest = React.useRef({
    pendingEntry,
    enabled,
    onRevealed,
    bottomInset,
    dateKey,
  });
  latest.current = { pendingEntry, enabled, onRevealed, bottomInset, dateKey };
  const frame = React.useRef<number | null>(null);

  const updateAnchorHeight = React.useCallback((height: number) => {
    anchorHeightRef.current = height;
    setAnchorHeight(height);
  }, []);

  React.useEffect(() => {
    updateAnchorHeight(0);
    setHighlightedEntryId(null);
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [dateKey, updateAnchorHeight]);

  React.useEffect(() => {
    if (highlightedEntryId == null) return;
    const timer = setTimeout(() => setHighlightedEntryId(null), 1400);
    return () => clearTimeout(timer);
  }, [highlightedEntryId]);

  const reveal = React.useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const {
        pendingEntry: target,
        enabled: active,
        dateKey: day,
      } = latest.current;
      if (!active || !target || target.date !== day) return;
      const row = entryViews.current.get(target.id);
      if (!row || !scrollRef.current) return;
      scrollRef.current
        .getNativeScrollRef()
        ?.measureInWindow((_x, viewportY, _width, height) => {
          row.measureInWindow((_rowX, rowY, _rowWidth, rowHeight) => {
            if (
              latest.current.pendingEntry !== target ||
              !latest.current.enabled ||
              !rowHeight ||
              !height
            )
              return;
            const offset = diaryRevealOffset({
              scrollY: scrollY.current,
              viewportY,
              viewportHeight: height,
              rowY,
              rowHeight,
              bottomInset: latest.current.bottomInset,
            });
            if (Math.abs(offset - scrollY.current) > 1) {
              scrollRef.current?.scrollTo({
                y: offset,
                animated: !reducedMotion,
              });
            }
            setHighlightedEntryId(target.id);
            latest.current.onRevealed();
          });
        });
    });
  }, [reducedMotion]);

  React.useEffect(() => {
    reveal();
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [pendingEntry, enabled, dateKey, reveal]);

  const registerEntry = React.useCallback((id: number, node: View | null) => {
    if (node) entryViews.current.set(id, node);
    else entryViews.current.delete(id);
  }, []);

  const preservePosition = React.useCallback(() => {
    updateAnchorHeight(
      diaryAnchorHeight(scrollY.current, viewportHeight.current),
    );
  }, [updateAnchorHeight]);

  const onScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = Math.max(0, event.nativeEvent.contentOffset.y);
      // Release only space now below the viewport, so an upward scroll cannot jump.
      const required = diaryAnchorHeight(
        scrollY.current,
        viewportHeight.current,
      );
      if (anchorHeightRef.current > required) updateAnchorHeight(required);
    },
    [updateAnchorHeight],
  );

  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      reveal();
    },
    [reveal],
  );

  return {
    scrollRef,
    anchorHeight,
    highlightedEntryId,
    registerEntry,
    preservePosition,
    onScroll,
    onLayout,
    reveal,
  };
};
