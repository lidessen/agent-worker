import type { Signal } from "@semajsx/signal";
import type { Ref } from "@semajsx/core";
import { isSignal } from "@semajsx/signal";
import { isStyleToken, inject, type StyleToken } from "@semajsx/style";

/**
 * Class value type - can be string, StyleToken, array, or falsy
 */
type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

/**
 * Resolve a class value to a string
 *
 * Supports:
 * - Strings: returned as-is
 * - StyleTokens: injects CSS and returns className
 * - Arrays: recursively resolves all values
 * - Falsy values: filtered out
 *
 * @example
 * resolveClass("btn") // "btn"
 * resolveClass(button.root) // "root-x7f3a" (injects CSS)
 * resolveClass([button.root, "custom", isLarge && button.large]) // "root-x7f3a custom large-y8g4b"
 */
function resolveClass(value: ClassValue): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (isStyleToken(value)) {
    // Inject CSS for the token
    inject(value);
    // Return the className (or empty string if none)
    return value._ ?? "";
  }

  if (Array.isArray(value)) {
    // Recursively resolve array values, filter empty strings
    return value.map(resolveClass).filter(Boolean).join(" ");
  }

  return "";
}

/**
 * Set a property on an element
 */
export function setProperty(element: Element, key: string, value: unknown): void {
  // Skip internal props
  if (key === "key" || key === "ref" || key === "children") {
    return;
  }

  // Handle events
  if (key.startsWith("on") && typeof value === "function") {
    const eventName = key.toLowerCase().substring(2); // "onClick" -> "click"

    // Use addEventListener instead of property assignment for better reliability
    // especially in hydration scenarios
    const element_any = element as any;

    // Remove old listener if exists (stored on element)
    const oldListener = element_any[`__${key}`];
    if (oldListener) {
      element.removeEventListener(eventName, oldListener);
    }

    // Add new listener and store reference for future cleanup
    element.addEventListener(eventName, value as EventListener);
    element_any[`__${key}`] = value;

    return;
  }

  // Handle className/class with StyleToken support
  if (key === "className" || key === "class") {
    if (value == null) {
      element.removeAttribute("class");
      return;
    }

    // Resolve class value (may be string, StyleToken, or array)
    const resolvedClass = resolveClass(value as ClassValue);
    if (resolvedClass) {
      element.setAttribute("class", resolvedClass);
    } else {
      element.removeAttribute("class");
    }
    return;
  }

  // Handle style
  if (key === "style" && element instanceof HTMLElement) {
    if (typeof value === "string") {
      element.style.cssText = value;
    } else if (typeof value === "object" && value !== null) {
      Object.assign(element.style, value);
    }
    return;
  }

  // Handle special boolean attributes
  if (typeof value === "boolean") {
    if (value) {
      element.setAttribute(key, "");
    } else {
      element.removeAttribute(key);
    }
    return;
  }

  // Handle value for form elements
  if (key === "value") {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      element.value = String(value ?? "");
      return;
    }
  }

  // Handle checked for checkboxes
  if (key === "checked" && element instanceof HTMLInputElement) {
    element.checked = Boolean(value);
    return;
  }

  // Default: set as attribute
  if (value == null) {
    element.removeAttribute(key);
  } else {
    element.setAttribute(key, String(value));
  }
}

/**
 * Set a signal property on an element
 */
export function setSignalProperty<T = unknown>(
  element: Element,
  key: string,
  signal: Signal<T>,
): () => void {
  // Set initial value
  setProperty(element, key, signal.value);

  // Subscribe to changes and update property
  return signal.subscribe((value: T) => {
    setProperty(element, key, value);
  });
}

/**
 * Set a ref on an element
 * - Supports both Signal refs and callback refs
 * - Returns a cleanup function to clear the ref
 */
export function setRef(element: Node, ref: Ref<any>): () => void {
  // Signal ref
  if (isSignal(ref)) {
    ref.value = element;
    return () => {
      ref.value = null;
    };
  }

  // Callback ref
  if (typeof ref === "function") {
    ref(element);
    return () => {
      ref(null);
    };
  }

  // Invalid ref type
  return () => {};
}
