/**
 * Vue integration for @semajsx/style
 *
 * Provides useStyle composable and StyleAnchor component for seamless
 * integration with Vue applications.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useStyle } from "@semajsx/style/vue";
 * import * as button from "./button.style";
 *
 * const props = defineProps<{ large?: boolean; primary?: boolean }>();
 * const cx = useStyle();
 * </script>
 *
 * <template>
 *   <button :class="cx(button.root, large && button.large, primary && button.primary)">
 *     <slot />
 *   </button>
 * </template>
 * ```
 */

import {
  inject,
  provide,
  ref,
  onMounted,
  onUnmounted,
  defineComponent,
  h,
  type InjectionKey,
  type Ref,
  type Component,
} from "vue";
import { signal as createSignal, type Signal } from "@semajsx/signal";
import { isStyleToken, injectStyles, uniqueId, type StyleToken } from "./index";

/**
 * Registry managed by each StyleAnchor instance
 */
interface StyleAnchorRegistry {
  /** Signal → CSS variable name (unique within this anchor) */
  signalVars: WeakMap<Signal<unknown>, string>;
  /** Already injected classNames (for deduplication) */
  injectedClasses: Set<string>;
  /** Process a token: assign var names, inject CSS, set up subscriptions */
  processToken: (token: StyleToken) => string;
  /** Anchor element ref */
  anchorRef: Ref<HTMLElement | null>;
  /** Add subscription for cleanup */
  addSubscription: (unsub: () => void) => void;
}

const StyleAnchorKey: InjectionKey<StyleAnchorRegistry> = Symbol("StyleAnchor");

/**
 * Argument type for cx() function
 */
type CxArg = StyleToken | string | false | null | undefined;

/**
 * Composable to get the cx() function for combining class names
 *
 * The cx() function accepts StyleTokens, strings, and falsy values,
 * processes them, and returns a combined className string.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useStyle } from "@semajsx/style/vue";
 * import * as button from "./button.style";
 *
 * const props = defineProps<{ large?: boolean; primary?: boolean }>();
 * const cx = useStyle();
 * </script>
 *
 * <template>
 *   <button :class="cx(button.root, large && button.large, primary && button.primary)">
 *     <slot />
 *   </button>
 * </template>
 * ```
 */
export function useStyle(): (...args: CxArg[]) => string {
  const registry = inject(StyleAnchorKey, null);

  const cx = (...args: CxArg[]): string => {
    const classes: string[] = [];

    for (const arg of args) {
      if (!arg) continue;

      if (isStyleToken(arg)) {
        // Registry handles all side effects
        if (registry) {
          const className = registry.processToken(arg);
          if (className) classes.push(className);
        } else {
          // No registry, just use the className if available
          if (arg._) classes.push(arg._);
        }
      } else {
        classes.push(arg);
      }
    }

    return classes.join(" ");
  };

  return cx;
}

/**
 * StyleAnchor component - Manages all style-related state and side effects
 *
 * @example
 * ```vue
 * <template>
 *   <StyleAnchor>
 *     <MyApp />
 *   </StyleAnchor>
 * </template>
 *
 * <script setup>
 * import { StyleAnchor } from "@semajsx/style/vue";
 * </script>
 * ```
 */
export const StyleAnchor: Component = defineComponent({
  name: "StyleAnchor",
  props: {
    /** Target for style injection (defaults to document.head) */
    target: {
      type: Object as () => Element | ShadowRoot | undefined,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const anchorRef = ref<HTMLElement | null>(null);
    const subscriptions = new Set<() => void>();
    const signalVars = new WeakMap<Signal<unknown>, string>();
    const injectedClasses = new Set<string>();
    // Track which signals have been subscribed to prevent duplicates
    const subscribedSignals = new WeakSet<Signal<unknown>>();
    // Store pending bindings to apply after mount
    const pendingBindings: Array<{ signal: Signal<unknown>; varName: string }> = [];

    const applyBindings = (
      bindings: Array<{ signal: Signal<unknown>; varName: string }>,
      element: HTMLElement,
    ) => {
      for (const { signal, varName } of bindings) {
        // Always update the current value
        element.style.setProperty(varName, String(signal.value));

        // Only subscribe if not already subscribed (prevents duplicates)
        if (!subscribedSignals.has(signal)) {
          subscribedSignals.add(signal);
          const unsub = signal.subscribe((newValue: unknown) => {
            element.style.setProperty(varName, String(newValue));
          });
          subscriptions.add(unsub);
        }
      }
    };

    const registry: StyleAnchorRegistry = {
      signalVars,
      injectedClasses,
      anchorRef,

      processToken(token: StyleToken): string {
        // 1. Generate final CSS by replacing placeholders with var names
        let css = token.__cssTemplate;
        const bindings: Array<{ signal: Signal<unknown>; varName: string }> = [];

        if (token.__bindingDefs) {
          for (const def of token.__bindingDefs) {
            // Get or assign variable name for this signal
            let varName = signalVars.get(def.signal);
            if (!varName) {
              varName = `--sig-${uniqueId()}`;
              signalVars.set(def.signal, varName);
            }
            // Replace placeholder with var()
            css = css.replaceAll(`{{${def.index}}}`, `var(${varName})`);
            bindings.push({ signal: def.signal, varName });
          }
        }

        // 2. Inject CSS if className not already injected
        const className = token._;
        if (className && !injectedClasses.has(className)) {
          const injectionTarget = props.target ?? document.head;
          injectStyles(css, injectionTarget);
          injectedClasses.add(className);
        } else if (!className) {
          // For rules without className, use CSS content as key
          const cssKey = css;
          if (!injectedClasses.has(cssKey)) {
            const injectionTarget = props.target ?? document.head;
            injectStyles(css, injectionTarget);
            injectedClasses.add(cssKey);
          }
        }

        // 3. Set up signal subscriptions on the anchor element (or defer if not mounted)
        const anchorElement = anchorRef.value;
        if (bindings.length > 0) {
          if (anchorElement) {
            applyBindings(bindings, anchorElement);
          } else {
            pendingBindings.push(...bindings);
          }
        }

        return token._ ?? "";
      },

      addSubscription(unsub: () => void) {
        subscriptions.add(unsub);
      },
    };

    // Provide registry to descendants
    provide(StyleAnchorKey, registry);

    // Apply pending bindings after mount
    onMounted(() => {
      if (anchorRef.value && pendingBindings.length > 0) {
        applyBindings(pendingBindings, anchorRef.value);
        pendingBindings.length = 0;
      }
    });

    // Cleanup subscriptions on unmount
    onUnmounted(() => {
      subscriptions.forEach((unsub) => unsub());
      subscriptions.clear();
    });

    return () => h("div", { ref: anchorRef, style: { display: "contents" } }, slots.default?.());
  },
});

/**
 * Create a signal that works with Vue
 *
 * This is a wrapper around @semajsx/signal that works seamlessly
 * with the StyleAnchor for reactive CSS updates.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useStyle, useSignal } from "@semajsx/style/vue";
 * import { boxStyle } from "./box.style";
 *
 * const cx = useStyle();
 * const height = useSignal(100);
 * </script>
 *
 * <template>
 *   <div :class="cx(boxStyle({ height }))" @click="height.value += 10">
 *     Click to grow
 *   </div>
 * </template>
 * ```
 */
export function useSignal<T>(initialValue: T): Signal<T> {
  const signalInstance = createSignal(initialValue);

  // No need for special cleanup - signals are lightweight
  return signalInstance;
}

// Re-export commonly used types
export type { StyleToken, Signal };
