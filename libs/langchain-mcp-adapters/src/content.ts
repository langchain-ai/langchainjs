import type {
  CallToolResult,
  ContentBlock as MCPContentBlock,
} from "@modelcontextprotocol/client";
import type { ContentBlock } from "@langchain/core/messages";

import { ToolException } from "./utils/errors.js";
import {
  _resolveDetailedOutputHandling,
  callToolResultContentTypes,
  type CallToolResultContentType,
  type OutputHandling,
} from "./types.js";

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
