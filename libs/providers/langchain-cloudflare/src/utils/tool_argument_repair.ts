import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

type Schema = Record<string, unknown>;
function isObject(value: unknown): value is Schema {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Unknown/conditional schemas must not authorize a coercion. This intentionally
// does not attempt to replace a JSON Schema validator or resolve references.
function allowsType(
  schema: unknown,
  type: "null" | "string"
): boolean | undefined {
  if (typeof schema === "boolean") return schema;
  if (!isObject(schema)) return undefined;
  if (
    ["$ref", "$dynamicRef", "not", "if", "then", "else"].some(
      (key) => key in schema
    )
  )
    return undefined;
  const constraints: (boolean | undefined)[] = [];
  if (typeof schema.type === "string") constraints.push(schema.type === type);
  else if (Array.isArray(schema.type))
    constraints.push(schema.type.includes(type));
  if ("const" in schema)
    constraints.push(
      type === "null" ? schema.const === null : typeof schema.const === "string"
    );
  if (Array.isArray(schema.enum))
    constraints.push(
      schema.enum.some((value) =>
        type === "null" ? value === null : typeof value === "string"
      )
    );
  for (const key of ["anyOf", "oneOf"] as const) {
    if (!Array.isArray(schema[key])) continue;
    const branches = schema[key].map((branch) => allowsType(branch, type));
    // oneOf must have exactly one matching branch for null. For strings,
    // any potentially matching branch prevents a repair.
    constraints.push(
      key === "oneOf" && type === "null"
        ? branches.includes(undefined)
          ? undefined
          : branches.filter(Boolean).length === 1
        : branches.includes(true)
          ? true
          : branches.includes(undefined)
            ? undefined
            : false
    );
  }
  if (Array.isArray(schema.allOf))
    constraints.push(...schema.allOf.map((branch) => allowsType(branch, type)));
  if (constraints.includes(false)) return false;
  return constraints.length && constraints.every((value) => value === true)
    ? true
    : undefined;
}

function repair(value: unknown, schema: unknown): unknown {
  if (!isObject(schema)) return value;
  if (
    ["$ref", "$dynamicRef", "not", "if", "then", "else"].some(
      (key) => key in schema
    )
  )
    return value;
  if (
    value === "null" &&
    allowsType(schema, "null") === true &&
    allowsType(schema, "string") === false
  )
    return null;
  // Applying object/array constraints across branches would require full schema
  // evaluation. Only traverse unambiguous properties and homogeneous items.
  if (["anyOf", "oneOf", "allOf"].some((key) => key in schema)) return value;
  if (isObject(value) && isObject(schema.properties)) {
    const properties = schema.properties;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        Object.hasOwn(properties, key) ? repair(child, properties[key]) : child,
      ])
    );
  }
  if (Array.isArray(value) && isObject(schema.items))
    return value.map((child) => repair(child, schema.items));
  return value;
}

function containsRepairableField(schema: unknown): boolean {
  if (!isObject(schema)) return false;
  if (
    allowsType(schema, "null") === true &&
    allowsType(schema, "string") === false
  )
    return true;
  return (
    (isObject(schema.properties) &&
      Object.values(schema.properties).some(containsRepairableField)) ||
    containsRepairableField(schema.items)
  );
}

/** Request-scoped schema lookup. No application-specific tool names. */
export function toolArgumentRepair(tools: BindToolsInput[] = []) {
  const schemas = new Map(
    tools.map((tool) => {
      const definition = convertToOpenAITool(tool).function;
      return [definition.name, definition.parameters] as const;
    })
  );
  return {
    bufferStreamArguments: [...schemas.values()].some(containsRepairableField),
    repair(name: string, args: string): string {
      const schema = schemas.get(name);
      if (!schema || !containsRepairableField(schema)) return args;
      try {
        const parsed: unknown = JSON.parse(args);
        const repaired = repair(parsed, schema);
        // Keep the original representation when no value changed.
        return JSON.stringify(parsed) === JSON.stringify(repaired)
          ? args
          : JSON.stringify(repaired);
      } catch {
        return args; // Preserve malformed JSON for LangChain's existing handling.
      }
    },
  };
}
