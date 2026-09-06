/** Keep enough content below the viewport to prevent a collapse clamping its offset. */
export const diaryAnchorHeight = (scrollY: number, viewportHeight: number) =>
  Math.ceil(Math.max(0, scrollY) + viewportHeight);

/** Move only as far as necessary to expose a saved row. Coordinates are in the window. */
export const diaryRevealOffset = ({
  scrollY,
  viewportY,
  viewportHeight,
  rowY,
  rowHeight,
  bottomInset = 12,
}: {
  scrollY: number;
  viewportY: number;
  viewportHeight: number;
  rowY: number;
  rowHeight: number;
  bottomInset?: number;
}) => {
  const top = viewportY + 12;
  const bottom = viewportY + viewportHeight - bottomInset;
  if (rowY < top || rowHeight > bottom - top) {
    return Math.max(0, scrollY + rowY - top);
  }
  if (rowY + rowHeight > bottom) {
    return Math.max(0, scrollY + rowY + rowHeight - bottom);
  }
  return scrollY;
};
