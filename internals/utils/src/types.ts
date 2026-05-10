/**
 * Represents a value that can be either T or null/undefined
 */
export type Maybe<T> = T | null | undefined;

/**
 * Makes all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Removes null and undefined from T
 */
export type NonNullish<T> = T extends null | undefined ? never : T;

/**
 * Get the type of elements in an array
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;
