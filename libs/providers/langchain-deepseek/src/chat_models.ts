import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { ModelProfile } from "@langchain/core/language_models/profile";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { InteropZodType } from "@langchain/core/utils/types";
import {
  ChatOpenAICallOptions,
  ChatOpenAICompletions,
  ChatOpenAIFields,
  OpenAIClient,
} from "@langchain/openai";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import PROFILES from "./profiles.js";

export interface ChatDeepSeekCallOptions extends ChatOpenAICallOptions {
  headers?: Record<string, string>;
}

export interface ChatDeepSeekInput extends ChatOpenAIFields {
  /**
   * The Deepseek API key to use for requests.
   * @default process.env.DEEPSEEK_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   */
  model?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   * Alias for `stopSequences`
   */
  stop?: Array<string>;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   */
  stopSequences?: Array<string>;
  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;
  /**
   * The temperature to use for sampling.
   */
  temperature?: number;
  /**
   * The maximum number of tokens that the model can process in a single response.
   * This limits ensures computational efficiency and resource management.
   */
  maxTokens?: number;
}

/**
 * Deepseek chat model integration.
 *
 * The Deepseek API is compatible to the OpenAI API with some limitations.
 *
 * Setup:
 * Install `@langchain/deepseek` and set an environment variable named `DEEPSEEK_API_KEY`.
 *
 * ```bash
 * npm install @langchain/deepseek
 * export DEEPSEEK_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_deepseek.ChatDeepSeek.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/_langchain_deepseek.ChatDeepSeekCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.withConfig`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.withConfig`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.withConfig({
 *   stop: ["\n"],
 *   tools: [...],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     tool_choice: "auto",
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatDeepSeek } from '@langchain/deepseek';
 *
 * const llm = new ChatDeepSeek({
 *   model: "deepseek-reasoner",
 *   temperature: 0,
 *   // other params...
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const input = `Translate "I love programming" into French.`;
 *
 * // Models also accept a list of chat messages or a formatted prompt
 * const result = await llm.invoke(input);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "content": "The French translation of \"I love programming\" is \"J'aime programmer\". In this sentence, \"J'aime\" is the first person singular conjugation of the French verb \"aimer\" which means \"to love\", and \"programmer\" is the French infinitive for \"to program\". I hope this helps! Let me know if you have any other questions.",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "tokenUsage": {
 *       "completionTokens": 82,
 *       "promptTokens": 20,
 *       "totalTokens": 102
 *     },
 *     "finish_reason": "stop"
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": []
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(input)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "The",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " French",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " translation",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " of",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " \"",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "I",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " love",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * ...
 * AIMessageChunk {
 *   "content": ".",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": "stop"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Aggregate Streamed Chunks</strong></summary>
 *
 * ```typescript
 * import { AIMessageChunk } from '@langchain/core/messages';
 * import { concat } from '@langchain/core/utils/stream';
 *
 * const stream = await llm.stream(input);
 * let full: AIMessageChunk | undefined;
 * for await (const chunk of stream) {
 *   full = !full ? chunk : concat(full, chunk);
 * }
 * console.log(full);
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": "The French translation of \"I love programming\" is \"J'aime programmer\". In this sentence, \"J'aime\" is the first person singular conjugation of the French verb \"aimer\" which means \"to love\", and \"programmer\" is the French infinitive for \"to program\". I hope this helps! Let me know if you have any other questions.",
 *   "additional_kwargs": {
 *     "reasoning_content": "...",
 *   },
 *   "response_metadata": {
 *     "finishReason": "stop"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const llmForToolCalling = new ChatDeepSeek({
 *   model: "deepseek-chat",
 *   temperature: 0,
 *   // other params...
 * });
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llmForToolCalling.bindTools([GetWeather, GetPopulation]);
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call',
 *     id: 'call_cd34'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'call_68rf'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call',
 *     id: 'call_f81z'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'call_8byt'
 *   }
 * ]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llmForToolCalling.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the wild?",
 *   punchline: 'Because there are too many cheetahs.'
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatDeepSeek extends ChatOpenAICompletions<ChatDeepSeekCallOptions> {
  static lc_name() {
    return "ChatDeepSeek";
  }

  _llmType() {
    return "deepseek";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "DEEPSEEK_API_KEY",
    };
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "chat_models", "deepseek"];

  constructor(fields?: Partial<ChatDeepSeekInput>) {
    const apiKey = fields?.apiKey || getEnvironmentVariable("DEEPSEEK_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Deepseek API key not found. Please set the DEEPSEEK_API_KEY environment variable or pass the key into "apiKey" field.`
      );
    }

    super({
      ...fields,
      apiKey,
      configuration: {
        baseURL: "https://api.deepseek.com",
        ...fields?.configuration,
      },
    });
  }

  protected override _convertCompletionsDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.ChatCompletionChunk,
    defaultRole?:
      | "function"
      | "user"
      | "system"
      | "developer"
      | "assistant"
      | "tool"
  ) {
    const messageChunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole
    );
    messageChunk.additional_kwargs.reasoning_content = delta.reasoning_content;
    // Override model_provider for DeepSeek-specific block translation
    messageChunk.response_metadata = {
      ...messageChunk.response_metadata,
      model_provider: "deepseek",
    };
    return messageChunk;
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = super._streamResponseChunks(messages, options, runManager);

    // State for parsing <think> tags
    let tokensBuffer = "";
    let isThinking = false;

    for await (const chunk of stream) {
      // If the model already provided reasoning_content natively, just yield it
      if (chunk.message.additional_kwargs.reasoning_content) {
        yield chunk;
        continue;
      }

      const text = chunk.text;
      if (!text) {
        yield chunk;
        continue;
      }

      // Append text to buffer to handle split tags
      tokensBuffer += text;

      // Check for <think> start tag
      if (!isThinking && tokensBuffer.includes("<think>")) {
        isThinking = true;
        const thinkIndex = tokensBuffer.indexOf("<think>");
        const beforeThink = tokensBuffer.substring(0, thinkIndex);
        const afterThink = tokensBuffer.substring(
          thinkIndex + "<think>".length
        );

        // We consumed up to <think>, so buffer becomes what's after
        tokensBuffer = afterThink || ""; // might be empty or part of thought

        if (beforeThink) {
          // Send the content before the tag
          const newChunk = new ChatGenerationChunk({
            message: new AIMessageChunk({
              content: beforeThink,
              additional_kwargs: chunk.message.additional_kwargs,
              response_metadata: chunk.message.response_metadata,
              tool_calls: chunk.message.tool_calls,
              tool_call_chunks: chunk.message.tool_call_chunks,
              id: chunk.message.id,
            }),
            text: beforeThink,
            generationInfo: chunk.generationInfo,
          });
          yield newChunk;
        }
      }

      // Check for </think> end tag
      if (isThinking && tokensBuffer.includes("</think>")) {
        isThinking = false;
        const thinkEndIndex = tokensBuffer.indexOf("</think>");
        const thoughtContent = tokensBuffer.substring(0, thinkEndIndex);
        const afterThink = tokensBuffer.substring(
          thinkEndIndex + "</think>".length
        );

        // Yield the reasoning content
        const reasoningChunk = new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: {
              ...chunk.message.additional_kwargs,
              reasoning_content: thoughtContent,
            },
            response_metadata: chunk.message.response_metadata,
            tool_calls: chunk.message.tool_calls,
            tool_call_chunks: chunk.message.tool_call_chunks,
            id: chunk.message.id,
          }),
          text: "",
          generationInfo: chunk.generationInfo,
        });
        yield reasoningChunk;

        // Reset buffer to what's after </think>
        tokensBuffer = afterThink || "";

        // Yield the rest as normal content if any
        if (tokensBuffer) {
          const contentChunk = new ChatGenerationChunk({
            message: new AIMessageChunk({
              content: tokensBuffer,
              additional_kwargs: chunk.message.additional_kwargs,
              response_metadata: chunk.message.response_metadata,
              tool_calls: chunk.message.tool_calls,
              tool_call_chunks: chunk.message.tool_call_chunks,
              id: chunk.message.id,
            }),
            text: tokensBuffer,
            generationInfo: chunk.generationInfo,
          });
          yield contentChunk;
          tokensBuffer = ""; // consumed
        }
      } else if (isThinking) {
        // We are inside thinking block.
        // Check partial </think> match
        const possibleEndTag = "</think>";
        let splitIndex = -1;

        // Check if buffer ends with a prefix of </think> - Greedy check (longest first)
        for (let i = possibleEndTag.length - 1; i >= 1; i--) {
          if (tokensBuffer.endsWith(possibleEndTag.substring(0, i))) {
            splitIndex = tokensBuffer.length - i;
            break;
          }
        }

        if (splitIndex !== -1) {
          const safeToYield = tokensBuffer.substring(0, splitIndex);
          if (safeToYield) {
            const reasoningChunk = new ChatGenerationChunk({
              message: new AIMessageChunk({
                content: "",
                additional_kwargs: {
                  ...chunk.message.additional_kwargs,
                  reasoning_content: safeToYield,
                },
                response_metadata: chunk.message.response_metadata,
                tool_calls: chunk.message.tool_calls,
                tool_call_chunks: chunk.message.tool_call_chunks,
                id: chunk.message.id,
              }),
              text: "",
              generationInfo: chunk.generationInfo,
            });
            yield reasoningChunk;
          }
          tokensBuffer = tokensBuffer.substring(splitIndex); // keep partial tag
        } else {
          // content is safe to yield as reasoning
          if (tokensBuffer) {
            const reasoningChunk = new ChatGenerationChunk({
              message: new AIMessageChunk({
                content: "",
                additional_kwargs: {
                  ...chunk.message.additional_kwargs,
                  reasoning_content: tokensBuffer,
                },
                response_metadata: chunk.message.response_metadata,
                tool_calls: chunk.message.tool_calls,
                tool_call_chunks: chunk.message.tool_call_chunks,
                id: chunk.message.id,
              }),
              text: "",
              generationInfo: chunk.generationInfo,
            });
            yield reasoningChunk;
            tokensBuffer = "";
          }
        }
      } else {
        // NOT thinking.
        // Check partial start tag "<think>" - Greedy check (longest first)
        const possibleStartTag = "<think>";
        let splitIndex = -1;
        for (let i = possibleStartTag.length - 1; i >= 1; i--) {
          if (tokensBuffer.endsWith(possibleStartTag.substring(0, i))) {
            splitIndex = tokensBuffer.length - i;
            break;
          }
        }

        if (splitIndex !== -1) {
          // Yield safe content
          const safeToYield = tokensBuffer.substring(0, splitIndex);
          if (safeToYield) {
            const contentChunk = new ChatGenerationChunk({
              message: new AIMessageChunk({
                content: safeToYield,
                additional_kwargs: chunk.message.additional_kwargs,
                response_metadata: chunk.message.response_metadata,
                tool_calls: chunk.message.tool_calls,
                tool_call_chunks: chunk.message.tool_call_chunks,
                id: chunk.message.id,
              }),
              text: safeToYield,
              generationInfo: chunk.generationInfo,
            });
            yield contentChunk;
          }
          tokensBuffer = tokensBuffer.substring(splitIndex); // keep partial tag
        } else {
          // Yield all
          if (tokensBuffer) {
            const contentChunk = new ChatGenerationChunk({
              message: new AIMessageChunk({
                content: tokensBuffer,
                additional_kwargs: chunk.message.additional_kwargs,
                response_metadata: chunk.message.response_metadata,
                tool_calls: chunk.message.tool_calls,
                tool_call_chunks: chunk.message.tool_call_chunks,
                id: chunk.message.id,
              }),
              text: tokensBuffer,
              generationInfo: chunk.generationInfo,
            });
            yield contentChunk;
            tokensBuffer = "";
          }
        }
      }
    }

    // Flush remaining buffer at end of stream
    if (tokensBuffer) {
      // If we were thinking, it's unclosed thought.
      if (isThinking) {
        const reasoningChunk = new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: { reasoning_content: tokensBuffer },
          }),
          text: "",
        });
        yield reasoningChunk;
      } else {
        const contentChunk = new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: tokensBuffer,
          }),
          text: tokensBuffer,
        });
        yield contentChunk;
      }
    }
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.ChatCompletionMessage,
    rawResponse: OpenAIClient.ChatCompletion
  ) {
    const langChainMessage = super._convertCompletionsMessageToBaseMessage(
      message,
      rawResponse
    );
    langChainMessage.additional_kwargs.reasoning_content =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (message as any).reasoning_content;
    // Override model_provider for DeepSeek-specific block translation
    langChainMessage.response_metadata = {
      ...langChainMessage.response_metadata,
      model_provider: "deepseek",
    };
    return langChainMessage;
  }

  /**
   * Return profiling information for the model.
   *
   * Provides information about the model's capabilities and constraints,
   * including token limits, multimodal support, and advanced features like
   * tool calling and structured output.
   *
   * @returns {ModelProfile} An object describing the model's capabilities and constraints
   *
   * @example
   * ```typescript
   * const model = new ChatDeepSeek({ model: "deepseek-chat" });
   * const profile = model.profile;
   * console.log(profile.maxInputTokens); // 128000
   * console.log(profile.imageInputs); // false
   * ```
   */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    const ensuredConfig = { ...config };
    // Deepseek does not support json schema yet
    if (ensuredConfig?.method === undefined) {
      ensuredConfig.method = "functionCalling";
    }
    return super.withStructuredOutput<RunOutput>(outputSchema, ensuredConfig);
  }
}
