/**
 * @semajsx/utils - Shared utility functions for SemaJSX
 */

// Type utilities
export type { Maybe, DeepPartial, NonNullish, ArrayElement } from "./types";

// Type guards
export {
  isDefined,
  isFunction,
  isObject,
  isPlainObject,
  isString,
  isNumber,
  isBoolean,
} from "./guards";
