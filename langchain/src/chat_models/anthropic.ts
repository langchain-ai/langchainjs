import {
  AI_PROMPT,
  HUMAN_PROMPT,
  Client as AnthropicApi,
  CompletionResponse,
  SamplingParameters,
} from "@anthropic-ai/sdk";
import { BaseChatModel, BaseChatModelParams } from "./base.js";
import {
  AIChatMessage,
  BaseChatMessage,
  ChatGeneration,
  ChatResult,
  MessageType,
} from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";

function getAnthropicPromptFromMessage(type: MessageType): string {
  switch (type) {
    case "ai":
      return AI_PROMPT;
    case "human":
      return HUMAN_PROMPT;
    case "system":
      return "";
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

const DEFAULT_STOP_SEQUENCES = [HUMAN_PROMPT];

/**
 * Input to AnthropicChat class.
 */
export interface AnthropicInput {
  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1. Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks.
   */
  temperature?: number;

  /** Only sample from the top K options for each subsequent
   * token. Used to remove "long tail" low probability
   * responses. Defaults to -1, which disables it.
   */
  topK?: number;

  /** Does nucleus sampling, in which we compute the
   * cumulative distribution over all the options for each
   * subsequent token in decreasing probability order and
   * cut it off once it reaches a particular probability
   * specified by top_p. Defaults to -1, which disables it.
   * Note that you should either alter temperature or top_p,
   * but not both.
   */
  topP?: number;

  /** A maximum number of tokens to generate before stopping. */
  maxTokensToSample: number;

  /** A list of strings upon which to stop generating.
   * You probably want `["\n\nHuman:"]`, as that's the cue for
   * the next turn in the dialog agent.
   */
  stopSequences?: string[];

  /** Whether to stream the results or not */
  streaming?: boolean;

  /** Anthropic API key */
  apiKey?: string;

  /** Model name to use */
  modelName: string;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://console.anthropic.com/docs/api/reference |
   * `anthropic.complete`} that are not explicitly specified on this class.
   */
  invocationKwargs?: Kwargs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

/**
 * Wrapper around Anthropic large language models.
 *
 * To use you should have the `@anthropic-ai/sdk` package installed, with the
 * `ANTHROPIC_API_KEY` environment variable set.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://console.anthropic.com/docs/api/reference |
 * `anthropic.complete`} can be passed through {@link invocationKwargs},
 * even if not explicitly available on this class.
 *
 */
export class ChatAnthropic extends BaseChatModel implements AnthropicInput {
  declare CallOptions: BaseLanguageModelCallOptions;

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  apiKey?: string;

  temperature = 1;

  topK = -1;

  topP = -1;

  maxTokensToSample = 2048;

  modelName = "claude-v1";

  invocationKwargs?: Kwargs;

  stopSequences?: string[];

  streaming = false;

  // Used for non-streaming requests
  private batchClient: AnthropicApi;

  // Used for streaming requests
  private streamingClient: AnthropicApi;

  constructor(
    fields?: Partial<AnthropicInput> &
      BaseChatModelParams & {
        anthropicApiKey?: string;
      }
  ) {
    super(fields ?? {});

    this.apiKey =
      fields?.anthropicApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.ANTHROPIC_API_KEY
        : undefined);
    if (!this.apiKey) {
      throw new Error("Anthropic API key not found");
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.invocationKwargs = fields?.invocationKwargs ?? {};

    this.temperature = fields?.temperature ?? this.temperature;
    this.topK = fields?.topK ?? this.topK;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokensToSample =
      fields?.maxTokensToSample ?? this.maxTokensToSample;
    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.streaming = fields?.streaming ?? false;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<SamplingParameters, "prompt"> & Kwargs {
    return {
      model: this.modelName,
      temperature: this.temperature,
      top_k: this.topK,
      top_p: this.topP,
      stop_sequences: this.stopSequences ?? DEFAULT_STOP_SEQUENCES,
      max_tokens_to_sample: this.maxTokensToSample,
      stream: this.streaming,
      ...this.invocationKwargs,
    };
  }

  /** @ignore */
  _identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
    };
  }

  private formatMessagesAsPrompt(messages: BaseChatMessage[]): string {
    return (
      messages
        .map((message) => {
          const messagePrompt = getAnthropicPromptFromMessage(
            message._getType()
          );
          return `${messagePrompt} ${message.text}`;
        })
        .join("") + AI_PROMPT
    );
  }

  /** @ignore */
  async _generate(
    messages: BaseChatMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.stopSequences && options.stop) {
      throw new Error(
        `"stopSequence" parameter found in input and default params`
      );
    }

    const params = this.invocationParams();
    params.stop_sequences = options.stop
      ? options.stop.concat(DEFAULT_STOP_SEQUENCES)
      : params.stop_sequences;

    const response = await this.completionWithRetry(
      {
        ...params,
        prompt: this.formatMessagesAsPrompt(messages),
      },
      { signal: options.signal },
      runManager
    );

    const generations: ChatGeneration[] = response.completion
      .split(AI_PROMPT)
      .map((message) => ({
        text: message,
        message: new AIChatMessage(message),
      }));

    return {
      generations,
    };
  }

  /** @ignore */
  private async completionWithRetry(
    request: SamplingParameters & Kwargs,
    options: { signal?: AbortSignal },
    runManager?: CallbackManagerForLLMRun
  ): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error("Missing Anthropic API key.");
    }
    let makeCompletionRequest;
    if (request.stream) {
      if (!this.streamingClient) {
        this.streamingClient = new AnthropicApi(this.apiKey);
      }
      makeCompletionRequest = async () => {
        let currentCompletion = "";
        return (
          this.streamingClient
            .completeStream(request, {
              onUpdate: (data: CompletionResponse) => {
                if (data.stop_reason) {
                  return;
                }
                const part = data.completion;
                if (part) {
                  const delta = part.slice(currentCompletion.length);
                  currentCompletion += delta ?? "";
                  // eslint-disable-next-line no-void
                  void runManager?.handleLLMNewToken(delta ?? "");
                }
              },
              signal: options.signal,
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .catch((e: any) => {
              // Anthropic doesn't actually throw JavaScript error objects at the moment.
              // We convert the error so the async caller can recognize it correctly.
              if (e?.name === "AbortError") {
                throw new Error(`${e.name}: ${e.message}`);
              }
              throw e;
            })
        );
      };
    } else {
      if (!this.batchClient) {
        this.batchClient = new AnthropicApi(this.apiKey);
      }
      makeCompletionRequest = async () =>
        this.batchClient
          .complete(request, {
            signal: options.signal,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((e: any) => {
            console.log(e);
            // Anthropic doesn't actually throw JavaScript error objects at the moment.
            // We convert the error so the async caller can recognize it correctly.
            if (e?.type === "aborted") {
              throw new Error(`${e.name}: ${e.message}`);
            }
            throw e;
          });
    }
    return this.caller.call(makeCompletionRequest);
  }

  _llmType() {
    return "anthropic";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
