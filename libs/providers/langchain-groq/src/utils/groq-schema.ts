/**
 * Groq JSON Schema Strict Mode Transformation
 *
 * Groq's strict JSON Schema mode has specific requirements:
 * 1. additionalProperties: false on all objects
 * 2. ALL properties must be in the `required` array
 * 3. Optional properties must be nullable (type union with "null")
 * 4. Root schema cannot have anyOf/oneOf/enum/not
 *
 * @see https://console.groq.com/docs/structured-outputs
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonSchema = Record<string, any>;

/**
 * Make a schema nullable using type array syntax (NOT anyOf).
 * Groq strict mode forbids anyOf at top level, so we use type: [T, "null"].
 * Handles: simple types, enums, anyOf, arrays, and objects.
 * Unknown schema structures (e.g., `$ref`) are returned unchanged.
 */
function makeNullable(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== "object") return schema;

  // Already nullable
  if (schema.type === "null") return schema;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return schema;

  // Enum: add null to enum values and type
  if (Array.isArray(schema.enum)) {
    const nextEnum = schema.enum.includes(null)
      ? schema.enum
      : [...schema.enum, null];
    const baseType = Array.isArray(schema.type)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema.type.filter((t: any) => t !== "null")
      : typeof schema.type === "string"
        ? [schema.type]
        : ["string"]; // Default to string for enums
    const nextType = Array.from(new Set([...baseType, "null"]));
    return { ...schema, type: nextType, enum: nextEnum };
  }

  // anyOf: flatten to type array if possible, otherwise add null variant
  if (Array.isArray(schema.anyOf)) {
    const hasNull = schema.anyOf.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) =>
        s?.type === "null" ||
        (Array.isArray(s?.type) && s.type.includes("null"))
    );
    if (hasNull) return schema;

    // Try to extract types from anyOf and use type array instead
    const types = schema.anyOf
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => s?.type)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t && typeof t === "string");

    if (types.length === schema.anyOf.length) {
      // All variants are simple types - can convert to type array
      const { anyOf: _, ...rest } = schema;
      return { ...rest, type: [...types, "null"] };
    }

    // Complex anyOf - add null variant (but this should be avoided at root)
    return { ...schema, anyOf: [...schema.anyOf, { type: "null" }] };
  }

  // Simple type: convert to array with null
  if (typeof schema.type === "string") {
    return { ...schema, type: [schema.type, "null"] };
  }

  // Type array: add null
  if (Array.isArray(schema.type)) {
    return { ...schema, type: Array.from(new Set([...schema.type, "null"])) };
  }

  // Has properties but no type - it's an object
  if (schema.properties) {
    return { ...schema, type: ["object", "null"] };
  }

  // Unknown schema structure (e.g., $ref) - return unchanged
  return schema;
}

/**
 * Transform a JSON Schema to be Groq strict-mode compatible.
 *
 * Recursively:
 * 1. Sets additionalProperties: false on all objects
 * 2. Moves all properties to required array
 * 3. Makes previously optional properties nullable
 * 4. Throws if root schema has oneOf/not; extracts object variant from anyOf (Groq forbids these at top level)
 *
 * @param schema - The schema to transform
 * @param isRoot - Whether this is the root schema (default: true on first call)
 */
export function groqStrictifySchema(
  schema: JsonSchema,
  isRoot = true
): JsonSchema {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return schema.map((s) => groqStrictifySchema(s, false)) as any;

  // Deep clone to avoid mutating original
  const result = { ...schema };

  // Recurse into compound schemas (NOT root after this)
  for (const k of ["anyOf", "oneOf", "allOf"]) {
    if (Array.isArray(result[k])) {
      result[k] = result[k].map((s: JsonSchema) =>
        groqStrictifySchema(s, false)
      );
    }
  }

  // Recurse into array items
  if (result.items) {
    result.items = groqStrictifySchema(result.items, false);
  }

  // Recurse into $defs (definitions)
  if (result.$defs) {
    result.$defs = { ...result.$defs };
    for (const key of Object.keys(result.$defs)) {
      result.$defs[key] = groqStrictifySchema(result.$defs[key], false);
    }
  }

  // Check if this is an object schema
  const isObject =
    result.type === "object" ||
    (Array.isArray(result.type) && result.type.includes("object")) ||
    result.properties;

  if (isObject && result.properties && typeof result.properties === "object") {
    // Set additionalProperties: false for strict mode
    result.additionalProperties = false;

    const propKeys = Object.keys(result.properties);
    const prevRequired = new Set<string>(
      Array.isArray(result.required) ? result.required : []
    );

    // Clone and transform properties
    result.properties = { ...result.properties };

    for (const key of propKeys) {
      // Recursively strictify nested schemas
      result.properties[key] = groqStrictifySchema(
        result.properties[key],
        false
      );

      // If property was optional (not in required), make it nullable
      if (!prevRequired.has(key)) {
        result.properties[key] = makeNullable(result.properties[key]);
      }
    }

    // All properties must be required in strict mode
    result.required = propKeys;
  }

  // ROOT PROTECTION: Groq forbids anyOf/oneOf/enum/not at top level
  if (isRoot) {
    // If root has anyOf, extract the object variant
    if (Array.isArray(result.anyOf)) {
      const objectVariant = result.anyOf.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => s?.type === "object" || s?.properties
      );
      if (objectVariant) {
        // Replace root with the object variant
        const cleaned = groqStrictifySchema(objectVariant, true);
        return { ...cleaned, type: "object" };
      }
      // No object variant found - schema can't be used with Groq strict mode
      throw new Error(
        "Groq strict mode requires the root schema to be an object type, " +
          "but the schema has anyOf/oneOf with no object variant."
      );
    }

    // Throw for oneOf/not at root (Groq forbids these)
    if (result.oneOf) {
      throw new Error(
        "Groq strict mode does not support oneOf at the root schema level."
      );
    }
    if (result.not) {
      throw new Error(
        "Groq strict mode does not support 'not' at the root schema level."
      );
    }

    if (result.properties) {
      result.type = "object";
    }
  }

  return result;
}

/**
 * Check if a model supports native JSON Schema structured output.
 * Uses prefix matching so new gpt-oss models are automatically supported.
 */
function supportsJsonSchema(model: string): boolean {
  return model.startsWith("openai/gpt-oss");
}

/**
 * Supported structured output methods for Groq.
 */
export const SUPPORTED_STRUCTURED_OUTPUT_METHODS = [
  "jsonSchema",
  "functionCalling",
  "jsonMode",
] as const;

export type GroqStructuredOutputMethod =
  (typeof SUPPORTED_STRUCTURED_OUTPUT_METHODS)[number];

/**
 * Get the structured output method for a given Groq model.
 *
 * - Returns `jsonSchema` if the model supports native JSON Schema and no method is specified
 * - Throws if an invalid method is provided
 * - Throws if `jsonSchema` is requested for a model that doesn't support it
 *
 * @param model - The model name
 * @param method - Optional method override
 * @returns The structured output method to use
 */
export function getGroqStructuredOutputMethod(
  model: string,
  method?: string
): GroqStructuredOutputMethod {
  // Validate method if provided
  if (
    method !== undefined &&
    !SUPPORTED_STRUCTURED_OUTPUT_METHODS.includes(
      method as GroqStructuredOutputMethod
    )
  ) {
    throw new Error(
      `Invalid structured output method: ${method}. Supported methods are: ${SUPPORTED_STRUCTURED_OUTPUT_METHODS.join(", ")}`
    );
  }

  const modelSupportsJsonSchema = supportsJsonSchema(model);

  // If model supports JSON Schema and no method specified, use it by default
  if (modelSupportsJsonSchema && !method) {
    return "jsonSchema";
  }

  // If jsonSchema requested but not supported, throw
  if (!modelSupportsJsonSchema && method === "jsonSchema") {
    throw new Error(
      `Native JSON Schema structured output is not supported for model "${model}". ` +
        `Only models with the "openai/gpt-oss" prefix are supported. ` +
        `Use "functionCalling" or "jsonMode" instead.`
    );
  }

  // Return the specified method or default to functionCalling
  return (method as GroqStructuredOutputMethod) ?? "functionCalling";
}
