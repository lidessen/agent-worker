/** @jsxImportSource @semajsx/terminal */
import { signal, computed, type ReadableSignal } from "@semajsx/signal";
import type { JSXNode, RuntimeComponent } from "@semajsx/core";
import { onKeypress } from "../keyboard";

/**
 * An option in the MultiSelect component
 */
export interface MultiSelectOption {
  /** Display label */
  label: string;
  /** Value returned on selection */
  value: string;
}

export interface MultiSelectProps {
  /** Available options */
  options: MultiSelectOption[];
  /** Callback when user confirms selection (Enter) */
  onConfirm: (selected: string[]) => void;
  /** Callback when user cancels (Escape) */
  onCancel?: () => void;
  /** Optional title */
  title?: string;
  /** Indicator for focused item */
  indicator?: string;
  /** Indicator for selected item */
  selectedIndicator?: string;
  /** Indicator for unselected item */
  unselectedIndicator?: string;
  /** Color for the focused item */
  focusColor?: string;
  /** Color for selected items */
  selectedColor?: string;
}

/**
 * MultiSelect component - interactive multi-selection menu.
 *
 * Navigate with arrow keys, toggle with Space, confirm with Enter, cancel with Escape.
 *
 * @example
 * ```tsx
 * <MultiSelect
 *   title="Select frameworks:"
 *   options={[
 *     { label: "React", value: "react" },
 *     { label: "Vue", value: "vue" },
 *     { label: "Svelte", value: "svelte" },
 *   ]}
 *   onConfirm={(selected) => console.log("Selected:", selected)}
 * />
 * ```
 */
export const MultiSelect: RuntimeComponent<MultiSelectProps> = (
  {
    options,
    onConfirm,
    onCancel,
    title,
    indicator = "❯",
    selectedIndicator = "◉",
    unselectedIndicator = "◯",
    focusColor = "cyan",
    selectedColor = "green",
  }: MultiSelectProps,
  ctx,
): JSXNode => {
  const focusIndex = signal(0);
  const selectedSet = signal<Set<string>>(new Set());

  const unsub = onKeypress((event) => {
    if (event.key === "up") {
      focusIndex.value = Math.max(0, focusIndex.value - 1);
    } else if (event.key === "down") {
      focusIndex.value = Math.min(options.length - 1, focusIndex.value + 1);
    } else if (event.key === "space") {
      const current = new Set(selectedSet.value);
      const value = options[focusIndex.value]!.value;
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      selectedSet.value = current;
    } else if (event.key === "return") {
      unsub();
      onConfirm(Array.from(selectedSet.value));
    } else if (event.key === "escape" && onCancel) {
      unsub();
      onCancel();
    }
  });

  // Ensure listener is cleaned up on unmount even if user doesn't press Enter/Escape
  ctx.onCleanup(unsub);

  const items = options.map((option, i) => {
    const isFocused = computed(focusIndex, (idx) => idx === i);
    const isSelected = computed(selectedSet, (set) => set.has(option.value));

    const prefix = computed(isSelected, (sel) => (sel ? selectedIndicator : unselectedIndicator));

    const line = computed(isFocused, (focused) =>
      focused
        ? `${indicator} ${prefix.value} ${option.label}`
        : `  ${prefix.value} ${option.label}`,
    );

    const color = computed(isFocused, (focused) => {
      if (focused) return focusColor;
      if (isSelected.value) return selectedColor;
      return undefined;
    });

    return (
      <text key={option.value} color={color as ReadableSignal<string | undefined>}>
        {line as ReadableSignal<string>}
      </text>
    );
  });

  return (
    <box flexDirection="column">
      {title ? <text bold>{title}</text> : null}
      {items}
      <text dim marginTop={1}>
        ↑/↓ navigate · space toggle · enter confirm
      </text>
    </box>
  );
};
