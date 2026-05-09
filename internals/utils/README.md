# @semajsx/utils

Shared utility functions and type helpers for SemaJSX packages.

## Installation

```bash
bun add @semajsx/utils
```

## Usage

```typescript
import { isDefined, isFunction, isObject } from "@semajsx/utils";

// Type guards
if (isDefined(value)) {
  // value is not null or undefined
}

if (isFunction(value)) {
  // value is a function
}

if (isObject(value)) {
  // value is an object (not null, not array)
}
```

## API

### Type Guards

- `isDefined<T>(value)` - Check if value is not null or undefined
- `isFunction(value)` - Check if value is a function
- `isObject(value)` - Check if value is an object (not null, not array)
- `isPlainObject(value)` - Check if value is a plain object
- `isString(value)` - Check if value is a string
- `isNumber(value)` - Check if value is a number
- `isBoolean(value)` - Check if value is a boolean

### Type Utilities

- `Maybe<T>` - Represents a value that can be either T or null/undefined
- `DeepPartial<T>` - Makes all properties of T optional recursively
- `NonNullish<T>` - Removes null and undefined from T
- `ArrayElement<T>` - Get the type of elements in an array

## License

MIT
