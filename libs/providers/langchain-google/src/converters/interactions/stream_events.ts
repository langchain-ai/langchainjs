import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import {
  AIMessageChunk,
  type ContentBlock,
  type UsageMetadata,
} from "@langchain/core/messages";
import type { ToolCall, ToolCallChunk } from "@langchain/core/messages/tool";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { v4 as uuidv4 } from "@langchain/core/utils/uuid";
import type { Gemini } from "../../chat_models/types.js";
import { GoogleError } from "../../utils/errors.js";
import {
  convertGeminiPartToContentBlock,
  convertGeminiPartsToToolCalls,
} from "../generate_content/messages.js";
import {
  convertInteractionsContentToGeminiPart,
  convertInteractionsUsageToUsageMetadata,
  normalizeInteractionStep,
  synthesizeMetadataFromInteractions,
} from "./messages.js";

export interface ConvertInteractionsStreamOptions {
  streamUsage?: boolean;
  model?: string;
  runManager?: CallbackManagerForLLMRun;
}

interface TrackedFunctionCallState {
  id: string;
  name: string;
  argsText: string;
  argsObject?: Record<string, unknown>;
  thoughtSignature?: string;
  toolIndex: number;
  emittedToolCall: boolean;
}

interface TrackedStepState {
  stepType?: string;
  hasThoughtSummary?: boolean;
  thoughtSignature?: string;
  textIndex?: number;
  functionCall?: TrackedFunctionCallState;
}

/**
 * Converts a stream of Interactions API SSE events (`InteractionSseEvent`) into
 * LangChain `ChatGenerationChunk` instances for `streamResponseChunks`.
 *
 * ### ThoughtStep & `thoughtSignature` Streaming Design
 *
 * During SSE streaming, a `ThoughtStep` arrives as a sequence of `step.delta` events:
 * - `{ type: "thought_summary", content: { type: "text", text: "..." } }`
 * - `{ type: "thought_signature", signature: "..." }`
 *
 * Matching `convertInteractionToAIMessage`:
 * 1. If a `ThoughtStep` emits one or more `thought_summary` deltas, we emit `AIMessageChunk`s
 *    containing `{ type: "text", thought: true, text }` and attach `thoughtSignature` when
 *    `thought_signature` arrives for that step. When concatenated via `concat()`, this forms
 *    a reasoning block with its `thoughtSignature`.
 * 2. If a `ThoughtStep` only emits `thought_signature` (no `thought_summary`), we do NOT emit
 *    a `{ thought: true }` block (which would prevent single-text responses from collapsing to
 *    a string on `concat()`). Instead, we store `pendingThoughtSignature` and attach it to the
 *    subsequent `function_call` or `model_output` chunk (or as a metadata-only
 *    `{ type: "text", text: "", thoughtSignature }` chunk at the end of the stream).
 */
export async function* convertInteractionsStreamToChunks(
  source: AsyncIterable<Gemini.Interactions.InteractionSseEvent>,
  options: ConvertInteractionsStreamOptions = {}
): AsyncGenerator<ChatGenerationChunk> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const runManager = options.runManager;

  const stepStates = new Map<number, TrackedStepState>();
  const textSegments: Array<{
    text: string;
    annotations?: Gemini.Interactions.Annotation[];
  }> = [];
  const builtInToolSteps: Gemini.Interactions.Step[] = [];

  let interactionId: string | undefined;
  let interactionStatus: string | undefined;
  let interactionRole: string | undefined;
  let previousInteractionId: string | undefined;
  let modelName: string | undefined = options.model;
  let latestUsage: Gemini.Interactions.Usage | undefined;
  let pendingThoughtSignature: string | undefined;
  let hasEmittedStepDelta = false;
  let nextToolIndex = 0;

  const getOrCreateStepState = (index: number): TrackedStepState => {
    let state = stepStates.get(index);
    if (!state) {
      state = {};
      stepStates.set(index, state);
    }
    return state;
  };

  const emitFunctionCallChunk = (
    fcState: TrackedFunctionCallState
  ): ChatGenerationChunk => {
    let parsedArgs: Record<string, unknown> = fcState.argsObject ?? {};
    if (!fcState.argsObject && fcState.argsText.trim().length > 0) {
      try {
        const parsed = JSON.parse(fcState.argsText);
        if (typeof parsed === "object" && parsed !== null) {
          parsedArgs = parsed as Record<string, unknown>;
        }
      } catch {
        parsedArgs = {};
      }
    }

    const argsString =
      fcState.argsText.length > 0
        ? fcState.argsText
        : JSON.stringify(parsedArgs);

    const toolCall: ToolCall & { thoughtSignature?: string } = {
      type: "tool_call",
      id: fcState.id,
      name: fcState.name,
      args: parsedArgs,
      ...(fcState.thoughtSignature
        ? { thoughtSignature: fcState.thoughtSignature }
        : {}),
    };

    const toolCallChunk: ToolCallChunk = {
      type: "tool_call_chunk",
      id: fcState.id,
      name: fcState.name,
      args: argsString,
      index: fcState.toolIndex,
    };

    const part: Gemini.Part = {
      functionCall: {
        id: fcState.id,
        name: fcState.name,
        args: parsedArgs,
      },
      ...(fcState.thoughtSignature
        ? { thoughtSignature: fcState.thoughtSignature }
        : {}),
    };
    const block = convertGeminiPartToContentBlock(part);

    fcState.emittedToolCall = true;

    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: block ? [block] : "",
        tool_calls: [toolCall],
        tool_call_chunks: [toolCallChunk],
        response_metadata: {
          model_provider: "google",
          ...(modelName ? { model_name: modelName } : {}),
        },
      }),
    });
  };

  for await (const event of source) {
    switch (event.event_type) {
      case "interaction.created":
      case "interaction.start": {
        if (event.interaction) {
          interactionId = event.interaction.id ?? interactionId;
          interactionStatus = event.interaction.status ?? interactionStatus;
          interactionRole = event.interaction.role ?? interactionRole;
          previousInteractionId =
            event.interaction.previous_interaction_id ?? previousInteractionId;
          modelName = event.interaction.model ?? modelName;
          if (event.interaction.usage) {
            latestUsage = event.interaction.usage;
          }
        }
        break;
      }

      case "step.start":
      case "content.start": {
        const state = getOrCreateStepState(event.index);
        const rawStep = event.step ?? event.content;
        if (rawStep) {
          const step = normalizeInteractionStep(rawStep);
          state.stepType = step.type;
          if (step.type === "function_call") {
            const sig = pendingThoughtSignature;
            pendingThoughtSignature = undefined;
            const hasInitialArgs =
              step.arguments && Object.keys(step.arguments).length > 0;
            state.functionCall = {
              id:
                step.id || `lc-tool-call-${uuidv4().replace(/-/g, "")}`,
              name: step.name || "",
              argsText: hasInitialArgs ? JSON.stringify(step.arguments) : "",
              argsObject: hasInitialArgs ? step.arguments : undefined,
              thoughtSignature: sig,
              toolIndex: nextToolIndex++,
              emittedToolCall: false,
            };
          } else if (step.type === "thought" && step.signature) {
            state.thoughtSignature = step.signature;
          }
        }
        break;
      }

      case "step.delta":
      case "content.delta": {
        const state = getOrCreateStepState(event.index);
        if (event.metadata?.total_usage) {
          latestUsage = event.metadata.total_usage;
        }

        const delta = event.delta;
        if (!delta) break;

        switch (delta.type) {
          case "text": {
            hasEmittedStepDelta = true;
            if (state.textIndex === undefined) {
              state.textIndex = textSegments.length;
              textSegments.push({ text: "", annotations: [] });
            }
            const seg = textSegments[state.textIndex];
            seg.text += delta.text;

            const sig = pendingThoughtSignature;
            pendingThoughtSignature = undefined;

            const part: Gemini.Part = {
              text: delta.text,
              ...(sig ? { thoughtSignature: sig } : {}),
            };
            const textBlock = convertGeminiPartToContentBlock(part)!;

            const chunk = new ChatGenerationChunk({
              text: delta.text,
              message: new AIMessageChunk({
                content: delta.text,
                additional_kwargs: {
                  originalTextContentBlock: textBlock,
                },
                response_metadata: {
                  model_provider: "google",
                  ...(modelName ? { model_name: modelName } : {}),
                },
              }),
            });
            yield chunk;
            await runManager?.handleLLMNewToken(delta.text);
            break;
          }

          case "text_annotation_delta":
          case "text_annotation": {
            if (state.textIndex === undefined) {
              state.textIndex = textSegments.length;
              textSegments.push({ text: "", annotations: [] });
            }
            const seg = textSegments[state.textIndex];
            seg.annotations = [
              ...(seg.annotations ?? []),
              ...(delta.annotations ?? []),
            ];
            break;
          }

          case "thought_summary": {
            hasEmittedStepDelta = true;
            state.hasThoughtSummary = true;
            const summaryText =
              delta.content?.type === "text" ? delta.content.text : "";
            if (summaryText) {
              const part: Gemini.Part = {
                text: summaryText,
                thought: true,
                ...(state.thoughtSignature
                  ? { thoughtSignature: state.thoughtSignature }
                  : {}),
              };
              const block = convertGeminiPartToContentBlock(part)!;
              state.thoughtSignature = undefined;

              const chunk = new ChatGenerationChunk({
                text: "",
                message: new AIMessageChunk({
                  content: [block],
                  response_metadata: {
                    model_provider: "google",
                    ...(modelName ? { model_name: modelName } : {}),
                  },
                }),
              });
              yield chunk;
              await runManager?.handleLLMNewToken(summaryText);
            }
            break;
          }

          case "thought_signature": {
            if (delta.signature) {
              if (state.hasThoughtSummary) {
                hasEmittedStepDelta = true;
                const part: Gemini.Part = {
                  text: "",
                  thought: true,
                  thoughtSignature: delta.signature,
                };
                const block = convertGeminiPartToContentBlock(part)!;
                yield new ChatGenerationChunk({
                  text: "",
                  message: new AIMessageChunk({
                    content: [block],
                    response_metadata: {
                      model_provider: "google",
                      ...(modelName ? { model_name: modelName } : {}),
                    },
                  }),
                });
              } else {
                pendingThoughtSignature = delta.signature;
                state.thoughtSignature = delta.signature;
              }
            }
            break;
          }

          case "arguments_delta":
          case "function_call": {
            hasEmittedStepDelta = true;
            if (!state.functionCall) {
              const sig = pendingThoughtSignature;
              pendingThoughtSignature = undefined;
              state.functionCall = {
                id:
                  delta.id ||
                  `lc-tool-call-${uuidv4().replace(/-/g, "")}`,
                name: delta.name || "",
                argsText: "",
                thoughtSignature: sig,
                toolIndex: nextToolIndex++,
                emittedToolCall: false,
              };
            } else {
              if (delta.id) state.functionCall.id = delta.id;
              if (delta.name) state.functionCall.name = delta.name;
              if (pendingThoughtSignature && !state.functionCall.thoughtSignature) {
                state.functionCall.thoughtSignature = pendingThoughtSignature;
                pendingThoughtSignature = undefined;
              }
            }

            if (typeof delta.arguments === "string") {
              state.functionCall.argsText += delta.arguments;
            } else if (
              typeof delta.arguments === "object" &&
              delta.arguments !== null
            ) {
              state.functionCall.argsObject = delta.arguments;
              state.functionCall.argsText = JSON.stringify(delta.arguments);
              yield emitFunctionCallChunk(state.functionCall);
              await runManager?.handleLLMNewToken("");
            }
            break;
          }

          case "image":
          case "audio":
          case "document":
          case "video": {
            hasEmittedStepDelta = true;
            const sig = pendingThoughtSignature;
            pendingThoughtSignature = undefined;
            const part = convertInteractionsContentToGeminiPart(
              delta as Gemini.Interactions.Content,
              sig
            );
            if (part) {
              const block = convertGeminiPartToContentBlock(part);
              if (block) {
                yield new ChatGenerationChunk({
                  text: "",
                  message: new AIMessageChunk({
                    content: [block],
                    response_metadata: {
                      model_provider: "google",
                      ...(modelName ? { model_name: modelName } : {}),
                    },
                  }),
                });
                await runManager?.handleLLMNewToken("");
              }
            }
            break;
          }

          case "code_execution_call": {
            hasEmittedStepDelta = true;
            const sig = delta.signature ?? pendingThoughtSignature;
            pendingThoughtSignature = undefined;
            const part: Gemini.Part = {
              executableCode: {
                code: delta.arguments?.code ?? "",
                language: "PYTHON",
              },
              ...(sig ? { thoughtSignature: sig } : {}),
            };
            const block = convertGeminiPartToContentBlock(part);
            if (block) {
              yield new ChatGenerationChunk({
                text: "",
                message: new AIMessageChunk({
                  content: [block],
                  response_metadata: {
                    model_provider: "google",
                    ...(modelName ? { model_name: modelName } : {}),
                  },
                }),
              });
              await runManager?.handleLLMNewToken("");
            }
            break;
          }

          case "code_execution_result": {
            hasEmittedStepDelta = true;
            const sig = delta.signature ?? pendingThoughtSignature;
            pendingThoughtSignature = undefined;
            const part: Gemini.Part = {
              codeExecutionResult: {
                output: delta.result ?? "",
                outcome: delta.is_error ? "OUTCOME_FAILED" : "OUTCOME_OK",
              },
              ...(sig ? { thoughtSignature: sig } : {}),
            };
            const block = convertGeminiPartToContentBlock(part);
            if (block) {
              yield new ChatGenerationChunk({
                text: "",
                message: new AIMessageChunk({
                  content: [block],
                  response_metadata: {
                    model_provider: "google",
                    ...(modelName ? { model_name: modelName } : {}),
                  },
                }),
              });
              await runManager?.handleLLMNewToken("");
            }
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
            builtInToolSteps.push(
              delta as unknown as Gemini.Interactions.Step
            );
            break;
          }

          default:
            break;
        }
        break;
      }

      case "step.stop":
      case "content.stop": {
        const state = stepStates.get(event.index);
        if (event.usage) {
          latestUsage = event.usage;
        } else if (event.step_usage && !latestUsage) {
          latestUsage = event.step_usage;
        }
        if (state?.functionCall && !state.functionCall.emittedToolCall) {
          hasEmittedStepDelta = true;
          yield emitFunctionCallChunk(state.functionCall);
          await runManager?.handleLLMNewToken("");
        }
        break;
      }

      case "interaction.status_update": {
        interactionId = event.interaction_id ?? interactionId;
        interactionStatus = event.status ?? interactionStatus;
        if (event.usage) {
          latestUsage = event.usage;
        }
        break;
      }

      case "interaction.completed":
      case "interaction.complete": {
        if (event.interaction) {
          interactionId = event.interaction.id ?? interactionId;
          interactionStatus = event.interaction.status ?? interactionStatus;
          interactionRole = event.interaction.role ?? interactionRole;
          previousInteractionId =
            event.interaction.previous_interaction_id ?? previousInteractionId;
          modelName = event.interaction.model ?? modelName;
          if (event.interaction.usage) {
            latestUsage = event.interaction.usage;
          }

          // If no step deltas were emitted before interaction.completed (e.g. a non-delta
          // completed event containing full steps), emit chunks from the completed steps.
          const completedItems =
            event.interaction.steps ?? event.interaction.outputs ?? [];
          if (!hasEmittedStepDelta && completedItems.length > 0) {
            const steps = completedItems.map(normalizeInteractionStep);
            const parts: Gemini.Part[] = [];
            for (const step of steps) {
              if (step.type === "thought") {
                const summaries = (step.summary ?? []).filter(
                  (c): c is Gemini.Interactions.TextContent =>
                    c.type === "text" &&
                    typeof c.text === "string" &&
                    c.text.length > 0
                );
                if (summaries.length > 0) {
                  for (let i = 0; i < summaries.length; i++) {
                    parts.push({
                      text: summaries[i].text,
                      thought: true,
                      ...(i === summaries.length - 1 && step.signature
                        ? { thoughtSignature: step.signature }
                        : {}),
                    });
                  }
                  pendingThoughtSignature = undefined;
                } else if (step.signature) {
                  pendingThoughtSignature = step.signature;
                }
              } else if (step.type === "model_output") {
                const contents =
                  typeof step.content === "string"
                    ? [{ type: "text" as const, text: step.content }]
                    : (step.content ?? []);
                for (const c of contents) {
                  if (c.type === "text") {
                    textSegments.push({
                      text: c.text,
                      annotations: c.annotations,
                    });
                  }
                  const p = convertInteractionsContentToGeminiPart(
                    c,
                    pendingThoughtSignature
                  );
                  if (p) {
                    parts.push(p);
                    pendingThoughtSignature = undefined;
                  }
                }
              } else if (step.type === "function_call") {
                parts.push({
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
              } else if (
                step.type === "google_search_call" ||
                step.type === "google_search_result" ||
                step.type === "google_maps_call" ||
                step.type === "google_maps_result" ||
                step.type === "file_search_call" ||
                step.type === "file_search_result" ||
                step.type === "url_context_call" ||
                step.type === "url_context_result"
              ) {
                builtInToolSteps.push(step);
              }
            }

            if (parts.length > 0) {
              const blockContent = parts
                .map((p) => convertGeminiPartToContentBlock(p))
                .filter((b): b is ContentBlock => b !== null);
              const toolCalls = convertGeminiPartsToToolCalls(parts);
              const toolCallChunks: ToolCallChunk[] = toolCalls.map(
                (tc, idx) => ({
                  type: "tool_call_chunk",
                  id: tc.id,
                  name: tc.name,
                  args: JSON.stringify(tc.args ?? {}),
                  index: idx,
                })
              );
              const singleText =
                blockContent.length === 1 &&
                blockContent[0].type === "text" &&
                !blockContent[0].thought
                  ? (blockContent[0].text as string)
                  : undefined;

              hasEmittedStepDelta = true;
              yield new ChatGenerationChunk({
                text: singleText ?? "",
                message: new AIMessageChunk({
                  content: singleText ?? blockContent,
                  tool_calls: toolCalls,
                  tool_call_chunks: toolCallChunks,
                  additional_kwargs: singleText
                    ? { originalTextContentBlock: blockContent[0] }
                    : {},
                  response_metadata: {
                    model_provider: "google",
                    ...(modelName ? { model_name: modelName } : {}),
                  },
                }),
              });
              await runManager?.handleLLMNewToken(singleText ?? "");
            }
          }
        }
        break;
      }

      case "error": {
        throw new GoogleError(
          `Google Interactions API stream error (${event.error?.code ?? "unknown"}): ${event.error?.message ?? "Unknown error"}`
        );
      }

      default:
        break;
    }
  }

  // Flush any un-emitted function calls if a stream ended without step.stop
  for (const state of stepStates.values()) {
    if (state.functionCall && !state.functionCall.emittedToolCall) {
      hasEmittedStepDelta = true;
      yield emitFunctionCallChunk(state.functionCall);
      await runManager?.handleLLMNewToken("");
    }
  }

  const usageMetadata = shouldStreamUsage
    ? convertInteractionsUsageToUsageMetadata(latestUsage)
    : undefined;

  const synthesized = synthesizeMetadataFromInteractions({
    textSegments,
    builtInToolSteps,
  });

  let finishReason: string | undefined;
  if (
    interactionStatus === "completed" ||
    interactionStatus === "requires_action"
  ) {
    finishReason = "STOP";
  } else if (interactionStatus) {
    finishReason = interactionStatus.toUpperCase();
  }

  const trailingSigBlock: ContentBlock | undefined = pendingThoughtSignature
    ? {
        type: "text",
        text: "",
        thoughtSignature: pendingThoughtSignature,
      }
    : undefined;

  if (
    usageMetadata ||
    finishReason ||
    trailingSigBlock ||
    Object.keys(synthesized).length > 0 ||
    interactionId ||
    !hasEmittedStepDelta
  ) {
    yield new ChatGenerationChunk({
      text: "",
      generationInfo: {
        ...(finishReason ? { finishReason } : {}),
      },
      message: new AIMessageChunk({
        content: "",
        ...(usageMetadata ? { usage_metadata: usageMetadata } : {}),
        additional_kwargs: {
          ...(finishReason ? { finishReason } : {}),
          ...(trailingSigBlock
            ? { originalTextContentBlock: trailingSigBlock }
            : {}),
        },
        response_metadata: {
          model_provider: "google",
          ...(modelName ? { model_name: modelName } : {}),
          ...(finishReason ? { finishReason } : {}),
          ...synthesized,
          ...(builtInToolSteps.length > 0
            ? { interactionSteps: builtInToolSteps }
            : {}),
          ...(interactionId || interactionStatus
            ? {
                interaction: {
                  ...(interactionId ? { id: interactionId } : {}),
                  ...(interactionStatus ? { status: interactionStatus } : {}),
                  ...(interactionRole ? { role: interactionRole } : {}),
                  ...(previousInteractionId
                    ? { previous_interaction_id: previousInteractionId }
                    : {}),
                },
              }
            : {}),
        },
      }),
    });
  }
}

type BlockKey = "text" | "reasoning" | `tool:${number}`;

/**
 * Converts a stream of Interactions API SSE events (`InteractionSseEvent`) into
 * LangChain `ChatModelStreamEvent`s for `streamChatModelEvents`.
 */
export async function* convertInteractionsStream(
  source: AsyncIterable<Gemini.Interactions.InteractionSseEvent>,
  options: { streamUsage?: boolean; model?: string } = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  const blockKeyToIndex = new Map<BlockKey, number>();
  let nextBlockIndex = 0;
  let messageStarted = false;
  let usageSnapshot: UsageMetadata | undefined;
  const finishReason: FinishReason = "stop";
  let pendingThoughtSignature: string | undefined;
  let nextToolIdx = 0;

  const stepStates = new Map<
    number,
    {
      hasThoughtSummary?: boolean;
      toolIdx?: number;
      toolId?: string;
      toolName?: string;
      textIndex?: number;
    }
  >();
  const textSegments: Array<{
    text: string;
    annotations?: Gemini.Interactions.Annotation[];
  }> = [];
  const builtInToolSteps: Gemini.Interactions.Step[] = [];

  const getOrCreateBlockIndex = (
    key: BlockKey,
    initial: Record<string, unknown>
  ): { index: number; isNew: boolean } => {
    const existing = blockKeyToIndex.get(key);
    if (existing !== undefined) {
      return { index: existing, isNew: false };
    }
    const index = nextBlockIndex++;
    blockKeyToIndex.set(key, index);
    blockAccumulators.set(index, { ...initial });
    return { index, isNew: true };
  };

  const ensureMessageStarted = (): ChatModelStreamEvent | undefined => {
    if (!messageStarted) {
      messageStarted = true;
      return { event: "message-start" as const };
    }
    return undefined;
  };

  for await (const event of source) {
    const startEv = ensureMessageStarted();
    if (startEv) yield startEv;

    if (event.event_type === "step.start" || event.event_type === "content.start") {
      const rawStep = event.step ?? event.content;
      if (rawStep) {
        const step = normalizeInteractionStep(rawStep);
        if (step.type === "function_call") {
          stepStates.set(event.index, {
            toolIdx: nextToolIdx++,
            toolId: step.id,
            toolName: step.name,
          });
        } else {
          stepStates.set(event.index, {});
        }
      }
      continue;
    }

    if (event.event_type === "step.delta" || event.event_type === "content.delta") {
      if (shouldStreamUsage && event.metadata?.total_usage) {
        usageSnapshot = convertInteractionsUsageToUsageMetadata(
          event.metadata.total_usage
        );
        if (usageSnapshot) {
          yield { event: "usage" as const, usage: usageSnapshot };
        }
      }

      const delta = event.delta;
      if (!delta) continue;

      let state = stepStates.get(event.index);
      if (!state) {
        state = {};
        stepStates.set(event.index, state);
      }

      if (delta.type === "text") {
        if (state.textIndex === undefined) {
          state.textIndex = textSegments.length;
          textSegments.push({ text: "", annotations: [] });
        }
        textSegments[state.textIndex].text += delta.text;

        const key: BlockKey = "text";
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "text",
          text: "",
        });
        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: { type: "text", text: "" } as ContentBlock,
          };
        }
        const acc = blockAccumulators.get(index)!;
        acc.text = (acc.text ?? "") + delta.text;
        if (pendingThoughtSignature) {
          acc.thoughtSignature = pendingThoughtSignature;
          pendingThoughtSignature = undefined;
        }
        yield {
          event: "content-block-delta" as const,
          index,
          delta: { type: "text-delta" as const, text: delta.text },
        };
      } else if (
        delta.type === "text_annotation_delta" ||
        delta.type === "text_annotation"
      ) {
        if (state.textIndex === undefined) {
          state.textIndex = textSegments.length;
          textSegments.push({ text: "", annotations: [] });
        }
        const seg = textSegments[state.textIndex];
        seg.annotations = [
          ...(seg.annotations ?? []),
          ...(delta.annotations ?? []),
        ];
      } else if (delta.type === "thought_summary") {
        state.hasThoughtSummary = true;
        const summaryText =
          delta.content?.type === "text" ? delta.content.text : "";
        if (summaryText) {
          const key: BlockKey = "reasoning";
          const { index, isNew } = getOrCreateBlockIndex(key, {
            type: "reasoning",
            reasoning: "",
          });
          if (isNew) {
            yield {
              event: "content-block-start" as const,
              index,
              content: { type: "reasoning", reasoning: "" } as ContentBlock,
            };
          }
          const acc = blockAccumulators.get(index)!;
          acc.reasoning = (acc.reasoning ?? "") + summaryText;
          yield {
            event: "content-block-delta" as const,
            index,
            delta: { type: "reasoning-delta" as const, reasoning: summaryText },
          };
        }
      } else if (delta.type === "thought_signature") {
        if (delta.signature) {
          if (state.hasThoughtSummary) {
            const existingIdx = blockKeyToIndex.get("reasoning");
            if (existingIdx !== undefined) {
              const acc = blockAccumulators.get(existingIdx)!;
              acc.thoughtSignature = delta.signature;
            }
          } else {
            pendingThoughtSignature = delta.signature;
          }
        }
      } else if (
        delta.type === "arguments_delta" ||
        delta.type === "function_call"
      ) {
        if (state.toolIdx === undefined) {
          state.toolIdx = nextToolIdx++;
        }
        const toolIdx = state.toolIdx;
        const key: BlockKey = `tool:${toolIdx}`;
        const candidateId =
          delta.id ||
          state.toolId ||
          `lc-tool-call-${uuidv4().replace(/-/g, "")}`;
        const candidateName = delta.name || state.toolName || "";
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "tool_call_chunk",
          id: candidateId,
          name: candidateName,
          args: "",
          index: toolIdx,
        });
        const acc = blockAccumulators.get(index)!;
        if (delta.id) acc.id = delta.id;
        if (delta.name) acc.name = delta.name;
        const id = acc.id as string;

        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: {
              type: "tool_call_chunk",
              id,
              name: acc.name,
              args: "",
              index: toolIdx,
            } as ContentBlock,
          };
        }

        const argsDelta =
          typeof delta.arguments === "string"
            ? delta.arguments
            : JSON.stringify(delta.arguments ?? {});
        acc.args =
          typeof delta.arguments === "string"
            ? (acc.args ?? "") + argsDelta
            : argsDelta;

        if (pendingThoughtSignature) {
          acc.thoughtSignature = pendingThoughtSignature;
          pendingThoughtSignature = undefined;
        }

        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "tool_call_chunk",
              id,
              name: acc.name,
              args: argsDelta,
            },
          },
        };
      } else if (
        delta.type === "google_search_call" ||
        delta.type === "google_search_result" ||
        delta.type === "google_maps_call" ||
        delta.type === "google_maps_result" ||
        delta.type === "file_search_call" ||
        delta.type === "file_search_result" ||
        delta.type === "url_context_call" ||
        delta.type === "url_context_result"
      ) {
        builtInToolSteps.push(delta as unknown as Gemini.Interactions.Step);
      }
      continue;
    }

    if (
      event.event_type === "interaction.completed" ||
      event.event_type === "interaction.complete"
    ) {
      if (shouldStreamUsage && event.interaction?.usage) {
        usageSnapshot = convertInteractionsUsageToUsageMetadata(
          event.interaction.usage
        );
        if (usageSnapshot) {
          yield { event: "usage" as const, usage: usageSnapshot };
        }
      }
      continue;
    }

    if (event.event_type === "error") {
      throw new GoogleError(
        `Google Interactions API stream error (${event.error?.code ?? "unknown"}): ${event.error?.message ?? "Unknown error"}`
      );
    }
  }

  for (const [index, acc] of blockAccumulators) {
    const finalized = finalizeContentBlock(acc as ContentBlock);
    yield {
      event: "content-block-finish" as const,
      index,
      content: acc.thoughtSignature
        ? ({
            ...finalized,
            thoughtSignature: acc.thoughtSignature,
          } as ContentBlock)
        : finalized,
    };
  }

  const synthesized = synthesizeMetadataFromInteractions({
    textSegments,
    builtInToolSteps,
  });

  yield {
    event: "message-finish" as const,
    reason: finishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: {
      model_provider: "google",
      ...synthesized,
    },
  };
}
