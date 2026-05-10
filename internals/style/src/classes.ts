/**
 * Class name generation for @semajsx/style
 */

import type { ClassRef, ClassRefs } from "./types";

/**
 * Symbol used to identify ClassRef objects
 */
const CLASS_REF_BRAND = Symbol.for("@semajsx/style/classRef");

/**
 * Monotonic counter to ensure unique class names even when classes() is called
 * multiple times in the same millisecond (e.g., multiple component modules).
 */
let classCounter = 0;

/**
 * Create class name references with hashed values
 *
 * @example
 * ```ts
 * const c = classes(["root", "icon", "label"]);
 *
 * c.root.toString(); // "root-x7f3a"
 * `${c.root}`;       // "root-x7f3a"
 * ```
 */
export function classes<T extends readonly string[]>(names: T): ClassRefs<T> {
  const result = {} as Record<string, ClassRef>;

  for (const name of names) {
    const id = (++classCounter).toString(36);
    const className = `${name}-${id}`;

    const ref: ClassRef = {
      id: Symbol(className),
      toString() {
        return className;
      },
    };

    // Add brand for type checking
    Object.defineProperty(ref, CLASS_REF_BRAND, { value: true });

    result[name] = ref;
  }

  return result as ClassRefs<T>;
}

/**
 * Check if a value is a ClassRef
 */
export function isClassRef(value: unknown): value is ClassRef {
  return (
    value != null &&
    typeof value === "object" &&
    CLASS_REF_BRAND in value &&
    (value as Record<symbol, unknown>)[CLASS_REF_BRAND] === true
  );
}
