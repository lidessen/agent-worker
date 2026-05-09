/** @jsxImportSource @semajsx/terminal */
import { signal, type ReadableSignal } from "@semajsx/signal";
import type { JSXNode, RuntimeComponent } from "@semajsx/core";

/**
 * Built-in spinner frame sets
 */
export const spinnerFrames = {
  dots: { frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], interval: 80 },
  line: { frames: ["-", "\\", "|", "/"], interval: 130 },
  arc: { frames: ["◜", "◠", "◝", "◞", "◡", "◟"], interval: 100 },
  bouncingBar: {
    frames: ["[    ]", "[=   ]", "[==  ]", "[=== ]", "[ ===]", "[  ==]", "[   =]", "[    ]"],
    interval: 80,
  },
} as const;

export type SpinnerType = keyof typeof spinnerFrames;

export interface SpinnerProps {
  /**
   * Spinner type or custom frames array
   * @default "dots"
   */
  type?: SpinnerType;
  /**
   * Custom frames (overrides type)
   */
  frames?: string[];
  /**
   * Interval in ms between frames
   * @default depends on type
   */
  interval?: number;
  /**
   * Label to display after the spinner
   */
  label?: string;
  /**
   * Color of the spinner
   */
  color?: string;
}

/**
 * Spinner component - animated loading indicator for terminal UIs.
 *
 * @example
 * ```tsx
 * <Spinner />
 * <Spinner type="line" label="Loading..." />
 * <Spinner frames={["🌑", "🌒", "🌓", "🌔", "🌕"]} interval={150} />
 * ```
 */
export const Spinner: RuntimeComponent<SpinnerProps> = (
  {
    type = "dots",
    frames: customFrames,
    interval: customInterval,
    label,
    color = "cyan",
  }: SpinnerProps,
  ctx,
): JSXNode => {
  const config = spinnerFrames[type];
  const frames = customFrames ?? config.frames;
  const interval = customInterval ?? config.interval;

  const frameSignal = signal(frames[0]!);
  let index = 0;

  const timer = setInterval(() => {
    index = (index + 1) % frames.length;
    frameSignal.value = frames[index]!;
  }, interval);

  ctx.onCleanup(() => clearInterval(timer));

  if (label) {
    return (
      <box flexDirection="row">
        <text color={color}>{frameSignal as ReadableSignal<string>}</text>
        <text> {label}</text>
      </box>
    );
  }

  return <text color={color}>{frameSignal as ReadableSignal<string>}</text>;
};
