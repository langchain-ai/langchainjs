import { z } from "zod";
import { isInteropZodError } from "@langchain/core/utils/types";
import {
  toolCallModificationSchema,
  toolCallResultModificationSchema,
} from "./hooks.js";
import type {
  CallToolResult,
  ContentBlock as MCPContentBlock,
  Client as MCPClient,
  EmbeddedResource,
  ReadResourceResult,
  Tool as MCPTool,
  ListToolsResult,
  RequestOptions,
} from "@modelcontextprotocol/client";
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { ContentBlock } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import type { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { ToolMessage } from "@langchain/core/messages";
import {
  isCommand,
  getCurrentTaskInput,
  type Command,
} from "@langchain/langgraph";

import type { Notifications } from "./types.js";

import {
  _resolveDetailedOutputHandling,
  callToolResultContentTypes,
  type CallToolResultContentType,
  type LoadMcpToolsOptions,
  type OutputHandling,
} from "./types.js";
import type { ToolHooks, State } from "./hooks.js";
import type { Client } from "./connection.js";
import { getDebugLog } from "./logging.js";

const debugLog = getDebugLog("tools");

/**
 * JSON Schema type definitions for dereferencing $defs.
 */
type JsonSchemaObject = Record<string, unknown>;

function isSchemaRecord(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const requiredFieldsSchema = z.array(z.string());

function requiredFields(value: unknown): string[] {
  const result = requiredFieldsSchema.safeParse(value);
  return result.success ? result.data : [];
}

/**
 * Dereferences $ref pointers in a JSON Schema by inlining the definitions from $defs.
 * This is necessary because some JSON Schema validators (like @cfworker/json-schema)
 * don't automatically resolve $ref references to $defs.
 *
 * @param schema - The JSON Schema to dereference
 * @returns A new schema with all $ref pointers resolved
 */
function dereferenceJsonSchema(schema: JsonSchemaObject): JsonSchemaObject {
  const rawDefinitions = schema.$defs ?? schema.definitions;
  const definitions = isSchemaRecord(rawDefinitions) ? rawDefinitions : {};

  /**
   * Recursively resolve $ref pointers in the schema.
   * Tracks visited refs to prevent infinite recursion with circular references.
   */
  function resolveRefs(
    obj: JsonSchemaObject,
    visitedRefs: Set<string> = new Set()
  ): JsonSchemaObject {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    // Handle $ref
    if (obj.$ref && typeof obj.$ref === "string") {
      const refPath = obj.$ref;

      // Only handle local references to $defs or definitions
      const defsMatch = refPath.match(/^#\/\$defs\/(.+)$/);
      const definitionsMatch = refPath.match(/^#\/definitions\/(.+)$/);
      const match = defsMatch || definitionsMatch;

      if (match) {
        const defName = match[1];
        const definition = definitions[defName];

        if (isSchemaRecord(definition)) {
          // Check for circular reference
          if (visitedRefs.has(refPath)) {
            // Return a placeholder for circular refs to avoid infinite loop
            debugLog(
              `WARNING: Circular reference detected for ${refPath}, using empty object`
            );
            return { type: "object" };
          }

          // Track this ref as visited
          const newVisitedRefs = new Set(visitedRefs);
          newVisitedRefs.add(refPath);

          // Merge the resolved definition with any other properties from the original object
          // (excluding $ref itself)
          const { $ref: _, ...restOfObj } = obj;
          const resolvedDef = resolveRefs(definition, newVisitedRefs);
          return { ...resolvedDef, ...restOfObj };
        } else {
          debugLog(`WARNING: Could not resolve $ref: ${refPath}`);
        }
      }
      // For non-local refs, return as-is
      return obj;
    }

    // Recursively process all properties
    const result: JsonSchemaObject = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip $defs and definitions as they're no longer needed after dereferencing
      if (key === "$defs" || key === "definitions") {
        continue;
      }

      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          isSchemaRecord(item) ? resolveRefs(item, visitedRefs) : item
        );
      } else if (isSchemaRecord(value)) {
        result[key] = resolveRefs(value, visitedRefs);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  return resolveRefs(schema);
}

/**
 * Deep merges two JSON Schema objects.
 * Arrays are concatenated (with special handling for enum), objects are recursively merged,
 * primitives are overwritten.
 *
 * @param target - The target schema to merge into
 * @param source - The source schema to merge from
 * @returns A new merged schema
 */
function deepMergeSchemas(
  target: JsonSchemaObject,
  source: JsonSchemaObject
): JsonSchemaObject {
  const result: JsonSchemaObject = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];

    if (
      key === "required" &&
      Array.isArray(targetValue) &&
      Array.isArray(sourceValue)
    ) {
      // Concatenate and deduplicate required arrays
      result[key] = [...new Set([...targetValue, ...sourceValue])];
    } else if (key === "const") {
      // When merging const values, convert to enum to allow multiple values
      const existingConst = result.const;
      const existingEnum = result.enum;
      const values = new Set<unknown>();

      if (Array.isArray(existingEnum)) {
        for (const v of existingEnum) values.add(v);
      }
      if (existingConst !== undefined) {
        values.add(existingConst);
      }
      values.add(sourceValue);

      // Remove const and use enum instead
      delete result.const;
      result.enum = [...values];
    } else if (key === "enum" && Array.isArray(sourceValue)) {
      // Merge enum values (union of all possible values)
      const values = new Set<unknown>();
      if (Array.isArray(targetValue)) {
        for (const v of targetValue) values.add(v);
      }
      // Also include any existing const value
      if (result.const !== undefined) {
        values.add(result.const);
        delete result.const;
      }
      for (const v of sourceValue) values.add(v);
      result[key] = [...values];
    } else if (
      key === "properties" &&
      isSchemaRecord(targetValue) &&
      isSchemaRecord(sourceValue)
    ) {
      // Recursively merge properties - merge each property individually
      const mergedProps: JsonSchemaObject = { ...targetValue };
      for (const [propKey, propValue] of Object.entries(sourceValue)) {
        if (isSchemaRecord(mergedProps[propKey]) && isSchemaRecord(propValue)) {
          mergedProps[propKey] = deepMergeSchemas(
            mergedProps[propKey],
            propValue
          );
        } else {
          mergedProps[propKey] = propValue;
        }
      }
      result[key] = mergedProps;
    } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      // Concatenate arrays
      result[key] = [...targetValue, ...sourceValue];
    } else if (isSchemaRecord(sourceValue) && isSchemaRecord(targetValue)) {
      // Recursively merge objects
      result[key] = deepMergeSchemas(targetValue, sourceValue);
    } else {
      // Overwrite primitives or when types don't match
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Extracts and merges properties from if/then/else conditional schemas.
 * This is used when processing allOf items that contain conditionals.
 *
 * @param schema - A schema that may contain if/then/else
 * @returns Properties extracted from both then and else branches
 */
function extractPropertiesFromConditional(
  schema: JsonSchemaObject
): JsonSchemaObject {
  let result: JsonSchemaObject = {};

  // Extract properties from 'then' branch
  if (isSchemaRecord(schema.then)) {
    const thenSchema = schema.then;
    if (thenSchema.properties) {
      result = deepMergeSchemas(result, { properties: thenSchema.properties });
    }
    if (thenSchema.required) {
      result.required = [
        ...new Set([
          ...requiredFields(result.required),
          ...requiredFields(thenSchema.required),
        ]),
      ];
    }
  }

  // Extract properties from 'else' branch
  if (isSchemaRecord(schema.else)) {
    const elseSchema = schema.else;
    if (elseSchema.properties) {
      result = deepMergeSchemas(result, { properties: elseSchema.properties });
    }
    if (elseSchema.required) {
      result.required = [
        ...new Set([
          ...requiredFields(result.required),
          ...requiredFields(elseSchema.required),
        ]),
      ];
    }
  }

  return result;
}

/**
 * Simplifies a JSON Schema for LLM compatibility by removing patterns that
 * OpenAI and other LLM providers don't support at the top level:
 * - allOf: merged into the main schema
 * - anyOf/oneOf: flattened to the first object variant or merged if all are objects
 * - if/then/else: conditional schemas are removed, but properties are extracted
 * - not: negation constraints are removed
 * - $schema: meta schema reference is removed
 * - unevaluatedProperties: not supported by OpenAI
 *
 * This transformation is applied recursively to nested schemas as well.
 *
 * @param schema - The JSON Schema to simplify
 * @returns A new simplified schema compatible with LLM tool calling APIs
 */
function simplifyJsonSchemaForLLM(schema: JsonSchemaObject): JsonSchemaObject {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  // Start with a copy of the schema, excluding unsupported keywords
  const {
    allOf,
    anyOf,
    oneOf,
    not: _not,
    if: schemaIf,
    then: schemaThen,
    else: schemaElse,
    $schema: _$schema,
    unevaluatedProperties: _unevaluatedProperties,
    ...baseSchema
  } = schema;

  let result: JsonSchemaObject = { ...baseSchema };

  // Handle if/then/else at the current level by extracting properties
  if (schemaIf || schemaThen || schemaElse) {
    const conditionalProps = extractPropertiesFromConditional({
      if: schemaIf,
      then: schemaThen,
      else: schemaElse,
    });
    result = deepMergeSchemas(result, conditionalProps);
    debugLog(`INFO: Extracted properties from if/then/else conditional`);
  }

  // Handle allOf by merging all schemas into the base
  if (Array.isArray(allOf)) {
    for (const subSchema of allOf) {
      if (!isSchemaRecord(subSchema)) continue;
      // First extract properties from any if/then/else in this subschema
      if (subSchema.if || subSchema.then || subSchema.else) {
        const conditionalProps = extractPropertiesFromConditional(subSchema);
        result = deepMergeSchemas(result, conditionalProps);
      }
      // Then recursively simplify the subschema and merge
      const simplified = simplifyJsonSchemaForLLM(subSchema);
      result = deepMergeSchemas(result, simplified);
    }
    debugLog(
      `INFO: Flattened allOf with ${allOf.length} schemas into base schema`
    );
  }

  // Handle anyOf/oneOf by attempting to merge object schemas or picking first viable option
  // Note: When merging anyOf/oneOf, we only merge properties but NOT required arrays,
  // because the union semantics mean any ONE of the schemas should match, not all.
  const rawUnionSchemas = anyOf || oneOf;
  const unionSchemas = Array.isArray(rawUnionSchemas)
    ? rawUnionSchemas.filter(isSchemaRecord)
    : [];
  if (unionSchemas.length > 0) {
    // Collect all properties from all schemas, but only keep required fields
    // that are common to ALL schemas (intersection)
    const mergedProperties: JsonSchemaObject = {};
    const requiredSets: Set<string>[] = [];

    const schemasToMerge = unionSchemas.filter(
      (schema) => schema.type === "object" || isSchemaRecord(schema.properties)
    );

    for (const subSchema of schemasToMerge) {
      const simplified = simplifyJsonSchemaForLLM(subSchema);
      // Merge properties
      if (isSchemaRecord(simplified.properties)) {
        Object.assign(mergedProperties, simplified.properties);
      }
      // Collect required sets for intersection
      if (simplified.required && Array.isArray(simplified.required)) {
        requiredSets.push(new Set(requiredFields(simplified.required)));
      }
      // Merge type if present
      if (simplified.type && !result.type) {
        result.type = simplified.type;
      }
    }

    // Merge the collected properties
    if (Object.keys(mergedProperties).length > 0) {
      result.properties = {
        ...(isSchemaRecord(result.properties) ? result.properties : {}),
        ...mergedProperties,
      };
    }

    // Only add required fields that are common to ALL schemas (intersection)
    if (requiredSets.length > 0) {
      const commonRequired = requiredSets.reduce((acc, set) => {
        return new Set([...acc].filter((x) => set.has(x)));
      });
      if (commonRequired.size > 0) {
        result.required = [
          ...new Set([...requiredFields(result.required), ...commonRequired]),
        ];
      }
    }

    debugLog(
      `INFO: Merged ${schemasToMerge.length} object schemas from ${anyOf ? "anyOf" : "oneOf"}`
    );
  }

  // Ensure we have type: "object" if there are properties
  if (result.properties && !result.type) {
    result.type = "object";
  }

  // Recursively simplify nested schemas in properties
  if (isSchemaRecord(result.properties)) {
    const simplifiedProperties: JsonSchemaObject = {};
    for (const [propName, propSchema] of Object.entries(result.properties)) {
      if (isSchemaRecord(propSchema)) {
        simplifiedProperties[propName] = simplifyJsonSchemaForLLM(propSchema);
      } else {
        simplifiedProperties[propName] = propSchema;
      }
    }
    result.properties = simplifiedProperties;
  }

  // Simplify items schema for arrays
  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item) =>
        isSchemaRecord(item) ? simplifyJsonSchemaForLLM(item) : item
      );
    } else if (isSchemaRecord(result.items)) {
      result.items = simplifyJsonSchemaForLLM(result.items);
    }
  }

  // Simplify additionalProperties if it's a schema
  if (isSchemaRecord(result.additionalProperties)) {
    result.additionalProperties = simplifyJsonSchemaForLLM(
      result.additionalProperties
    );
  }

  return result;
}

/**
 * MCP instance is either a Client or a MCPClient.
 *
 * `MCPClient`: is the base instance from the `@modelcontextprotocol/sdk` package.
 * `Client`: is an extension of the `MCPClient` that adds the `fork` method to easier create a new client with different headers.
 *
 * This distinction is necessary to keep the interface of the `getTools` method simple.
 */
type MCPInstance = Client | MCPClient;

// Error formatting only needs Standard Schema issues, not a particular Zod
// constructor. Parse that projection so errors from other Zod versions/copies
// remain supported without asserting that they are our installed ZodError.
const errorPathKeySchema = z.union([z.string(), z.number(), z.symbol()]);
const zodErrorDetailsSchema = z.object({
  issues: z.array(
    z.object({
      message: z.string(),
      path: z
        .array(
          z.union([errorPathKeySchema, z.object({ key: errorPathKeySchema })])
        )
        .optional(),
    })
  ),
  stack: z.string().optional(),
});

function parseZodErrorDetails(error: unknown) {
  if (!isInteropZodError(error)) return undefined;
  const parsed = zodErrorDetailsSchema.safeParse(error);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Custom error class for tool exceptions
 */
export class ToolException extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ToolException";

    const details = parseZodErrorDetails(cause);
    if (details) {
      const minifiedZodError = new Error(z.prettifyError(details));
      const stackLines = details.stack?.split("\n") ?? [];
      const firstFrame = stackLines.findIndex((line) =>
        line.includes("    at")
      );
      minifiedZodError.stack =
        firstFrame < 0 ? undefined : stackLines.slice(firstFrame).join("\n");
      this.cause = minifiedZodError;
    } else if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function isToolException(error: unknown): error is ToolException {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ToolException"
  );
}

function isResourceReference(
  resource:
    | EmbeddedResource["resource"]
    | ReadResourceResult["contents"][number]
): boolean {
  return (
    typeof resource === "object" &&
    resource !== null &&
    "uri" in resource &&
    typeof resource.uri === "string" &&
    (!("blob" in resource) || resource.blob == null) &&
    (!("text" in resource) || resource.text == null)
  );
}

async function* _embeddedResourceToStandardFileBlocks(
  resource:
    | EmbeddedResource["resource"]
    | ReadResourceResult["contents"][number],
  client: MCPInstance
): AsyncGenerator<
  | (ContentBlock.Data.StandardFileBlock & ContentBlock.Data.Base64ContentBlock)
  | (ContentBlock.Data.StandardFileBlock &
      ContentBlock.Data.PlainTextContentBlock)
> {
  if (isResourceReference(resource)) {
    const response: ReadResourceResult = await client.readResource({
      uri: resource.uri,
    });
    for (const content of response.contents) {
      yield* _embeddedResourceToStandardFileBlocks(content, client);
    }
    return;
  }

  if ("blob" in resource && resource.blob != null) {
    yield {
      type: "file",
      source_type: "base64",
      data: resource.blob,
      mime_type: resource.mimeType,
      ...(resource.uri != null ? { metadata: { uri: resource.uri } } : {}),
    } satisfies ContentBlock.Data.StandardFileBlock &
      ContentBlock.Data.Base64ContentBlock;
  }
  if ("text" in resource && resource.text != null) {
    yield {
      type: "file",
      source_type: "text",
      mime_type: resource.mimeType,
      text: resource.text,
      ...(resource.uri != null ? { metadata: { uri: resource.uri } } : {}),
    } satisfies ContentBlock.Data.StandardFileBlock &
      ContentBlock.Data.PlainTextContentBlock;
  }
}

async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: true,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<ContentBlock.Multimodal.Standard[]>;
async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: false | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<ContentBlock[]>;
async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: boolean | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<(ContentBlock | ContentBlock.Multimodal.Standard)[]>;
async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: boolean | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<(ContentBlock | ContentBlock.Multimodal.Standard)[]> {
  const blocks: ContentBlock.Data.StandardFileBlock[] = [];
  const contentType = content.type;
  switch (content.type) {
    case "text":
      return [
        {
          type: "text",
          ...(useStandardContentBlocks
            ? {
                source_type: "text",
              }
            : {}),
          text: content.text,
        } satisfies ContentBlock.Text,
      ];
    case "image":
      if (useStandardContentBlocks) {
        return [
          {
            type: "image",
            source_type: "base64",
            data: content.data,
            mime_type: content.mimeType,
          } satisfies ContentBlock.Data.StandardImageBlock,
        ];
      }
      return [
        {
          type: "image_url",
          image_url: {
            url: `data:${content.mimeType};base64,${content.data}`,
          },
        } satisfies ContentBlock,
      ];
    case "audio":
      // We don't check `useStandardContentBlocks` here because we only support audio via
      // standard content blocks
      return [
        {
          type: "audio",
          source_type: "base64",
          data: content.data,
          mime_type: content.mimeType,
        } satisfies ContentBlock.Data.StandardAudioBlock,
      ];
    case "resource":
      for await (const block of _embeddedResourceToStandardFileBlocks(
        content.resource,
        client
      )) {
        blocks.push(block);
      }
      return blocks;
    case "resource_link": {
      return [
        {
          type: "file",
          source_type: "url",
          url: content.uri,
          mime_type: content.mimeType,
        } satisfies ContentBlock.Data.StandardFileBlock &
          ContentBlock.Data.URLContentBlock,
      ];
    }
    default:
      throw new ToolException(
        `MCP tool '${toolName}' on server '${serverName}' returned a content block with unexpected type "${
          contentType
        }." Expected one of ${callToolResultContentTypes.map((t: string) => `"${t}"`).join(", ")}.`
      );
  }
}

async function _embeddedResourceToArtifact(
  resource: MCPContentBlock,
  useStandardContentBlocks: boolean | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<(MCPContentBlock | ContentBlock)[]> {
  if (useStandardContentBlocks) {
    return _toolOutputToContentBlocks(
      resource,
      useStandardContentBlocks,
      client,
      toolName,
      serverName
    );
  }

  if (
    (!("blob" in resource) || resource.blob == null) &&
    (!("text" in resource) || resource.text == null) &&
    "uri" in resource &&
    typeof resource.uri === "string"
  ) {
    const response: ReadResourceResult = await client.readResource({
      uri: resource.uri,
    });

    return response.contents.map(
      (content: ReadResourceResult["contents"][number]) => ({
        type: "resource",
        resource: {
          ...content,
        },
      })
    );
  }
  return [resource];
}

/**
 * Special artifact type for structured content from MCP tool results
 * @internal
 */
type MCPStructuredContentArtifact = {
  type: "mcp_structured_content";
  data: NonNullable<CallToolResult["structuredContent"]>;
};

/**
 * Special artifact type for meta information from MCP tool results
 * @internal
 */
type MCPMetaArtifact = {
  type: "mcp_meta";
  data: NonNullable<CallToolResult["_meta"]>;
};

/**
 * Extended artifact type that includes MCP-specific artifacts
 * @internal
 */
type ExtendedArtifact =
  | MCPContentBlock
  | ContentBlock
  | MCPStructuredContentArtifact
  | MCPMetaArtifact;

/**
 * Content type that may include structuredContent and meta
 * @internal
 */
type ExtendedContent =
  | (ContentBlock | ContentBlock.Multimodal.Standard)[]
  | (ContentBlock.Text & {
      structuredContent?: NonNullable<CallToolResult["structuredContent"]>;
      meta?: NonNullable<CallToolResult["_meta"]>;
    })
  | string;

/**
 * @internal
 */
type ConvertCallToolResultArgs = {
  /**
   * The name of the server to call the tool on (used for error messages and logging)
   */
  serverName: string;
  /**
   * The name of the tool that was called
   */
  toolName: string;
  /**
   * The result from the MCP tool call
   */
  result: CallToolResult;
  /**
   * The MCP client that was used to call the tool
   */
  client: Client | MCPClient;
  /**
   * If true, the tool will use LangChain's standard multimodal content blocks for tools that output
   * image or audio content. This option has no effect on handling of embedded resource tool output.
   */
  useStandardContentBlocks?: boolean;
  /**
   * Defines where to place each tool output type in the LangChain ToolMessage.
   */
  outputHandling?: OutputHandling;
};

function _getOutputTypeForContentType(
  contentType: CallToolResultContentType,
  outputHandling?: OutputHandling
): "content" | "artifact" {
  if (outputHandling === "content" || outputHandling === "artifact") {
    return outputHandling;
  }

  const resolved = _resolveDetailedOutputHandling(outputHandling);

  return (
    resolved[contentType] ??
    (contentType === "resource" ? "artifact" : "content")
  );
}

/**
 * Process the result from calling an MCP tool.
 * Extracts text content and non-text content for better agent compatibility.
 *
 * @internal
 *
 * @param args - The arguments to pass to the tool
 * @returns A tuple of [textContent, nonTextContent]
 */
async function _convertCallToolResult({
  serverName,
  toolName,
  result,
  client,
  useStandardContentBlocks,
  outputHandling,
}: ConvertCallToolResultArgs): Promise<[ExtendedContent, ExtendedArtifact[]]> {
  if (!result) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an invalid result - tool call response was undefined`
    );
  }

  if (!Array.isArray(result.content)) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an invalid result - expected an array of content, but was ${typeof result.content}`
    );
  }

  if (result.isError) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an error: ${result.content
        .map((content: MCPContentBlock) =>
          content.type === "text" ? content.text : ""
        )
        .join("\n")}`
    );
  }

  const convertedContent: (ContentBlock | ContentBlock.Multimodal.Standard)[] =
    (
      await Promise.all(
        result.content
          .filter(
            (content: MCPContentBlock) =>
              _getOutputTypeForContentType(content.type, outputHandling) ===
              "content"
          )
          .map((content: MCPContentBlock) =>
            _toolOutputToContentBlocks(
              content,
              useStandardContentBlocks,
              client,
              toolName,
              serverName
            )
          )
      )
    ).flat();

  // Create the text content output
  const artifacts = (
    await Promise.all(
      result.content
        .filter(
          (content: MCPContentBlock) =>
            _getOutputTypeForContentType(content.type, outputHandling) ===
            "artifact"
        )
        .map((content) => {
          return _embeddedResourceToArtifact(
            content,
            useStandardContentBlocks,
            client,
            toolName,
            serverName
          );
        })
    )
  ).flat();

  // Extract structuredContent and _meta from result
  // These are optional fields that are part of the CallToolResult type
  const structuredContent = result.structuredContent;
  const meta = result._meta;

  // Add structuredContent and meta as special artifacts
  const enhancedArtifacts: ExtendedArtifact[] = [...artifacts];
  if (structuredContent) {
    enhancedArtifacts.push({
      type: "mcp_structured_content",
      data: structuredContent,
    });
  }
  if (meta) {
    enhancedArtifacts.push({
      type: "mcp_meta",
      data: meta,
    });
  }

  // If we have structuredContent or meta, create an enhanced content that includes all info
  const firstBlock = convertedContent[0];
  if (
    convertedContent.length === 1 &&
    firstBlock.type === "text" &&
    "text" in firstBlock &&
    typeof firstBlock.text === "string"
  ) {
    const textBlock = {
      ...firstBlock,
      type: "text",
      text: firstBlock.text,
    } satisfies ContentBlock.Text;
    const textContent = textBlock.text;

    // If we have structuredContent or meta, wrap the content with additional info
    if (structuredContent || meta) {
      return [
        {
          ...textBlock,
          ...(structuredContent ? { structuredContent } : {}),
          ...(meta ? { meta } : {}),
        } satisfies ExtendedContent,
        enhancedArtifacts,
      ];
    }

    return [textContent, enhancedArtifacts];
  }

  return [convertedContent, enhancedArtifacts];
}

/**
 * @internal
 */
type CallToolArgs = {
  /**
   * The name of the server to call the tool on (used for error messages and logging)
   */
  serverName: string;
  /**
   * The name of the tool to call
   */
  toolName: string;
  /**
   * The MCP client to call the tool on
   */
  client: Client | MCPClient;
  /**
   * The arguments to pass to the tool - must conform to the tool's input schema
   */
  args: Record<string, unknown>;
  /**
   * Optional RunnableConfig with timeout settings
   */
  config?: RunnableConfig;
  /**
   * If true, the tool will use LangChain's standard multimodal content blocks for tools that output
   * image or audio content. This option has no effect on handling of embedded resource tool output.
   */
  useStandardContentBlocks?: boolean;
  /**
   * Defines where to place each tool output type in the LangChain ToolMessage.
   */
  outputHandling?: OutputHandling;

  /**
   * `onProgress` callbacks used for tool calls.
   */
  onProgress?: Notifications["onProgress"];

  /**
   * `beforeToolCall` callbacks used for tool calls.
   */
  beforeToolCall?: ToolHooks["beforeToolCall"];

  /**
   * `afterToolCall` callbacks used for tool calls.
   */
  afterToolCall?: ToolHooks["afterToolCall"];
};

type ContentBlocksWithArtifacts =
  | [ExtendedContent, ExtendedArtifact[]]
  | Command;

/**
 * Call an MCP tool.
 *
 * Use this with `.bind` to capture the fist three arguments, then pass to the constructor of DynamicStructuredTool.
 *
 * @internal
 * @param args - The arguments to pass to the tool
 * @returns A tuple of [textContent, nonTextContent]
 */
async function _callTool({
  serverName,
  toolName,
  client,
  args,
  config,
  useStandardContentBlocks,
  outputHandling,
  onProgress,
  beforeToolCall,
  afterToolCall,
}: CallToolArgs): Promise<ContentBlocksWithArtifacts> {
  try {
    debugLog(`INFO: Calling tool ${toolName}(${JSON.stringify(args)})`);

    // Extract timeout from RunnableConfig and pass to MCP SDK
    // Note: ensureConfig() converts timeout into an AbortSignal and deletes the timeout field.
    // To preserve the numeric timeout for SDKs that accept an explicit timeout value, we read
    // it from metadata.timeoutMs if present, falling back to any direct timeout.
    const numericTimeout =
      z.number().nullish().parse(config?.metadata?.timeoutMs) ??
      config?.timeout;
    const requestOptions: RequestOptions = {
      ...(numericTimeout ? { timeout: numericTimeout } : {}),
      ...(config?.signal ? { signal: config.signal } : {}),
      ...(onProgress
        ? {
            onprogress: (progress) => {
              // oxlint-disable-next-line @typescript-eslint/no-floating-promises
              onProgress?.(progress, {
                type: "tool",
                name: toolName,
                args,
                server: serverName,
              });
            },
          }
        : {}),
    };

    let state: State = {};
    try {
      state = z
        .record(z.string(), z.unknown())
        .parse(getCurrentTaskInput(config));
    } catch (error) {
      debugLog(
        `State can't be derrived as LangGraph is not used: ${String(error)}`
      );
    }

    const beforeToolCallInterception = toolCallModificationSchema
      .optional()
      .parse(
        await beforeToolCall?.(
          {
            name: toolName,
            args,
            serverName,
          },
          state,
          config ?? {}
        )
      );

    const finalArgs = { ...args, ...beforeToolCallInterception?.args };

    const headers = beforeToolCallInterception?.headers || {};
    const hasHeaderChanges = Object.entries(headers).length > 0;
    if (
      hasHeaderChanges &&
      !("fork" in client && typeof client.fork === "function")
    ) {
      throw new ToolException(
        `MCP client for server "${serverName}" does not support header changes`
      );
    }

    const finalClient =
      hasHeaderChanges && "fork" in client && typeof client.fork === "function"
        ? await client.fork(headers)
        : client;

    // v2 callTool(params, options?) — no result-schema argument in between.
    const callToolArgs: Parameters<typeof finalClient.callTool> = [
      {
        name: toolName,
        arguments: finalArgs,
      },
    ];

    if (Object.keys(requestOptions).length > 0) {
      callToolArgs.push(requestOptions);
    }

    const result = await finalClient.callTool(...callToolArgs);
    const [content, artifacts] = await _convertCallToolResult({
      serverName,
      toolName,
      result,
      client: finalClient,
      useStandardContentBlocks,
      outputHandling,
    });

    // Convert ExtendedContent to the format expected by afterToolCall
    // afterToolCall expects: string | (ContentBlock | ContentBlock.Data.DataContentBlock)[]
    // ExtendedContent can be: string | ContentBlock[] | (ContentBlock.Text & {...})
    const normalizedContent:
      | string
      | (ContentBlock | ContentBlock.Data.DataContentBlock)[] =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
          : [content];

    // Preserve the existing hook view of resources and data artifacts. The
    // hook parser checks block containers without asserting a provider format.
    const normalizedArtifacts = artifacts.filter(
      (artifact) =>
        artifact.type === "resource" ||
        (artifact.type !== "mcp_structured_content" &&
          artifact.type !== "mcp_meta" &&
          "source_type" in artifact)
    );

    const interceptedResult = toolCallResultModificationSchema.optional().parse(
      await afterToolCall?.(
        {
          name: toolName,
          args: finalArgs,
          result: [normalizedContent, normalizedArtifacts],
          serverName,
        },
        state,
        config ?? {}
      )
    );

    if (!interceptedResult) {
      return [content, artifacts];
    }

    if (typeof interceptedResult.result === "string") {
      return [interceptedResult.result, []];
    }

    if (Array.isArray(interceptedResult.result)) {
      return interceptedResult.result;
    }

    if (ToolMessage.isInstance(interceptedResult.result)) {
      return [interceptedResult.result.contentBlocks, []];
    }

    if (isCommand(interceptedResult.result)) {
      return interceptedResult.result;
    }

    throw new Error(
      `Unexpected result value type from afterToolCall: expected either a Command, a ToolMessage or a tuple of ContentBlock and Artifact, but got ${interceptedResult.result}`
    );
  } catch (error) {
    const details = parseZodErrorDetails(error);
    if (details) {
      throw new ToolException(z.prettifyError(details), error);
    }

    debugLog(`Error calling tool ${toolName}: ${String(error)}`);
    if (isToolException(error)) {
      throw error;
    }
    throw new ToolException(`Error calling tool ${toolName}: ${String(error)}`);
  }
}

const defaultLoadMcpToolsOptions: LoadMcpToolsOptions = {
  throwOnLoadError: true,
  prefixToolNameWithServerName: false,
  additionalToolNamePrefix: "",
  useStandardContentBlocks: false,
};

/**
 * Load all tools from an MCP client.
 *
 * @param serverName - The name of the server to load tools from
 * @param client - The MCP client
 * @returns A list of LangChain tools
 */
export async function loadMcpTools(
  serverName: string,
  client: MCPInstance,
  options?: LoadMcpToolsOptions
): Promise<DynamicStructuredTool[]> {
  const {
    throwOnLoadError,
    prefixToolNameWithServerName,
    additionalToolNamePrefix,
    useStandardContentBlocks,
    outputHandling,
    defaultToolTimeout,
  } = {
    ...defaultLoadMcpToolsOptions,
    ...(options ?? {}),
  };

  const mcpTools: MCPTool[] = [];

  // Get tools in a single operation
  let toolsResponse: ListToolsResult | undefined;
  do {
    toolsResponse = await client.listTools({
      ...(toolsResponse?.nextCursor
        ? { cursor: toolsResponse.nextCursor }
        : {}),
    });
    mcpTools.push(...(toolsResponse.tools || []));
  } while (toolsResponse.nextCursor);

  debugLog(`INFO: Found ${mcpTools.length} MCP tools`);

  const initialPrefix = additionalToolNamePrefix
    ? `${additionalToolNamePrefix}__`
    : "";
  const serverPrefix = prefixToolNameWithServerName ? `${serverName}__` : "";
  const toolNamePrefix = `${initialPrefix}${serverPrefix}`;

  // Filter out tools without names and convert in a single map operation
  return (
    await Promise.all(
      mcpTools
        .filter((tool: MCPTool) => !!tool.name)
        .map(async (tool: MCPTool) => {
          try {
            if (!tool.inputSchema.properties) {
              // Workaround for MCP SDK not consistently providing properties
              tool.inputSchema.properties = {};
            }

            // Dereference $defs/$ref in the schema to support Pydantic v2 schemas
            // and other JSON schemas that use $defs for nested type definitions
            const dereferencedSchema = dereferenceJsonSchema(tool.inputSchema);

            // Simplify schema for LLM compatibility by removing allOf, anyOf, oneOf,
            // if/then/else, not, and other patterns that OpenAI doesn't support
            const simplifiedSchema =
              simplifyJsonSchemaForLLM(dereferencedSchema);

            const dst = new DynamicStructuredTool({
              name: `${toolNamePrefix}${tool.name}`,
              description: tool.description || "",
              schema: simplifiedSchema,
              responseFormat: "content_and_artifact",
              metadata: { annotations: tool.annotations },
              defaultConfig: defaultToolTimeout
                ? { timeout: defaultToolTimeout }
                : undefined,
              func: async (
                args: Record<string, unknown>,
                _runManager?: CallbackManagerForToolRun,
                config?: RunnableConfig
              ) => {
                return _callTool({
                  serverName,
                  toolName: tool.name,
                  client,
                  args,
                  config,
                  useStandardContentBlocks,
                  outputHandling,
                  onProgress: options?.onProgress,
                  beforeToolCall: options?.beforeToolCall,
                  afterToolCall: options?.afterToolCall,
                });
              },
            });
            debugLog(`INFO: Successfully loaded tool: ${dst.name}`);
            return dst;
          } catch (error) {
            debugLog(`ERROR: Failed to load tool "${tool.name}":`, error);
            if (throwOnLoadError) {
              throw error;
            }
            return null;
          }
        })
    )
  ).filter((tool) => tool !== null);
}
