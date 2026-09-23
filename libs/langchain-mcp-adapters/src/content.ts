import { z } from "zod";
import {
  ContentBlockSchema,
  EmbeddedResourceSchema,
} from "@modelcontextprotocol/core";
import type {
  CallToolResult,
  ContentBlock as MCPContentBlock,
} from "@modelcontextprotocol/client";
import type { ContentBlock } from "@langchain/core/messages";

import { ToolException } from "./utils/errors.js";

const callToolResultContentTypeSchema = z.enum(
  ContentBlockSchema.options.map((schema) => schema.shape.type.value)
);

export const callToolResultContentTypes =
  callToolResultContentTypeSchema.options;

export type CallToolResultContentType = z.output<
  typeof callToolResultContentTypeSchema
>;

const outputTypesUnion = z.enum(["content", "artifact"]);

const detailedOutputHandlingSchema = z.partialRecord(
  callToolResultContentTypeSchema,
  outputTypesUnion.optional()
);

export type DetailedOutputHandling = z.output<
  typeof detailedOutputHandlingSchema
>;

export const outputHandlingSchema = z.union([
  outputTypesUnion,
  detailedOutputHandlingSchema,
]);

/**
 * Defines where to place each tool output type in the LangChain ToolMessage.
 *
 * Can be set to `content` or `artifact` to send all tool output into the ToolMessage.content or
 * ToolMessage.artifact array, respectively, or you can assign an object that maps each content type
 * to `content` or `artifact`.
 *
 * @default {
 *   "text": "content",
 *   "image": "content",
 *   "audio": "content",
 *   "resource": "artifact"
 * }
 *
 * Items in the `content` field will be used as input context for the LLM, while the artifact field is
 * used for capturing tool output that won't be shown to the model, to be used in some later workflow
 * step.
 *
 * For example, imagine that you have a SQL query tool that can return huge result sets. Rather than
 * sending these large outputs directly to the model, perhaps you want the model to be able to inspect
 * the output in a code execution environment. In this case, you would set the output handling for the
 * `resource` type to `artifact` (its default value), and then upon initialization of your code
 * execution environment, you would look through your message history for `ToolMessage`s with the
 * `artifact` field set to `resource`, and use the `content` field during initialization of the
 * environment.
 */
export type OutputHandling = z.output<typeof outputHandlingSchema>;

// Core content blocks are extensible records, not a closed list of provider
// formats. Preserve extension fields without claiming their format is validated.
const contentBlockSchema = z.looseObject({
  type: z.string(),
  id: z.string().optional(),
}) satisfies z.ZodType<ContentBlock>;

const toolContentSchema = z.union([z.string(), z.array(contentBlockSchema)]);

// MCP owns embedded resource semantics. Other artifacts include both legacy
// data blocks and current LangChain blocks, so validate their shared boundary.
const toolArtifactSchema = z.union([
  EmbeddedResourceSchema.extend({
    resource: z.union(
      EmbeddedResourceSchema.shape.resource.options.map((schema) =>
        schema.loose()
      )
    ),
    annotations: EmbeddedResourceSchema.shape.annotations
      .unwrap()
      .loose()
      .optional(),
  }).loose(),
  contentBlockSchema.refine((block) => block.type !== "resource", {
    error: "Expected a valid MCP embedded resource",
  }),
]);

/** Content and artifacts supplied to or returned from tool-result hooks. */
export const toolResultBeforeSchema = z.tuple([
  toolContentSchema,
  z.array(toolArtifactSchema),
]);

export type ToolResultBefore = z.output<typeof toolResultBeforeSchema>;

/** Terminal conversion never dereferences resource URIs or performs network IO. */
function toolOutputToContentBlocks(
  content: MCPContentBlock,
  toolName: string,
  serverName: string
): ContentBlock.Standard[] {
  const contentType = content.type;

  switch (content.type) {
    case "text":
      return [{ type: "text", text: content.text }];
    case "image":
      return [
        {
          type: "image",
          data: content.data,
          mimeType: content.mimeType,
        } satisfies ContentBlock.Multimodal.Image,
      ];
    case "audio":
      return [
        {
          type: "audio",
          data: content.data,
          mimeType: content.mimeType,
        } satisfies ContentBlock.Multimodal.Audio,
      ];
    case "resource": {
      const resource = content.resource;
      const metadata = { uri: resource.uri };

      if ("text" in resource) {
        return [{ type: "text", text: resource.text, metadata }];
      }

      const mimeType = resource.mimeType ?? "application/octet-stream";

      return [
        {
          type: mimeType.startsWith("image/")
            ? "image"
            : mimeType.startsWith("audio/")
              ? "audio"
              : "file",
          data: resource.blob,
          mimeType,
          metadata,
        } satisfies ContentBlock.Multimodal.Standard,
      ];
    }
    case "resource_link": {
      const metadata =
        content.title === undefined
          ? { uri: content.uri, name: content.name }
          : { uri: content.uri, name: content.name, title: content.title };

      return [
        {
          type: "file",
          url: content.uri,
          mimeType: content.mimeType,
          metadata,
        } satisfies ContentBlock.Multimodal.File,
      ];
    }
    default:
      throw new ToolException(
        `MCP tool '${toolName}' on server '${serverName}' returned unexpected content type "${contentType}". Expected ${callToolResultContentTypes.join(", ")}.`
      );
  }
}

/** Special artifact for structured content from MCP tool results. @internal */
type MCPStructuredContentArtifact = {
  type: "mcp_structured_content";
  data: Exclude<CallToolResult["structuredContent"], undefined>;
};

/** Special artifact for metadata from MCP tool results. @internal */
type MCPMetaArtifact = {
  type: "mcp_meta";
  data: NonNullable<CallToolResult["_meta"]>;
};

/** MCP and LangChain artifacts retained from a tool result. @internal */
export type ExtendedArtifact =
  | MCPContentBlock
  | ContentBlock
  | { type: "mcp_content"; data: MCPContentBlock }
  | MCPStructuredContentArtifact
  | MCPMetaArtifact;

/** Model-visible content; protocol metadata belongs in artifacts. @internal */
export type ExtendedContent = ContentBlock[] | string;

/** @internal */
type ConvertCallToolResultArgs = {
  /** The server name, used in conversion errors. */
  serverName: string;
  /** The tool name, used in conversion errors. */
  toolName: string;
  /** The terminal MCP tool result. */
  result: CallToolResult;
  /** Routing policy for each MCP content type. */
  outputHandling?: OutputHandling;
};

/** Expand an output policy into its per-content-type representation. @internal */
export function _resolveDetailedOutputHandling(
  outputHandling: OutputHandling | undefined,
  applyDefaults: boolean = false
): DetailedOutputHandling {
  if (outputHandling == null) return {};

  if (typeof outputHandling === "string") {
    return Object.fromEntries(
      callToolResultContentTypes.map((contentType) => [
        contentType,
        outputHandling,
      ])
    );
  }

  const resolved: DetailedOutputHandling = {};
  for (const contentType of callToolResultContentTypes) {
    if (outputHandling[contentType] || applyDefaults) {
      resolved[contentType] =
        outputHandling[contentType] ??
        (contentType === "resource" ? "artifact" : "content");
    }
  }
  return resolved;
}

/** Apply a server-level output policy over an adapter-level policy. @internal */
export function _resolveAndApplyOverrideHandlingOverrides(
  base: OutputHandling | undefined,
  override: OutputHandling | undefined
): OutputHandling {
  return {
    ..._resolveDetailedOutputHandling(base),
    ..._resolveDetailedOutputHandling(override),
  };
}

function outputTypeForContentType(
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
 * Convert a terminal MCP tool result into LangChain content and artifacts.
 *
 * Resource links and embedded resource provenance are retained as artifacts;
 * this conversion never dereferences resource URIs or performs network IO.
 *
 * @internal
 */
export function convertCallToolResult({
  serverName,
  toolName,
  result,
  outputHandling,
}: ConvertCallToolResultArgs): [ExtendedContent, ExtendedArtifact[]] {
  if (result.isError) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an error: ${result.content
        .map((content: MCPContentBlock) =>
          content.type === "text" ? content.text : ""
        )
        .join("\n")}`,
      undefined,
      result
    );
  }

  const convertedContent = result.content
    .filter(
      (block) =>
        outputTypeForContentType(block.type, outputHandling) === "content"
    )
    .flatMap((block) => toolOutputToContentBlocks(block, toolName, serverName));

  const artifacts = result.content.filter(
    (block) =>
      outputTypeForContentType(block.type, outputHandling) === "artifact"
  );
  const enhancedArtifacts: ExtendedArtifact[] = [...artifacts];

  for (const block of result.content) {
    const retainedKeys =
      block.type === "text" ? ["type", "text"] : ["type", "data", "mimeType"];

    if (
      !artifacts.includes(block) &&
      (block.type === "resource" ||
        block.type === "resource_link" ||
        Object.keys(block).some((key) => !retainedKeys.includes(key)))
    ) {
      enhancedArtifacts.push({ type: "mcp_content", data: block });
    }
  }

  if (result.structuredContent !== undefined) {
    enhancedArtifacts.push({
      type: "mcp_structured_content",
      data: result.structuredContent,
    });
  }

  if (result._meta) {
    enhancedArtifacts.push({
      type: "mcp_meta",
      data: result._meta,
    });
  }

  // Preserve the plain-text convenience without dropping resource provenance.
  const firstBlock = convertedContent[0];

  if (
    convertedContent.length === 1 &&
    firstBlock.type === "text" &&
    !("metadata" in firstBlock)
  ) {
    return [firstBlock.text, enhancedArtifacts];
  }

  return [convertedContent, enhancedArtifacts];
}
