/**
 * Schema definitions and utilities for Redis vector store indexing.
 *
 * This module provides types and utilities for defining metadata schemas,
 * vector field configurations, and index options for Redis vector stores.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/vectors/
 */

import type { createClient, RediSearchSchema } from "redis";
import { SchemaFieldTypes, VectorAlgorithms } from "redis";
import type { Document } from "@langchain/core/documents";

/**
 * Default separator character for Redis TAG fields in HASH documents.
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/advanced-concepts/tags/
 */
export const DEFAULT_TAG_SEPARATOR = ",";

/**
 * @deprecated Use MetadataFieldSchema instead. This interface is kept for backward compatibility.
 * Will be removed in the next major version.
 *
 * Legacy interface for custom schema field definitions.
 * This format used field names as object keys with configuration as values.
 *
 * @example
 * ```typescript
 * // Old format (deprecated)
 * const customSchema: Record<string, CustomSchemaField> = {
 *   userId: { type: SchemaFieldTypes.TAG, required: true },
 *   price: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true }
 * };
 *
 * // New format (recommended)
 * const customSchema: MetadataFieldSchema[] = [
 *   { name: "userId", type: "tag" },
 *   { name: "price", type: "numeric", options: { sortable: true } }
 * ];
 * ```
 */
export interface CustomSchemaField {
  type: SchemaFieldTypes;
  required?: boolean;
  SORTABLE?: boolean | "UNF";
  NOINDEX?: boolean;
  SEPARATOR?: string; // For TAG fields
  CASESENSITIVE?: true; // For TAG fields (Redis expects true, not boolean)
  NOSTEM?: true; // For TEXT fields (Redis expects true, not boolean)
  WEIGHT?: number; // For TEXT fields
}

// Adapted from internal redis types which aren't exported
/**
 * Type for creating a schema vector field. It includes the algorithm,
 * distance metric, and initial capacity.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/vectors/#search-with-vectors
 */
export type CreateSchemaVectorField<
  T extends VectorAlgorithms,
  A extends Record<string, unknown>,
> = {
  /** The vector indexing algorithm to use */
  ALGORITHM: T;
  /** The distance metric for similarity calculations */
  DISTANCE_METRIC: "L2" | "IP" | "COSINE";
  /** Initial capacity for the vector index */
  INITIAL_CAP?: number;
} & A;

/**
 * Type for creating a flat schema vector field.
 *
 * FLAT indexing performs brute-force search, which is accurate but slower for large datasets.
 * Best for smaller datasets or when exact results are required.
 *
 * @example
 * ```typescript
 * const flatIndex: CreateSchemaFlatVectorField = {
 *   ALGORITHM: VectorAlgorithms.FLAT,
 *   DISTANCE_METRIC: "COSINE",
 *   BLOCK_SIZE: 1000
 * };
 * ```
 */
export type CreateSchemaFlatVectorField = CreateSchemaVectorField<
  VectorAlgorithms.FLAT,
  {
    /** Block size for the flat index */
    BLOCK_SIZE?: number;
  }
>;

/**
 * Type for creating a HNSW schema vector field.
 *
 * HNSW (Hierarchical Navigable Small World) is an approximate nearest neighbor algorithm
 * that provides fast search with good recall. Best for large datasets.
 *
 * @example
 * ```typescript
 * const hnswIndex: CreateSchemaHNSWVectorField = {
 *   ALGORITHM: VectorAlgorithms.HNSW,
 *   DISTANCE_METRIC: "COSINE",
 *   M: 16,
 *   EF_CONSTRUCTION: 200,
 *   EF_RUNTIME: 10
 * };
 * ```
 */
export type CreateSchemaHNSWVectorField = CreateSchemaVectorField<
  VectorAlgorithms.HNSW,
  {
    /** Number of outgoing edges per node (default: 16) */
    M?: number;
    /** Number of neighbors to explore during construction (default: 200) */
    EF_CONSTRUCTION?: number;
    /** Number of neighbors to explore during search (default: 10) */
    EF_RUNTIME?: number;
  }
>;

/**
 * Internal type for Redis index creation options.
 * Extracted from the Redis client's ft.create method signature.
 */
export type CreateIndexOptions = NonNullable<
  Parameters<ReturnType<typeof createClient>["ft"]["create"]>[3]
>;

/**
 * Supported languages for RediSearch text indexing.
 */
export type RedisSearchLanguages = `${NonNullable<
  CreateIndexOptions["LANGUAGE"]
>}`;

/**
 * Options for creating a Redis vector store index.
 *
 * These options control various aspects of index creation including
 * language settings, stopwords, and index behavior.
 */
export type RedisVectorStoreIndexOptions = Omit<
  CreateIndexOptions,
  "LANGUAGE"
> & { LANGUAGE?: RedisSearchLanguages };

/**
 * Metadata field schema definition for proper indexing.
 *
 * Defines how individual metadata fields should be indexed in Redis.
 * Each field can have a specific type (tag, text, numeric, geo)
 * and type-specific options.
 *
 * Note: For timestamp fields, use type "numeric" and store values as Unix epoch timestamps.
 * The serialization/deserialization utilities will automatically handle Date object conversion.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/
 *
 * @example
 * ```typescript
 * const schema: MetadataFieldSchema[] = [
 *   { name: "category", type: "tag", options: { separator: "," } },
 *   { name: "price", type: "numeric", options: { sortable: true } },
 *   { name: "description", type: "text", options: { weight: 2.0 } },
 *   { name: "location", type: "geo" },
 *   { name: "created_at", type: "numeric", options: { sortable: true } } // For timestamps
 * ];
 * ```
 */
export interface MetadataFieldSchema {
  /** Field name in the metadata */
  name: string;
  /**
   * Field type for indexing.
   * - tag: For categorical data with low cardinality (e.g., categories, labels)
   * - text: For full-text search on human language text
   * - numeric: For numeric values and timestamps (use Unix epoch for timestamps)
   * - geo: For geographical coordinates (longitude, latitude)
   */
  type: "tag" | "text" | "numeric" | "geo";
  /** Additional field options */
  options?: {
    /** For tag fields: separator character (default: DEFAULT_TAG_SEPARATOR which is ",") */
    separator?: string;
    /** For tag fields: case-sensitive matching (default: false) */
    caseSensitive?: boolean;
    /** For text fields: weight for scoring (default: 1.0) */
    weight?: number;
    /** For text fields: disable stemming (default: false) */
    noStem?: boolean;
    /** For numeric fields: whether to enable sorting (default: false) */
    sortable?: boolean;
    /** For all fields: whether to index the field (default: true, set to true to disable indexing) */
    noindex?: boolean;
  };
}

/**
 * Builds a RediSearch schema from metadata field definitions.
 *
 * This function builds up a schema based on the metadata field schema definitions.
 *
 * @param metadataSchema - Array of metadata field schema definitions
 * @param defaultSchema - the default RediSearchSchema without considering metadata fields
 * @returns a new RediSearchSchema with metadata fields added
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/schema-definition/
 *
 * @example
 * ```typescript
 * const schema: RediSearchSchema = {
 *   content_vector: { type: SchemaFieldTypes.VECTOR, ... },
 *   content: SchemaFieldTypes.TEXT
 * };
 *
 * const metadataSchema: MetadataFieldSchema[] = [
 *   { name: "category", type: "tag" },
 *   { name: "price", type: "numeric", options: { sortable: true } }
 * ];
 *
 * const updatedSchema = buildMetadataSchema(metadataSchema, schema);
 * // updatedSchema includes category and price fields
 * ```
 */
export function buildMetadataSchema(
  metadataSchema: MetadataFieldSchema[],
  defaultSchema: RediSearchSchema
): RediSearchSchema {
  // Create a new schema object to avoid mutating the input parameter
  const updatedSchema = { ...defaultSchema };

  for (const fieldSchema of metadataSchema) {
    switch (fieldSchema.type) {
      case "tag": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tagOptions: any = {
          type: SchemaFieldTypes.TAG,
          SEPARATOR: fieldSchema.options?.separator || DEFAULT_TAG_SEPARATOR,
        };
        if (fieldSchema.options?.caseSensitive) {
          tagOptions.CASESENSITIVE = true;
        }
        if (fieldSchema.options?.noindex) {
          tagOptions.NOINDEX = true;
        }
        updatedSchema[fieldSchema.name] = tagOptions;
        break;
      }
      case "text": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textOptions: any = {
          type: SchemaFieldTypes.TEXT,
        };
        if (fieldSchema.options?.weight !== undefined) {
          textOptions.WEIGHT = fieldSchema.options.weight;
        }
        if (fieldSchema.options?.noStem) {
          textOptions.NOSTEM = true;
        }
        if (fieldSchema.options?.noindex) {
          textOptions.NOINDEX = true;
        }
        if (fieldSchema.options?.sortable) {
          textOptions.SORTABLE = true;
        }
        updatedSchema[fieldSchema.name] = textOptions;
        break;
      }
      case "numeric": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numericOptions: any = {
          type: SchemaFieldTypes.NUMERIC,
        };
        if (fieldSchema.options?.sortable) {
          numericOptions.SORTABLE = true;
        }
        if (fieldSchema.options?.noindex) {
          numericOptions.NOINDEX = true;
        }
        updatedSchema[fieldSchema.name] = numericOptions;
        break;
      }
      case "geo": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoOptions: any = {
          type: SchemaFieldTypes.GEO,
        };
        if (fieldSchema.options?.noindex) {
          geoOptions.NOINDEX = true;
        }
        updatedSchema[fieldSchema.name] = geoOptions;
        break;
      }
      default:
        // Default to text for unknown types
        updatedSchema[fieldSchema.name] = {
          type: SchemaFieldTypes.TEXT,
        };
    }
  }

  return updatedSchema;
}

/**
 * Serializes metadata field values for storage in Redis based on field type.
 *
 * Converts JavaScript values to the appropriate format for Redis storage:
 * - Tag fields: Arrays joined with separator, or string values
 * - Text fields: String values
 * - Numeric fields: Number values (Date objects are automatically converted to Unix epoch timestamps in seconds)
 * - Geo fields: "longitude,latitude" string format
 * - Geoshape fields: WKT (Well-Known Text) format strings
 *
 * @param fieldSchema - The metadata field schema definition
 * @param fieldValue - The value to serialize
 * @returns The serialized value ready for Redis storage
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/
 *
 * @example
 * ```typescript
 * const tagSchema = { name: "category", type: "tag" as const };
 * serializeMetadataField(tagSchema, ["electronics", "gadgets"]);
 * // Returns: "electronics|gadgets"
 *
 * const geoSchema = { name: "location", type: "geo" as const };
 * serializeMetadataField(geoSchema, [-122.4194, 37.7749]);
 * // Returns: "-122.4194,37.7749"
 *
 * const geoshapeSchema = { name: "area", type: "geoshape" as const };
 * serializeMetadataField(geoshapeSchema, "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))");
 * // Returns: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))"
 *
 * const numericSchema = { name: "created_at", type: "numeric" as const };
 * serializeMetadataField(numericSchema, new Date("2023-01-01"));
 * // Returns: 1672531200 (Unix epoch timestamp in seconds)
 *
 * serializeMetadataField(numericSchema, 42);
 * // Returns: 42
 * ```
 */
export function serializeMetadataField(
  fieldSchema: MetadataFieldSchema,
  fieldValue: unknown
): string | number {
  switch (fieldSchema.type) {
    case "tag":
      return Array.isArray(fieldValue)
        ? fieldValue.join(
            fieldSchema.options?.separator || DEFAULT_TAG_SEPARATOR
          )
        : String(fieldValue);
    case "text":
      return String(fieldValue);
    case "numeric": {
      // Convert Date objects to Unix epoch timestamps (seconds)
      // Check if it's a Date by checking for getTime method
      if (
        fieldValue &&
        typeof fieldValue === "object" &&
        "getTime" in fieldValue &&
        typeof (fieldValue as Date).getTime === "function"
      ) {
        return Math.floor((fieldValue as Date).getTime() / 1000);
      }
      return Number(fieldValue);
    }
    case "geo":
      // Expect geo values as "longitude,latitude" string or [lon, lat] array
      if (Array.isArray(fieldValue) && fieldValue.length === 2) {
        return `${fieldValue[0]},${fieldValue[1]}`;
      }
      return String(fieldValue);
    default:
      return String(fieldValue);
  }
}

/**
 * Deserializes metadata field values from Redis storage based on field type.
 *
 * Converts Redis-stored values back to JavaScript types:
 * - Tag fields: Splits separator-delimited strings back to arrays (if separator is present)
 * - Numeric fields: Converts to numbers (keeps as number, does NOT convert to Date)
 * - Geo fields: Converts "longitude,latitude" strings to [lon, lat] arrays
 * - Text fields: Returns as-is
 *
 * Note: Numeric fields are returned as numbers. If you stored a Date object as a Unix epoch
 * timestamp, you'll need to manually convert it back to a Date object if needed:
 * `new Date(numericValue * 1000)`
 *
 * @param fieldSchema - The metadata field schema definition
 * @param fieldValue - The value from Redis to deserialize
 * @returns The deserialized value in JavaScript format
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/
 *
 * @example
 * ```typescript
 * const tagSchema = { name: "category", type: "tag" as const };
 * deserializeMetadataField(tagSchema, "electronics|gadgets");
 * // Returns: ["electronics", "gadgets"]
 *
 * const geoSchema = { name: "location", type: "geo" as const };
 * deserializeMetadataField(geoSchema, "-122.4194,37.7749");
 * // Returns: [-122.4194, 37.7749]
 *
 * const geoshapeSchema = { name: "area", type: "geoshape" as const };
 * deserializeMetadataField(geoshapeSchema, "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))");
 * // Returns: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))"
 *
 * const numericSchema = { name: "created_at", type: "numeric" as const };
 * deserializeMetadataField(numericSchema, "1672531200");
 * // Returns: 1672531200 (number)
 * // To convert to Date: new Date(1672531200 * 1000)
 *
 * deserializeMetadataField(numericSchema, "42");
 * // Returns: 42
 * ```
 */
export function deserializeMetadataField(
  fieldSchema: MetadataFieldSchema,
  fieldValue: unknown
): unknown {
  if (fieldValue === undefined || fieldValue === null) {
    return fieldValue;
  }

  switch (fieldSchema.type) {
    case "tag": {
      // Convert back from separator-delimited string if needed
      const separator = fieldSchema.options?.separator || DEFAULT_TAG_SEPARATOR;
      if (typeof fieldValue === "string" && fieldValue.includes(separator)) {
        return fieldValue.split(separator);
      }
      return fieldValue;
    }
    case "numeric":
      // Return as number (do not convert to Date automatically)
      return Number(fieldValue);
    case "geo":
      // Convert back to [longitude, latitude] array if it's a string
      if (typeof fieldValue === "string" && fieldValue.includes(",")) {
        const [lon, lat] = fieldValue.split(",").map(Number);
        return [lon, lat];
      }
      return fieldValue;
    default:
      return fieldValue;
  }
}

/**
 * Infers metadata schema from a collection of documents by analyzing their metadata fields.
 *
 * This function examines the metadata of all provided documents and attempts to infer
 * the appropriate field type for each metadata key based on the values found.
 *
 * Type inference rules:
 * - Strings in "lon,lat" format → geo
 * - Numbers or Date objects → numeric
 * - Array of any type → tag
 * - All other types → text
 *
 * @param documents - Array of documents to analyze
 * @returns Array of inferred metadata field schemas
 *
 * @example
 * ```typescript
 * const documents = [
 *   { pageContent: "...", metadata: { category: "electronics", price: 99 } },
 *   { pageContent: "...", metadata: { category: "books", price: 15 } },
 * ];
 *
 * const schema = inferMetadataSchema(documents);
 * // Returns: [
 * //   { name: "text", type: "tag" },
 * //   { name: "price", type: "numeric" }
 * // ]
 * ```
 */
export function inferMetadataSchema(
  documents: Document[]
): MetadataFieldSchema[] {
  if (!documents || documents.length === 0) {
    return [];
  }

  // Collect all metadata fields and their values (preserve duplicates for cardinality analysis)
  const fieldValues = new Map<string, unknown[]>();

  for (const doc of documents) {
    if (!doc.metadata || typeof doc.metadata !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(doc.metadata)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (!fieldValues.has(key)) {
        fieldValues.set(key, []);
      }
      fieldValues.get(key)!.push(value);
    }
  }

  // Infer type for each field
  const schema: MetadataFieldSchema[] = [];

  for (const [fieldName, values] of fieldValues.entries()) {
    const fieldType = inferFieldType(values);
    schema.push({ name: fieldName, type: fieldType });
  }

  return schema;
}

/**
 * Checks if two metadata schemas have a mismatch.
 *
 * This function compares two metadata schema arrays to determine if they contain
 * the same fields with matching types. The comparison is order-independent and
 * only considers the non-optional properties (name and type) of each field.
 *
 * @param customSchema - The custom metadata schema to compare
 * @param inferredSchema - The inferred metadata schema to compare against
 * @returns `true` if there is a mismatch, `false` if the schemas match
 *
 * @example
 * ```typescript
 * const customSchema = [
 *   { name: "category", type: "tag" },
 *   { name: "price", type: "numeric" }
 * ];
 *
 * const inferredSchema = [
 *   { name: "price", type: "numeric" },
 *   { name: "category", type: "tag" }
 * ];
 *
 * checkForSchemaMismatch(customSchema, inferredSchema);
 * // Returns: false (schemas match, order doesn't matter)
 *
 * const mismatchedSchema = [
 *   { name: "category", type: "text" }, // Different type
 *   { name: "price", type: "numeric" }
 * ];
 *
 * checkForSchemaMismatch(customSchema, mismatchedSchema);
 * // Returns: true (type mismatch for "category")
 * ```
 */
export function checkForSchemaMismatch(
  customSchema: MetadataFieldSchema[],
  inferredSchema: MetadataFieldSchema[]
): boolean {
  // If lengths differ, there's a mismatch
  if (customSchema.length !== inferredSchema.length) {
    return true;
  }

  // Create a map of inferred schema fields by name for quick lookup
  const inferredMap = new Map<string, MetadataFieldSchema>();
  for (const field of inferredSchema) {
    inferredMap.set(field.name, field);
  }

  // Check if all custom schema fields exist in inferred schema with matching type
  for (const customField of customSchema) {
    const inferredField = inferredMap.get(customField.name);

    // If field doesn't exist in inferred schema, there's a mismatch
    if (!inferredField) {
      return true;
    }

    // Compare non-optional properties: name and type
    if (customField.type !== inferredField.type) {
      return true;
    }
  }

  // All fields match
  return false;
}

/**
 * Infers the appropriate field type for a metadata field based on its values.
 *
 * @param values - Array of sample values for this field
 * @returns The inferred field type
 */
function inferFieldType(values: unknown[]): "tag" | "text" | "numeric" | "geo" {
  if (values.length === 0) {
    return "text"; // Default fallback
  }

  // Check if all values are geo coordinates
  const allGeo = values.every((value) => isGeoCoordinate(value));
  if (allGeo) {
    return "geo";
  }

  // Check if all values are numeric or dates
  const allNumeric = values.every((value) => isNumberOrDate(value));
  if (allNumeric) {
    return "numeric";
  }

  const allArrays = values.every((value) => Array.isArray(value));
  if (allArrays) {
    return "tag";
  }

  // Default to text for all other types
  return "text";
}

/**
 * Checks if a value represents a geo coordinate.
 *
 * @param value - The value to check
 * @returns True if the value is a geo coordinate
 */
function isGeoCoordinate(value: unknown): boolean {
  // Check for "longitude,latitude" string format
  if (typeof value === "string") {
    const parts = value.split(",");
    if (parts.length === 2) {
      const lon = parseFloat(parts[0].trim());
      const lat = parseFloat(parts[1].trim());
      return !Number.isNaN(lon) && !Number.isNaN(lat);
    }
  }

  return false;
}

/**
 * Checks if a value is a number or a Date object.
 *
 * @param value - The value to check
 * @returns True if the value is a number or Date
 */
function isNumberOrDate(value: unknown): boolean {
  return (
    typeof value === "number" ||
    (typeof value === "object" &&
      value !== null &&
      "getTime" in value &&
      typeof (value as Date).getTime === "function")
  );
}

/**
 * Converts legacy CustomSchemaField format to new MetadataFieldSchema format.
 *
 * This function provides backward compatibility by converting the old Record-based
 * schema format to the new array-based format. It also emits a deprecation warning.
 *
 * @param metadataKey the custom metadata key prefix
 * @param legacySchema - The legacy schema in Record<string, CustomSchemaField> format
 * @returns The converted schema in MetadataFieldSchema[] format
 *
 * @example
 * ```typescript
 * const legacySchema = {
 *   userId: { type: SchemaFieldTypes.TAG, SEPARATOR: "|" },
 *   price: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true }
 * };
 *
 * const newSchema = convertLegacySchema(legacySchema);
 * // Returns: [
 * //   { name: "userId", type: "tag", options: { separator: "|" } },
 * //   { name: "price", type: "numeric", options: { sortable: true } }
 * // ]
 * ```
 */
export function convertLegacySchema(
  metadataKey: string,
  legacySchema: Record<string, CustomSchemaField>
): MetadataFieldSchema[] {
  console.warn(
    "DEPRECATION WARNING: The Record<string, CustomSchemaField> format for customSchema is deprecated. " +
      "Please migrate to the new MetadataFieldSchema[] format. " +
      "See https://js.langchain.com/docs/integrations/vectorstores/redis for migration guide. " +
      "This legacy format will be removed in the next major version."
  );

  const convertedSchema: MetadataFieldSchema[] = [];

  for (const [fieldName, fieldConfig] of Object.entries(legacySchema)) {
    // Map SchemaFieldTypes to simplified type strings
    let type: "tag" | "text" | "numeric" | "geo";
    switch (fieldConfig.type) {
      case SchemaFieldTypes.TAG:
        type = "tag";
        break;
      case SchemaFieldTypes.TEXT:
        type = "text";
        break;
      case SchemaFieldTypes.NUMERIC:
        type = "numeric";
        break;
      case SchemaFieldTypes.GEO:
        type = "geo";
        break;
      default:
        // Default to text for unknown types
        type = "text";
        console.warn(
          `Unknown field type ${fieldConfig.type} for field ${fieldName}, defaulting to "text"`
        );
    }

    // Build options object from legacy properties
    const options: MetadataFieldSchema["options"] = {};

    if (fieldConfig.SEPARATOR !== undefined) {
      options.separator = fieldConfig.SEPARATOR;
    }
    if (fieldConfig.CASESENSITIVE !== undefined) {
      options.caseSensitive = fieldConfig.CASESENSITIVE;
    }
    if (fieldConfig.WEIGHT !== undefined) {
      options.weight = fieldConfig.WEIGHT;
    }
    if (fieldConfig.NOSTEM !== undefined) {
      options.noStem = fieldConfig.NOSTEM;
    }
    if (fieldConfig.SORTABLE !== undefined) {
      // Convert SORTABLE to boolean (ignore "UNF" value for simplicity)
      options.sortable =
        fieldConfig.SORTABLE === true || fieldConfig.SORTABLE === "UNF";
    }
    if (fieldConfig.NOINDEX !== undefined) {
      options.noindex = fieldConfig.NOINDEX;
    }

    convertedSchema.push({
      name: `${metadataKey}.${fieldName}`,
      type,
      ...(Object.keys(options).length > 0 ? { options } : {}),
    });
  }

  return convertedSchema;
}
