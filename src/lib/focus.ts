export const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "details summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function nextFocusableIndex(
  currentIndex: number,
  totalItems: number,
  direction: 1 | -1,
): number {
  if (totalItems <= 0) {
    return -1;
  }

  return (currentIndex + direction + totalItems) % totalItems;
}

export function isEscapeKey(event: Pick<KeyboardEvent, "key">): boolean {
  return event.key === "Escape";
}
