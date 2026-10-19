import {
  AIMessage,
  BaseMessage,
  ContentBlock,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  UsageMetadata,
  InputTokenDetails,
  OutputTokenDetails,
} from "@langchain/core/messages";
import type { Gemini } from "../../chat_models/types.js";
import { GoogleError } from "../../utils/errors.js";
import {
  convertGeminiPartToContentBlock,
  convertGeminiPartsToToolCalls,
  convertMessagesToGeminiContents,
  convertMessagesToGeminiSystemInstruction,
} from "../generate_content/messages.js";

/**
 * Converts a single LangChain `BaseMessage` into `Gemini.Part[]` using the
 * existing GenerateContent message converters.
 */
function convertSingleMessageToGeminiParts(
  message: BaseMessage
): Gemini.Part[] {
  if (SystemMessage.isInstance(message)) {
    const sys = convertMessagesToGeminiSystemInstruction([message]);
    return sys?.parts ?? [];
  }
  if (ToolMessage.isInstance(message)) {
    const contents = convertMessagesToGeminiContents([
      new HumanMessage({
        content: message.content,
        response_metadata: message.response_metadata,
      }),
    ]);
    return contents.flatMap((c) => c.parts ?? []);
  }
  const contents = convertMessagesToGeminiContents([message]);
  return contents.flatMap((c) => c.parts ?? []);
}

/**
 * Extracts and concatenates leading `SystemMessage` instances into the
 * Interactions API `system_instruction` string.
 */
export function convertMessagesToInteractionsSystemInstruction(
  messages: BaseMessage[]
): string | undefined {
  const chunks: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (SystemMessage.isInstance(message)) {
      const parts = convertSingleMessageToGeminiParts(message);
      for (const part of parts) {
        if (typeof part.text === "string" && part.text.length > 0) {
          chunks.push(part.text);
        }
      }
    } else {
      break;
    }
  }
  return chunks.length > 0 ? chunks.join("\n") : undefined;
}

/**
 * Maps a GenerateContent `Part.MediaResolution` or string into an Interactions `MediaResolution`.
 */
function mapPartResolutionToInteractions(
  partResolution?: Gemini.Part["mediaResolution"] | { level?: string },
  defaultResolution?: Gemini.Interactions.MediaResolution
): Gemini.Interactions.MediaResolution | undefined {
  const rawLevel =
    typeof partResolution === "string"
      ? partResolution
      : partResolution?.level;
  if (rawLevel) {
    const lower = rawLevel.toLowerCase();
    if (lower === "media_resolution_low" || lower === "low") return "low";
    if (lower === "media_resolution_medium" || lower === "medium")
      return "medium";
    if (lower === "media_resolution_high" || lower === "high") return "high";
    if (lower === "media_resolution_ultra_high" || lower === "ultra_high")
      return "ultra_high";
  }
  return defaultResolution;
}

/**
 * Converts a single `Gemini.Part` (produced by `convertMessageToGeminiParts`) into an
 * Interactions API `Content` item (`TextContent`, `ImageContent`, `AudioContent`,
 * `DocumentContent`, or `VideoContent`).
 */
export function convertGeminiPartToInteractionsContent(
  part: Gemini.Part,
  defaultMediaResolution?: Gemini.Interactions.MediaResolution
): Gemini.Interactions.Content | undefined {
  if (typeof part.text === "string") {
    return {
      type: "text",
      text: part.text,
    };
  }

  if (part.inlineData) {
    const mimeType = part.inlineData.mimeType || "application/octet-stream";
    const data = part.inlineData.data;
    const resolution = mapPartResolutionToInteractions(
      part.mediaResolution,
      defaultMediaResolution
    );

    if (mimeType.startsWith("image/")) {
      return {
        type: "image",
        mime_type: mimeType as Gemini.Interactions.ImageContent["mime_type"],
        data,
        ...(resolution ? { resolution } : {}),
      };
    }
    if (mimeType.startsWith("audio/")) {
      return {
        type: "audio",
        mime_type: mimeType as Gemini.Interactions.AudioContent["mime_type"],
        data,
      };
    }
    if (mimeType.startsWith("video/")) {
      return {
        type: "video",
        mime_type: mimeType as Gemini.Interactions.VideoContent["mime_type"],
        data,
        ...(resolution ? { resolution } : {}),
      };
    }
    return {
      type: "document",
      mime_type: mimeType as Gemini.Interactions.DocumentContent["mime_type"],
      data,
    };
  }

  if (part.fileData) {
    const mimeType = part.fileData.mimeType || "application/octet-stream";
    const uri = part.fileData.fileUri;
    const resolution = mapPartResolutionToInteractions(
      part.mediaResolution,
      defaultMediaResolution
    );

    if (mimeType.startsWith("image/")) {
      return {
        type: "image",
        mime_type: mimeType as Gemini.Interactions.ImageContent["mime_type"],
        uri,
        ...(resolution ? { resolution } : {}),
      };
    }
    if (mimeType.startsWith("audio/")) {
      return {
        type: "audio",
        mime_type: mimeType as Gemini.Interactions.AudioContent["mime_type"],
        uri,
      };
    }
    if (mimeType.startsWith("video/")) {
      return {
        type: "video",
        mime_type: mimeType as Gemini.Interactions.VideoContent["mime_type"],
        uri,
        ...(resolution ? { resolution } : {}),
      };
    }
    return {
      type: "document",
      mime_type: mimeType as Gemini.Interactions.DocumentContent["mime_type"],
      uri,
    };
  }

  return undefined;
}

/**
 * Converts an Interactions API `Content` item into a `Gemini.Part` so that
 * downstream `convertGeminiPartToContentBlock` produces identical LangChain
 * `AIMessage` content blocks to `GenerateContentApiHandler`.
 */
export function convertInteractionsContentToGeminiPart(
  content: Gemini.Interactions.Content,
  thoughtSignature?: string
): Gemini.Part | undefined {
  const sigSpread = thoughtSignature ? { thoughtSignature } : {};

  switch (content.type) {
    case "text":
      return {
        text: content.text,
        ...sigSpread,
      };
    case "image":
    case "audio":
    case "video":
    case "document": {
      const mimeType = content.mime_type || `${content.type}/unknown`;
      if (content.data) {
        return {
          inlineData: {
            mimeType,
            data: content.data,
          },
          ...sigSpread,
        };
      }
      if (content.uri) {
        return {
          fileData: {
            mimeType,
            fileUri: content.uri,
          },
          ...sigSpread,
        };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Converts an array of LangChain `BaseMessage`s into an array of Interactions API `Step`s.
 *
 * ### ThoughtStep & `thoughtSignature` Round-Trip Design
 *
 * In the Interactions API, model reasoning and cryptographic thought signatures are
 * represented as standalone `{ type: "thought", signature, summary? }` steps in the
 * step sequence, rather than inline `{ thought: true, thoughtSignature }` fields on
 * text or tool-call parts.
 *
 * When converting an `AIMessage` back into Interactions `Step`s for multi-turn history:
 * 1. If the `AIMessage` contains reasoning blocks (`v1` `{ type: "reasoning", reasoning }`
 *    or `v0` `{ type: "text", thought: true, text, thoughtSignature }`), each reasoning
 *    block is emitted as a `{ type: "thought", signature, summary: [{ type: "text", text }] }` step.
 * 2. In the Interactions API, Gemini 2.5 / 3 models also emit signature-only `ThoughtStep`s
 *    (`{ type: "thought", signature }` with no `summary`) before `ModelOutputStep` or
 *    `FunctionCallStep` when `thinking_summaries` is not enabled. On inbound conversion
 *    (`convertInteractionToAIMessage`), we stash those signatures on:
 *    - `aiMessage.additional_kwargs.originalTextContentBlock.thoughtSignature` (or non-thought
 *      text content blocks), and
 *    - `aiMessage.tool_calls[i].thoughtSignature`.
 *    When converting that `AIMessage` back to `Step`s here, if a `thoughtSignature` is present
 *    on the text block or tool call and has NOT already been emitted by a preceding `ThoughtStep`,
 *    we emit `{ type: "thought", signature }` immediately before the corresponding
 *    `{ type: "model_output" }` or `{ type: "function_call" }` step.
 */
export function convertMessagesToInteractionsInput(
  messages: BaseMessage[],
  defaultMediaResolution?: Gemini.Interactions.MediaResolution
): Gemini.Interactions.Step[] {
  const steps: Gemini.Interactions.Step[] = [];
  let isLeadingSystemMessages = true;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // Leading SystemMessages are handled via `system_instruction`
    if (isLeadingSystemMessages && SystemMessage.isInstance(message)) {
      continue;
    }
    isLeadingSystemMessages = false;

    if (AIMessage.isInstance(message)) {
      const parts = convertSingleMessageToGeminiParts(message);
      const modelOutputContents: Gemini.Interactions.Content[] = [];
      const emittedSignatures = new Set<string>();
      let pendingOutputSignature: string | undefined;

      const flushModelOutput = () => {
        if (modelOutputContents.length > 0) {
          if (
            pendingOutputSignature &&
            !emittedSignatures.has(pendingOutputSignature)
          ) {
            steps.push({
              type: "thought",
              signature: pendingOutputSignature,
            });
            emittedSignatures.add(pendingOutputSignature);
          }
          steps.push({
            type: "model_output",
            content: [...modelOutputContents],
          });
          modelOutputContents.length = 0;
          pendingOutputSignature = undefined;
        }
      };

      let callIndex = 0;
      for (const part of parts) {
        if (part.thought) {
          flushModelOutput();
          const summaryContent: Gemini.Interactions.Content[] = [];
          if (typeof part.text === "string" && part.text.length > 0) {
            summaryContent.push({
              type: "text",
              text: part.text,
            });
          }
          if (part.thoughtSignature) {
            emittedSignatures.add(part.thoughtSignature);
          }
          steps.push({
            type: "thought",
            ...(part.thoughtSignature
              ? { signature: part.thoughtSignature }
              : {}),
            ...(summaryContent.length > 0 ? { summary: summaryContent } : {}),
          });
        } else if (part.executableCode) {
          flushModelOutput();
          steps.push({
            type: "code_execution_call",
            id: `code_exec_${callIndex++}`,
            arguments: {
              code: part.executableCode.code,
              language: "python",
            },
            ...(part.thoughtSignature
              ? { signature: part.thoughtSignature }
              : {}),
          });
        } else if (part.codeExecutionResult) {
          flushModelOutput();
          steps.push({
            type: "code_execution_result",
            call_id: `code_exec_${Math.max(0, callIndex - 1)}`,
            result: part.codeExecutionResult.output ?? "",
            is_error:
              part.codeExecutionResult.outcome !== "OUTCOME_OK" &&
              part.codeExecutionResult.outcome !==
                "OUTCOME_UNSPECIFIED" &&
              Boolean(part.codeExecutionResult.outcome),
            ...(part.thoughtSignature
              ? { signature: part.thoughtSignature }
              : {}),
          });
        } else if (part.functionCall) {
          flushModelOutput();
          // Note: convertSingleMessageToGeminiParts strips `id` when it starts with "lc-tool-call-",
          // so we look up the original tool_call id from `message.tool_calls` as fallback
          // because `id` is required on FunctionCallStep in the Interactions API.
          const originalToolCall = message.tool_calls?.[callIndex];
          const id =
            part.functionCall.id ||
            originalToolCall?.id ||
            `call_${callIndex}`;
          const sig =
            part.thoughtSignature ||
            (
              originalToolCall as
                | { thoughtSignature?: string }
                | undefined
            )?.thoughtSignature;

          if (sig && !emittedSignatures.has(sig)) {
            steps.push({
              type: "thought",
              signature: sig,
            });
            emittedSignatures.add(sig);
          }

          steps.push({
            type: "function_call",
            id,
            name: part.functionCall.name,
            arguments: part.functionCall.args ?? {},
          });
          callIndex++;
        } else {
          if (part.thoughtSignature && !pendingOutputSignature) {
            pendingOutputSignature = part.thoughtSignature;
          }
          const converted = convertGeminiPartToInteractionsContent(
            part,
            defaultMediaResolution
          );
          if (converted) {
            modelOutputContents.push(converted);
          }
        }
      }

      flushModelOutput();
      // If a signature-only part existed with no text or tool calls, still preserve the ThoughtStep
      if (
        pendingOutputSignature &&
        !emittedSignatures.has(pendingOutputSignature)
      ) {
        steps.push({
          type: "thought",
          signature: pendingOutputSignature,
        });
        emittedSignatures.add(pendingOutputSignature);
      }
    } else if (ToolMessage.isInstance(message)) {
      const callId =
        message.tool_call_id ||
        (message.additional_kwargs?.tool_call_id as string | undefined) ||
        "unknown";
      const name =
        message.name ||
        (message.additional_kwargs?.name as string | undefined) ||
        messages
          .filter(AIMessage.isInstance)
          .flatMap((m) => m.tool_calls ?? [])
          .find((tc) => tc.id === callId)?.name;
      const isError = message.status === "error" ? true : undefined;

      let result: Gemini.Interactions.FunctionResultStep["result"];
      if (typeof message.content === "string") {
        // Attempt to parse JSON object results if valid, otherwise pass string directly
        try {
          const parsed = JSON.parse(message.content);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            result = parsed as Record<string, unknown>;
          } else {
            result = message.content;
          }
        } catch {
          result = message.content;
        }
      } else if (Array.isArray(message.content)) {
        const parts = convertSingleMessageToGeminiParts(message);
        const contents: Gemini.Interactions.Content[] = [];
        for (const part of parts) {
          if (part.functionResponse?.response) {
            const resp = part.functionResponse.response;
            if (
              typeof resp === "object" &&
              resp !== null &&
              "result" in resp &&
              Object.keys(resp).length === 1 &&
              typeof resp.result === "string"
            ) {
              contents.push({ type: "text", text: resp.result });
            } else {
              contents.push({
                type: "text",
                text: JSON.stringify(resp),
              });
            }
          } else {
            const converted = convertGeminiPartToInteractionsContent(
              part,
              defaultMediaResolution
            );
            if (converted) {
              contents.push(converted);
            }
          }
        }
        result = contents.length > 0 ? contents : "";
      } else {
        result = String(message.content ?? "");
      }

      steps.push({
        type: "function_result",
        call_id: callId,
        ...(name ? { name } : {}),
        ...(typeof isError === "boolean" ? { is_error: isError } : {}),
        result,
      });
    } else {
      // HumanMessage, mid-conversation SystemMessage, or generic BaseMessage -> UserInputStep
      const parts = convertSingleMessageToGeminiParts(message);
      const contents: Gemini.Interactions.Content[] = [];
      for (const part of parts) {
        const converted = convertGeminiPartToInteractionsContent(
          part,
          defaultMediaResolution
        );
        if (converted) {
          contents.push(converted);
        }
      }
      if (contents.length > 0) {
        steps.push({
          type: "user_input",
          content: contents,
        });
      }
    }
  }

  return steps;
}

/**
 * Converts Interactions API `ModalityTokens[]` into a modality record (`text`, `image`, `audio`, etc.)
 * compatible with LangChain's `InputTokenDetails` / `OutputTokenDetails`.
 */
function convertInteractionsModalityTokensToRecord(
  modalityTokens?: Gemini.Interactions.ModalityTokens[]
): Record<string, number> {
  const ret: Record<string, number> = {};
  for (const item of modalityTokens ?? []) {
    if (item.modality && typeof item.tokens === "number") {
      const key = item.modality.toLowerCase();
      ret[key] = (ret[key] ?? 0) + item.tokens;
    }
  }
  return ret;
}

/**
 * Converts an Interactions API `Usage` object into LangChain's `UsageMetadata`.
 */
export function convertInteractionsUsageToUsageMetadata(
  usage?: Gemini.Interactions.Usage
): UsageMetadata | undefined {
  if (!usage) {
    return undefined;
  }

  const inputMods = convertInteractionsModalityTokensToRecord(
    usage.input_tokens_by_modality
  );
  const outputMods = convertInteractionsModalityTokensToRecord(
    usage.output_tokens_by_modality
  );

  const cacheRead = usage.total_cached_tokens;
  const toolUse = usage.total_tool_use_tokens;
  const inputTokenDetails: InputTokenDetails = {
    ...(typeof cacheRead === "number" ? { cache_read: cacheRead } : {}),
    ...(typeof toolUse === "number" ? { tool_use: toolUse } : {}),
    ...inputMods,
  };

  const reasoning = usage.total_thought_tokens;
  const outputTokenDetails: OutputTokenDetails = {
    ...(typeof reasoning === "number" ? { reasoning } : {}),
    ...outputMods,
  };

  const rawInput = usage.total_input_tokens ?? 0;
  const rawOutput = usage.total_output_tokens ?? 0;
  const rawThought = usage.total_thought_tokens ?? 0;
  const rawToolUse = usage.total_tool_use_tokens ?? 0;

  // Include tool_use tokens in input_tokens if not already counted in total_input_tokens
  const inputTokens =
    typeof usage.total_tokens === "number" &&
    rawInput + rawToolUse + rawOutput + rawThought === usage.total_tokens
      ? rawInput + rawToolUse
      : rawInput;

  // LangChain's `output_tokens` convention includes reasoning tokens (`total_thought_tokens`).
  // Check whether `total_output_tokens` already includes `total_thought_tokens` by comparing with `total_tokens`.
  const outputTokens =
    typeof usage.total_tokens === "number" &&
    rawInput + rawOutput === usage.total_tokens &&
    rawThought > 0
      ? rawOutput
      : rawOutput + rawThought;

  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    ...(Object.keys(inputTokenDetails).length > 0
      ? { input_token_details: inputTokenDetails }
      : {}),
    ...(Object.keys(outputTokenDetails).length > 0
      ? { output_token_details: outputTokenDetails }
      : {}),
  };
}

/**
 * Normalizes an item from `interaction.steps` or legacy `interaction.outputs`
 * into a `Gemini.Interactions.Step`.
 */
export function normalizeInteractionStep(
  item: Gemini.Interactions.Step | Gemini.Interactions.Content
): Gemini.Interactions.Step {
  if (
    item.type === "text" ||
    item.type === "image" ||
    item.type === "audio" ||
    item.type === "document" ||
    item.type === "video"
  ) {
    return {
      type: "model_output",
      content: [item],
    };
  }
  return item;
}

/**
 * Synthesizes GenerateContent-compatible `groundingMetadata`, `citationMetadata`,
 * `groundingSupport`, and `urlContextMetadata` from Interactions API annotations
 * and built-in tool steps (`google_search_*`, `google_maps_*`, `file_search_*`, `url_context_*`).
 */
export function synthesizeMetadataFromInteractions(options: {
  textSegments: Array<{
    text: string;
    annotations?: Gemini.Interactions.Annotation[];
  }>;
  builtInToolSteps: Gemini.Interactions.Step[];
}): {
  groundingMetadata?: Gemini.GroundingMetadata;
  groundingSupport?: Gemini.GroundingSupport[];
  citationMetadata?: Gemini.CitationMetadata;
  urlContextMetadata?: Gemini.GenContent.Candidate["urlContextMetadata"];
} {
  const { textSegments, builtInToolSteps } = options;

  const webSearchQueries: string[] = [];
  const groundingChunks: NonNullable<
    Gemini.GroundingMetadata["groundingChunks"]
  > = [];
  const groundingSupports: Gemini.GroundingSupport[] = [];
  const citationSources: NonNullable<
    Gemini.CitationMetadata["citationSources"]
  > = [];
  const urlMetadataList: Array<{
    retrievedUrl?: string;
    urlRetrievalStatus?:
      | "URL_RETRIEVAL_STATUS_UNSPECIFIED"
      | "URL_RETRIEVAL_STATUS_SUCCESS"
      | "URL_RETRIEVAL_STATUS_ERROR"
      | "URL_RETRIEVAL_STATUS_PAYWALL"
      | "URL_RETRIEVAL_STATUS_UNSAFE";
  }> = [];
  let searchEntryPointRenderedContent: string | undefined;

  // Map URL/Place/Title to chunk index so citations can reference groundingChunks
  const urlToChunkIndex = new Map<string, number>();

  for (const step of builtInToolSteps) {
    if (step.type === "google_search_call") {
      for (const q of step.arguments?.queries ?? []) {
        if (q && !webSearchQueries.includes(q)) {
          webSearchQueries.push(q);
        }
      }
    } else if (step.type === "google_search_result") {
      for (const item of step.result ?? []) {
        const rawItem = item as Gemini.Interactions.GoogleSearchResultItem & {
          url?: string;
          title?: string;
          rendered_content?: string;
        };
        if (rawItem.rendered_content && !searchEntryPointRenderedContent) {
          searchEntryPointRenderedContent = rawItem.rendered_content;
        }
        if (rawItem.url || rawItem.title) {
          const chunkIndex = groundingChunks.length;
          groundingChunks.push({
            web: {
              ...(rawItem.url ? { uri: rawItem.url } : {}),
              ...(rawItem.title ? { title: rawItem.title } : {}),
            },
          });
          if (rawItem.url && !urlToChunkIndex.has(rawItem.url)) {
            urlToChunkIndex.set(rawItem.url, chunkIndex);
          }
        }
      }
    } else if (step.type === "google_maps_call") {
      for (const q of step.arguments?.queries ?? []) {
        if (q && !webSearchQueries.includes(q)) {
          webSearchQueries.push(q);
        }
      }
    } else if (step.type === "google_maps_result") {
      for (const item of step.result ?? []) {
        for (const place of item.places ?? []) {
          const chunkIndex = groundingChunks.length;
          groundingChunks.push({
            maps: {
              ...(place.url ? { uri: place.url } : {}),
              ...(place.name ? { title: place.name } : {}),
              ...(place.place_id ? { placeId: place.place_id } : {}),
            },
          });
          if (place.url && !urlToChunkIndex.has(place.url)) {
            urlToChunkIndex.set(place.url, chunkIndex);
          }
        }
      }
    } else if (step.type === "file_search_result") {
      for (const item of step.result ?? []) {
        groundingChunks.push({
          retrievedContext: {
            ...(item.title ? { title: item.title } : {}),
            ...(item.text ? { text: item.text } : {}),
            ...(item.file_search_store
              ? { fileSearchStore: item.file_search_store }
              : {}),
          },
        });
      }
    } else if (step.type === "url_context_result") {
      for (const item of step.result ?? []) {
        let status:
          | "URL_RETRIEVAL_STATUS_UNSPECIFIED"
          | "URL_RETRIEVAL_STATUS_SUCCESS"
          | "URL_RETRIEVAL_STATUS_ERROR"
          | "URL_RETRIEVAL_STATUS_PAYWALL"
          | "URL_RETRIEVAL_STATUS_UNSAFE" = "URL_RETRIEVAL_STATUS_UNSPECIFIED";
        switch (item.status) {
          case "success":
            status = "URL_RETRIEVAL_STATUS_SUCCESS";
            break;
          case "error":
            status = "URL_RETRIEVAL_STATUS_ERROR";
            break;
          case "paywall":
            status = "URL_RETRIEVAL_STATUS_PAYWALL";
            break;
          case "unsafe":
            status = "URL_RETRIEVAL_STATUS_UNSAFE";
            break;
          default:
            status = "URL_RETRIEVAL_STATUS_UNSPECIFIED";
        }
        urlMetadataList.push({
          ...(item.url ? { retrievedUrl: item.url } : {}),
          urlRetrievalStatus: status,
        });
      }
    }
  }

  for (let partIndex = 0; partIndex < textSegments.length; partIndex++) {
    const seg = textSegments[partIndex];
    for (const annotation of seg.annotations ?? []) {
      if (annotation.type === "url_citation") {
        citationSources.push({
          ...(typeof annotation.start_index === "number"
            ? { startIndex: annotation.start_index }
            : {}),
          ...(typeof annotation.end_index === "number"
            ? { endIndex: annotation.end_index }
            : {}),
          ...(annotation.url ? { uri: annotation.url } : {}),
        });

        let chunkIdx = annotation.url
          ? urlToChunkIndex.get(annotation.url)
          : undefined;
        if (chunkIdx === undefined && (annotation.url || annotation.title)) {
          chunkIdx = groundingChunks.length;
          groundingChunks.push({
            web: {
              ...(annotation.url ? { uri: annotation.url } : {}),
              ...(annotation.title ? { title: annotation.title } : {}),
            },
          });
          if (annotation.url) {
            urlToChunkIndex.set(annotation.url, chunkIdx);
          }
        }

        groundingSupports.push({
          segment: {
            partIndex,
            ...(typeof annotation.start_index === "number"
              ? { startIndex: annotation.start_index }
              : {}),
            ...(typeof annotation.end_index === "number"
              ? { endIndex: annotation.end_index }
              : {}),
          },
          ...(chunkIdx !== undefined ? { groundingChunkIndices: [chunkIdx] } : {}),
        });
      } else if (annotation.type === "place_citation") {
        citationSources.push({
          ...(typeof annotation.start_index === "number"
            ? { startIndex: annotation.start_index }
            : {}),
          ...(typeof annotation.end_index === "number"
            ? { endIndex: annotation.end_index }
            : {}),
          ...(annotation.url ? { uri: annotation.url } : {}),
        });

        let chunkIdx = annotation.url
          ? urlToChunkIndex.get(annotation.url)
          : undefined;
        if (
          chunkIdx === undefined &&
          (annotation.url || annotation.name || annotation.place_id)
        ) {
          chunkIdx = groundingChunks.length;
          groundingChunks.push({
            maps: {
              ...(annotation.url ? { uri: annotation.url } : {}),
              ...(annotation.name ? { title: annotation.name } : {}),
              ...(annotation.place_id ? { placeId: annotation.place_id } : {}),
            },
          });
          if (annotation.url) {
            urlToChunkIndex.set(annotation.url, chunkIdx);
          }
        }

        groundingSupports.push({
          segment: {
            partIndex,
            ...(typeof annotation.start_index === "number"
              ? { startIndex: annotation.start_index }
              : {}),
            ...(typeof annotation.end_index === "number"
              ? { endIndex: annotation.end_index }
              : {}),
          },
          ...(chunkIdx !== undefined ? { groundingChunkIndices: [chunkIdx] } : {}),
        });
      } else if (annotation.type === "file_citation") {
        citationSources.push({
          ...(typeof annotation.start_index === "number"
            ? { startIndex: annotation.start_index }
            : {}),
          ...(typeof annotation.end_index === "number"
            ? { endIndex: annotation.end_index }
            : {}),
          ...(annotation.document_uri ? { uri: annotation.document_uri } : {}),
        });
      }
    }
  }

  const hasGrounding =
    webSearchQueries.length > 0 ||
    groundingChunks.length > 0 ||
    groundingSupports.length > 0 ||
    Boolean(searchEntryPointRenderedContent);

  const groundingMetadata: Gemini.GroundingMetadata | undefined = hasGrounding
    ? {
        ...(webSearchQueries.length > 0 ? { webSearchQueries } : {}),
        ...(groundingChunks.length > 0 ? { groundingChunks } : {}),
        ...(groundingSupports.length > 0 ? { groundingSupports } : {}),
        ...(searchEntryPointRenderedContent
          ? {
              searchEntryPoint: {
                renderedContent: searchEntryPointRenderedContent,
              },
            }
          : {}),
      }
    : undefined;

  const groundingSupport = groundingMetadata?.groundingSupports?.filter(
    (s) => (s?.segment?.partIndex ?? 0) === 0
  );

  const citationMetadata: Gemini.CitationMetadata | undefined =
    citationSources.length > 0 ? { citationSources } : undefined;

  const urlContextMetadata:
    | Gemini.GenContent.Candidate["urlContextMetadata"]
    | undefined =
    urlMetadataList.length > 0 ? { urlMetadata: urlMetadataList } : undefined;

  return {
    ...(groundingMetadata ? { groundingMetadata } : {}),
    ...(groundingSupport && groundingSupport.length > 0
      ? { groundingSupport }
      : {}),
    ...(citationMetadata ? { citationMetadata } : {}),
    ...(urlContextMetadata ? { urlContextMetadata } : {}),
  };
}

/**
 * Converts an Interactions API `Interaction` response into a LangChain `AIMessage`
 * along with `finishReason` and `usageMetadata`.
 *
 * ### ThoughtStep & `thoughtSignature` Inbound Mapping
 *
 * In `convertGeminiCandidateToAIMessage` (GenerateContent):
 * - A `Gemini.Part` with `thought: true` is treated as content-bearing (`!!p.thought === true`),
 *   which causes `AIMessage.content` to remain an array of content blocks (so the user can inspect
 *   the reasoning block alongside the text block).
 * - A `Gemini.Part` with `{ text: "Hello", thoughtSignature: "sig..." }` (or a trailing
 *   metadata-only `{ thoughtSignature: "sig..." }` part with `thought` undefined) is NOT a
 *   reasoning block: if there is a single text part, `AIMessage.content` collapses to the plain
 *   string `"Hello"` and `additional_kwargs.originalTextContentBlock` preserves
 *   `{ type: "text", text: "Hello", thoughtSignature: "sig..." }`.
 * - A `Gemini.Part` with `{ functionCall: {...}, thoughtSignature: "sig..." }` attaches
 *   `thoughtSignature` directly to `aiMessage.tool_calls[i].thoughtSignature`.
 *
 * In the Interactions API, the model emits `{ type: "thought", signature: "sig...", summary?: [...] }`:
 * - Even when `thinking_summaries` is NOT enabled (`summary` is undefined or empty), Gemini 2.5 / 3
 *   still emits a `ThoughtStep` containing `signature` before a `ModelOutputStep` or `FunctionCallStep`.
 * - Therefore:
 *   1. If `step.summary` is non-empty, we emit `Gemini.Part`(s) with `thought: true` and
 *      `thoughtSignature: step.signature`. This produces a reasoning block in `AIMessage.content`
 *      and `AIMessage.contentBlocks`.
 *   2. If `step.summary` is empty/undefined (signature-only), we do NOT emit a `{ thought: true }`
 *      part (which would prevent `AIMessage.content` from collapsing to a plain string!). Instead,
 *      we hold `pendingThoughtSignature = step.signature` and attach `thoughtSignature` to the
 *      next `FunctionCallStep` part or `ModelOutputStep` part (or as a metadata-only
 *      `{ thoughtSignature }` part if no step follows).
 */
export function convertInteractionToAIMessage(
  interaction: Gemini.Interactions.Interaction
): {
  message: AIMessage;
  finishReason?: string;
  usageMetadata?: UsageMetadata;
} {
  const rawItems = interaction.steps ?? interaction.outputs ?? [];
  const steps = rawItems.map(normalizeInteractionStep);

  const geminiParts: Gemini.Part[] = [];
  const textSegments: Array<{
    text: string;
    annotations?: Gemini.Interactions.Annotation[];
  }> = [];
  const builtInToolSteps: Gemini.Interactions.Step[] = [];

  let pendingThoughtSignature: string | undefined;

  for (const step of steps) {
    switch (step.type) {
      case "thought": {
        const summaries = step.summary ?? [];
        const textSummaries = summaries.filter(
          (c): c is Gemini.Interactions.TextContent =>
            c.type === "text" && typeof c.text === "string" && c.text.length > 0
        );

        if (textSummaries.length > 0) {
          for (let i = 0; i < textSummaries.length; i++) {
            const isLast = i === textSummaries.length - 1;
            geminiParts.push({
              text: textSummaries[i].text,
              thought: true,
              ...(isLast && step.signature
                ? { thoughtSignature: step.signature }
                : {}),
            });
          }
          pendingThoughtSignature = undefined;
        } else if (step.signature) {
          pendingThoughtSignature = step.signature;
        }
        break;
      }

      case "model_output": {
        if (step.error?.message) {
          throw new GoogleError(
            `Google Interactions API model output error (${step.error.code ?? "unknown"}): ${step.error.message}`
          );
        }

        const contents: Gemini.Interactions.Content[] =
          typeof step.content === "string"
            ? [{ type: "text", text: step.content }]
            : (step.content ?? []);

        for (const contentItem of contents) {
          if (contentItem.type === "text") {
            textSegments.push({
              text: contentItem.text,
              annotations: contentItem.annotations,
            });
          }
          const part = convertInteractionsContentToGeminiPart(
            contentItem,
            pendingThoughtSignature
          );
          if (part) {
            geminiParts.push(part);
            pendingThoughtSignature = undefined;
          }
        }
        break;
      }

      case "function_call": {
        geminiParts.push({
          functionCall: {
            id: step.id,
            name: step.name,
            args: step.arguments ?? {},
          },
          ...(pendingThoughtSignature
            ? { thoughtSignature: pendingThoughtSignature }
            : {}),
        });
        pendingThoughtSignature = undefined;
        break;
      }

      case "code_execution_call": {
        geminiParts.push({
          executableCode: {
            code: step.arguments?.code ?? "",
            language: "PYTHON",
          },
          ...(step.signature || pendingThoughtSignature
            ? { thoughtSignature: step.signature ?? pendingThoughtSignature }
            : {}),
        });
        pendingThoughtSignature = undefined;
        break;
      }

      case "code_execution_result": {
        geminiParts.push({
          codeExecutionResult: {
            output: step.result ?? "",
            outcome: step.is_error ? "OUTCOME_FAILED" : "OUTCOME_OK",
          },
          ...(step.signature || pendingThoughtSignature
            ? { thoughtSignature: step.signature ?? pendingThoughtSignature }
            : {}),
        });
        pendingThoughtSignature = undefined;
        break;
      }

      case "google_search_call":
      case "google_search_result":
      case "google_maps_call":
      case "google_maps_result":
      case "file_search_call":
      case "file_search_result":
      case "url_context_call":
      case "url_context_result":
      case "mcp_server_tool_call":
      case "mcp_server_tool_result":
      case "processing_call":
      case "processing_result":
      case "retrieval_call":
      case "retrieval_result": {
        builtInToolSteps.push(step);
        break;
      }

      default:
        break;
    }
  }

  // If a signature-only ThoughtStep remained at the end, push a metadata-only part
  // with `thoughtSignature` (and without `thought: true`), matching GenerateContent's
  // trailing `{ text: "", thoughtSignature }` behavior.
  if (pendingThoughtSignature) {
    geminiParts.push({
      thoughtSignature: pendingThoughtSignature,
    });
  }

  const blockContent: ContentBlock[] = geminiParts
    .map((part) => convertGeminiPartToContentBlock(part))
    .filter((block): block is ContentBlock => block !== null);

  let content: string | ContentBlock[] = blockContent;
  let originalTextContentBlock: ContentBlock | undefined;

  const hasContentPayload = (p: ContentBlock) =>
    p.type !== "text" || (typeof p.text === "string" && p.text.length > 0) || !!p.thought;
  const contentBearingParts = blockContent.filter(hasContentPayload);

  if (blockContent.length === 1 && blockContent[0].type === "text") {
    originalTextContentBlock = blockContent[0];
    content = blockContent[0].text as string;
  } else if (
    contentBearingParts.length === 1 &&
    contentBearingParts[0].type === "text" &&
    !contentBearingParts[0].thought
  ) {
    // Collapse when there is one text part and any other parts are metadata-only (e.g. thoughtSignature)
    const textPart = contentBearingParts[0];
    const sigSource = blockContent.find((p) => p !== textPart && p.thoughtSignature);
    originalTextContentBlock = sigSource
      ? { ...textPart, thoughtSignature: sigSource.thoughtSignature }
      : textPart;
    content = textPart.text as string;
  } else if (blockContent.length === 0) {
    content = "";
  }

  const toolCalls = convertGeminiPartsToToolCalls(geminiParts);
  const usageMetadata = convertInteractionsUsageToUsageMetadata(
    interaction.usage
  );

  const synthesized = synthesizeMetadataFromInteractions({
    textSegments,
    builtInToolSteps,
  });

  let finishReason: string | undefined;
  if (interaction.status === "completed") {
    finishReason = "STOP";
  } else if (interaction.status === "requires_action") {
    finishReason = "STOP";
  } else if (interaction.status) {
    finishReason = interaction.status.toUpperCase();
  }

  const responseMetadata: Record<string, unknown> = {
    model_provider: "google",
    ...(interaction.model ? { model_name: interaction.model } : {}),
    ...(finishReason ? { finishReason } : {}),
    ...synthesized,
    ...(builtInToolSteps.length > 0
      ? { interactionSteps: builtInToolSteps }
      : {}),
    interaction: {
      ...(interaction.id ? { id: interaction.id } : {}),
      ...(interaction.status ? { status: interaction.status } : {}),
      ...(interaction.role ? { role: interaction.role } : {}),
      ...(interaction.previous_interaction_id
        ? { previous_interaction_id: interaction.previous_interaction_id }
        : {}),
    },
  };

  const additionalKwargs: Record<string, unknown> = {
    ...(finishReason ? { finishReason } : {}),
    ...(originalTextContentBlock ? { originalTextContentBlock } : {}),
  };

  const message = new AIMessage({
    content,
    tool_calls: toolCalls,
    additional_kwargs: additionalKwargs,
    usage_metadata: usageMetadata,
    response_metadata: responseMetadata,
  });

  return {
    message,
    finishReason,
    usageMetadata,
  };
}
