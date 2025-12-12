/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelParams,
  BaseChatModelCallOptions,
  BindToolsInput,
  ToolChoice,
} from "@langchain/core/language_models/chat_models";
import { StructuredTool } from "@langchain/core/tools";
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  BaseMessageFields,
  AIMessageFields,
  ToolMessage,
  ToolMessageFields,
} from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import {
  Runnable,
  RunnableConfig,
  RunnableLambda,
  RunnableBinding,
} from "@langchain/core/runnables";
import {
  MemorySaver,
  Checkpoint,
  CheckpointMetadata,
  type BaseCheckpointSaver,
} from "@langchain/langgraph-checkpoint";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { z } from "zod/v3";

/**
 * Custom asymmetric matcher that matches any string value.
 * Works with both Jest and Vitest's toEqual() assertions.
 */
class AnyString {
  asymmetricMatch(other: unknown): boolean {
    return typeof other === "string";
  }

  toString(): string {
    return "Any<String>";
  }

  toAsymmetricMatcher(): string {
    return "Any<String>";
  }
}

export class _AnyIdAIMessage extends AIMessage {
  get lc_id() {
    return ["langchain_core", "messages", "AIMessage"];
  }

  constructor(fields: AIMessageFields | string) {
    let fieldsWithJestMatcher: Partial<AIMessageFields> = {
      id: new AnyString() as unknown as string,
    };
    if (typeof fields === "string") {
      fieldsWithJestMatcher = {
        content: fields,
        ...fieldsWithJestMatcher,
      };
    } else {
      fieldsWithJestMatcher = {
        ...fields,
        ...fieldsWithJestMatcher,
      };
    }
    super(fieldsWithJestMatcher as AIMessageFields);
  }
}

export class _AnyIdHumanMessage extends HumanMessage {
  get lc_id() {
    return ["langchain_core", "messages", "HumanMessage"];
  }

  constructor(fields: BaseMessageFields | string) {
    let fieldsWithJestMatcher: Partial<BaseMessageFields> = {
      id: new AnyString() as unknown as string,
    };
    if (typeof fields === "string") {
      fieldsWithJestMatcher = {
        content: fields,
        ...fieldsWithJestMatcher,
      };
    } else {
      fieldsWithJestMatcher = {
        ...fields,
        ...fieldsWithJestMatcher,
      };
    }
    super(fieldsWithJestMatcher as BaseMessageFields);
  }
}

export class _AnyIdToolMessage extends ToolMessage {
  get lc_id() {
    return ["langchain_core", "messages", "ToolMessage"];
  }

  constructor(fields: ToolMessageFields) {
    const fieldsWithJestMatcher: Partial<ToolMessageFields> = {
      id: new AnyString() as unknown as string,
      ...fields,
    };
    super(fieldsWithJestMatcher as ToolMessageFields);
  }
}

export class FakeConfigurableModel extends BaseChatModel {
  _queuedMethodOperations: Record<string, any> = {};

  _chatModel: LanguageModelLike;

  constructor(
    fields: {
      model: LanguageModelLike;
    } & BaseChatModelParams
  ) {
    super(fields);
    this._chatModel = fields.model;
  }

  _llmType() {
    return "fake_configurable";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    throw new Error("Not implemented");
  }

  async _model() {
    return this._chatModel;
  }

  bindTools(tools: BindToolsInput[]) {
    const modelWithTools = new FakeConfigurableModel({
      model: (this._chatModel as FakeToolCallingChatModel).bindTools(tools),
    });
    modelWithTools._queuedMethodOperations.bindTools = tools;
    return modelWithTools;
  }
}

export class FakeToolCallingChatModel extends BaseChatModel {
  sleep?: number = 50;

  responses?: BaseMessage[];

  thrownErrorString?: string;

  idx: number;

  toolStyle: "openai" | "anthropic" | "bedrock" | "google" = "openai";

  structuredResponse?: Record<string, unknown>;

  // Track messages passed to structured output calls
  structuredOutputMessages: BaseMessage[][] = [];

  constructor(
    fields: {
      sleep?: number;
      responses?: BaseMessage[];
      thrownErrorString?: string;
      toolStyle?: "openai" | "anthropic" | "bedrock" | "google";
      structuredResponse?: Record<string, unknown>;
    } & BaseChatModelParams
  ) {
    super(fields);
    this.sleep = fields.sleep ?? this.sleep;
    this.responses = fields.responses;
    this.thrownErrorString = fields.thrownErrorString;
    this.idx = 0;
    this.toolStyle = fields.toolStyle ?? this.toolStyle;
    this.structuredResponse = fields.structuredResponse;
    this.structuredOutputMessages = [];
  }

  _llmType() {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    if (this.sleep !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, this.sleep));
    }
    const responses = this.responses?.length ? this.responses : messages;
    const msg = responses[this.idx % responses.length];
    const generation: ChatResult = {
      generations: [
        {
          text: "",
          message: msg,
        },
      ],
    };
    this.idx += 1;

    if (typeof msg.content === "string") {
      await runManager?.handleLLMNewToken(msg.content);
    }
    return generation;
  }

  bindTools(tools: BindToolsInput[]): Runnable<any> {
    const toolDicts = [];
    const serverTools = [];
    for (const tool of tools) {
      if (!("name" in tool)) {
        serverTools.push(tool);
        continue;
      }

      // NOTE: this is a simplified tool spec for testing purposes only
      if (this.toolStyle === "openai") {
        toolDicts.push({
          type: "function",
          function: {
            name: tool.name,
          },
        });
      } else if (["anthropic", "google"].includes(this.toolStyle)) {
        toolDicts.push({
          name: tool.name,
        });
      } else if (this.toolStyle === "bedrock") {
        toolDicts.push({
          toolSpec: {
            name: tool.name,
          },
        });
      }
    }
    let toolsToBind: BindToolsInput[] = toolDicts;
    if (this.toolStyle === "google") {
      toolsToBind = [{ functionDeclarations: toolDicts }];
    }
    return this.withConfig({
      tools: [...toolsToBind, ...serverTools],
    } as BaseChatModelCallOptions);
  }

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(_: unknown): Runnable<any> {
    if (!this.structuredResponse) {
      throw new Error("No structured response provided");
    }
    // Create a runnable that returns the proper structured format
    return RunnableLambda.from(async (messages: BaseMessage[]) => {
      if (this.sleep) {
        await new Promise((resolve) => setTimeout(resolve, this.sleep));
      }

      // Store the messages that were sent to generate structured output
      this.structuredOutputMessages.push([...messages]);

      // Return in the format expected: { raw: BaseMessage, parsed: RunOutput }
      return this.structuredResponse as RunOutput;
    });
  }
}

export class MemorySaverAssertImmutable extends MemorySaver {
  storageForCopies: Record<string, Record<string, Uint8Array>> = {};

  constructor() {
    super();
    this.storageForCopies = {};
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;
    this.storageForCopies[thread_id] ??= {};

    // assert checkpoint hasn't been modified since last written
    const saved = await this.get(config);
    if (saved) {
      const savedId = saved.id;
      if (this.storageForCopies[thread_id][savedId]) {
        const [, serializedSaved] = await this.serde.dumpsTyped(saved);
        const serializedCopy = this.storageForCopies[thread_id][savedId];

        // Compare Uint8Array contents by converting to string
        const savedStr = new TextDecoder().decode(serializedSaved);
        const copyStr = new TextDecoder().decode(serializedCopy);
        if (savedStr !== copyStr) {
          throw new Error(
            `Checkpoint [${savedId}] has been modified since last written`
          );
        }
      }
    }
    const [, serializedCheckpoint] = await this.serde.dumpsTyped(checkpoint);
    // save a copy of the checkpoint
    this.storageForCopies[thread_id][checkpoint.id] = serializedCheckpoint;

    return super.put(config, checkpoint, metadata);
  }
}

interface ToolCall {
  name: string;
  args: Record<string, any>;
  id: string;
  type?: "tool_call";
}

interface FakeToolCallingModelFields {
  toolCalls?: ToolCall[][];
  toolStyle?: "openai" | "anthropic";
  index?: number;
  structuredResponse?: any;
}

// Helper function to create checkpointer
export function createCheckpointer(): BaseCheckpointSaver {
  return new MemorySaver();
}

/**
 * Fake chat model for testing tool calling functionality
 */
export class FakeToolCallingModel extends BaseChatModel {
  toolCalls: ToolCall[][];

  toolStyle: "openai" | "anthropic";

  // Use a shared reference object so the index persists across bindTools calls
  private indexRef: { current: number };

  structuredResponse?: any;

  private tools: StructuredTool[] = [];

  constructor({
    toolCalls = [],
    toolStyle = "openai",
    index = 0,
    structuredResponse,
    indexRef,
    ...rest
  }: FakeToolCallingModelFields & { indexRef?: { current: number } } = {}) {
    super(rest);
    this.toolCalls = toolCalls;
    this.toolStyle = toolStyle;
    // Share the same index reference across instances
    this.indexRef = indexRef ?? { current: index };
    this.structuredResponse = structuredResponse;
  }

  // Getter/setter for backwards compatibility
  get index(): number {
    return this.indexRef.current;
  }

  set index(value: number) {
    this.indexRef.current = value;
  }

  _llmType(): string {
    return "fake-tool-calling";
  }

  _combineLLMOutput() {
    return [];
  }

  bindTools(
    tools: StructuredTool[]
  ):
    | FakeToolCallingModel
    | RunnableBinding<
        any,
        any,
        any & { tool_choice?: ToolChoice | undefined }
      > {
    const newInstance = new FakeToolCallingModel({
      toolCalls: this.toolCalls,
      toolStyle: this.toolStyle,
      structuredResponse: this.structuredResponse,
      // Pass the same indexRef so all instances share the same index state
      indexRef: this.indexRef,
    });
    newInstance.tools = [...this.tools, ...tools];
    return newInstance;
  }

  withStructuredOutput(_schema: any) {
    return new RunnableLambda({
      func: async () => {
        return this.structuredResponse;
      },
    });
  }

  async _generate(
    messages: BaseMessage[],
    _options?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const lastMessage = messages[messages.length - 1];
    let content = lastMessage.content as string;

    // Handle prompt concatenation
    if (messages.length > 1) {
      const parts = messages.map((m) => m.content).filter(Boolean);
      content = parts
        .map((part) => {
          if (typeof part === "string") {
            return part;
          } else if (typeof part === "object" && "text" in part) {
            return part.text;
          } else if (Array.isArray(part)) {
            return part
              .map((p) => {
                if (typeof p === "string") {
                  return p;
                } else if (typeof p === "object" && "text" in p) {
                  return p.text;
                }
                return "";
              })
              .join("-");
          } else {
            return JSON.stringify(part);
          }
        })
        .join("-");
    }

    // Reset index at the start of a new conversation (only human message)
    // This allows the model to be reused across multiple agent.invoke() calls
    const isStartOfConversation =
      messages.length === 1 ||
      (messages.length === 2 && messages.every(HumanMessage.isInstance));
    if (isStartOfConversation && this.index !== 0) {
      this.index = 0;
    }

    const currentToolCalls = this.toolCalls[this.index] || [];
    const messageId = this.index.toString();

    // Move to next set of tool calls for subsequent invocations
    this.index = (this.index + 1) % Math.max(1, this.toolCalls.length);

    const message = new AIMessage({
      content,
      id: messageId,
      tool_calls:
        currentToolCalls.length > 0
          ? currentToolCalls.map((tc) => ({
              ...tc,
              type: "tool_call" as const,
            }))
          : undefined,
    });

    return {
      generations: [
        {
          text: content,
          message,
        },
      ],
      llmOutput: {},
    };
  }
}

export class SearchAPI extends StructuredTool {
  name = "search_api";

  description = "A simple API that returns the input string.";

  schema = z.object({
    query: z.string().describe("The query to search for."),
  });

  async _call(input: z.infer<typeof this.schema>) {
    if (input?.query === "error") {
      throw new Error("Error");
    }
    return `result for ${input?.query}`;
  }
}
