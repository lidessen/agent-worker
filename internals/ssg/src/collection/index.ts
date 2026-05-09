import type { z } from "zod";
import type { Collection, CollectionConfig } from "../types";

/**
 * Define a collection with schema validation
 */
export function defineCollection<T extends z.ZodType>(
  config: CollectionConfig<T>,
): Collection<z.infer<T>> {
  return {
    name: config.name,
    source: config.source,
    schema: config.schema,
  };
}

export type { Collection, CollectionConfig, CollectionEntry } from "../types";
