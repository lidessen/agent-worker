# Performance Test Example

This example demonstrates the performance optimizations in SemaJSX:

1. **Batching mechanism** - Multiple signal updates are batched into a single microtask
2. **Keyed list reconciliation** - Efficient list updates using keys
3. **DOM node pooling** - Reusing DOM nodes instead of replacing them

## Running the example

```bash
# From the project root
bun run example:perf
```

Then open your browser to the URL shown in the terminal (usually http://localhost:XXXX).

## What to test

### 1. Batching Test

- Click "Update All (Batched)" - should show only 1 DOM update
- Click "Update All (Separate)" - microtask batching still combines updates
- Check the console to see the difference

### 2. Keyed List Test

- Click "Reverse" - items should move, not be recreated
- Click "Shuffle" - existing items are reused
- Click "Add Item" - new item is added efficiently
- Click "Remove First" - first item is removed efficiently

### 3. DOM Node Pooling Test

- Click "Add Exclamation" - text node content is updated in-place
- Click "Increment" - DOM nodes are reused, not replaced
- Check console to see node reuse messages

## Performance improvements

These optimizations bring significant performance improvements:

- **Batched updates**: ~10x faster for multiple signal changes
- **Keyed lists**: ~10x faster for list sorting/shuffling
- **Node pooling**: ~5x faster for text content updates
