/**
 * JSON Schema to Zod conversion utilities
 * @module utils/schema
 */

/* oxlint-disable @typescript-eslint/no-explicit-any */
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { z } from "zod/v3";
import { WatsonxUnsupportedOperationError } from "../types.js";

/**
 * Converts a JSON Schema object to a Zod schema.
 * Supports common JSON Schema types: string, number, integer, float, boolean, array, and object.
 *
 * @param obj - The JSON Schema object to convert
 * @returns A Zod schema representing the JSON Schema
 * @throws {WatsonxUnsupportedOperationError} If the schema type is not supported
 *
 * @example
 * ```typescript
 * const jsonSchema = {
 *   type: "object",
 *   properties: {
 *     name: { type: "string", description: "User name" },
 *     age: { type: "number", minimum: 0, maximum: 120 }
 *   },
 *   required: ["name"]
 * };
 *
 * const zodSchema = jsonSchemaToZod(jsonSchema);
 * // Returns: z.object({ name: z.string().describe("User name"), age: z.number().min(0).lte(120).optional() })
 * ```
 */
export function jsonSchemaToZod(obj: WatsonXAI.JsonObject | undefined) {
  if (obj?.properties && obj.type === "object") {
    const shape: Record<string, any> = {};

    Object.keys(obj.properties).forEach((key) => {
      if (obj.properties) {
        const prop = obj.properties[key];

        let zodType;

        if (prop.type === "string") {
          zodType = z.string();
          if (prop?.pattern) {
            zodType = zodType.regex(prop.pattern, "Invalid pattern");
          }
        } else if (
          prop.type === "number" ||
          prop.type === "integer" ||
          prop.type === "float"
        ) {
          zodType = z.number();
          if (typeof prop?.minimum === "number") {
            zodType = zodType.min(prop.minimum, {
              message: `${key} must be at least ${prop.minimum}`,
            });
          }
          if (prop?.maximum) {
            zodType = zodType.lte(prop.maximum, {
              message: `${key} must be maximum of ${prop.maximum}`,
            });
          }
        } else if (prop.type === "boolean") {
          zodType = z.boolean();
        } else if (prop.type === "array") {
          zodType = z.array(
            prop.items ? jsonSchemaToZod(prop.items) : z.string()
          );
        } else if (prop.type === "object") {
          zodType = jsonSchemaToZod(prop);
        } else {
          throw new WatsonxUnsupportedOperationError(
            `Unsupported type: ${prop.type}`
          );
        }

        if (prop.description) {
          zodType = zodType.describe(prop.description);
        }

        if (!obj.required?.includes(key)) {
          zodType = zodType.optional();
        }

        shape[key] = zodType;
      }
    });

    return z.object(shape);
  }

  throw new WatsonxUnsupportedOperationError("Unsupported root schema type");
}
