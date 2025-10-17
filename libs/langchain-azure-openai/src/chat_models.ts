import {
  type OpenAIClientOptions as AzureOpenAIClientOptions,
  OpenAIClient as AzureOpenAIClient,
  AzureExtensionsOptions,
  ChatRequestMessage,
  ChatResponseMessage,
  AzureKeyCredential,
  ChatCompletions,
  EventStream,
  ChatCompletionsToolDefinition,
  ChatCompletionsNamedToolSelection,
  ChatCompletionsResponseFormat,
  OpenAIKeyCredential,
} from "@azure/openai";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  BaseFunctionCallOptions,
  FunctionCallOption,
  FunctionDefinition,
  TokenUsage,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  ToolMessage,
  ToolMessageChunk,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  KeyCredential,
  TokenCredential,
  isTokenCredential,
} from "@azure/core-auth";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  AzureOpenAIInput,
  OpenAIChatInput,
  OpenAIChatCallOptions,
} from "./types.js";
import {
  FunctionDef,
  formatFunctionDefinitions,
} from "./utils/openai-format-fndef.js";
import { USER_AGENT_PREFIX } from "./constants.js";

function _convertDeltaToMessageChunk(
  delta: ChatResponseMessage,
  defaultRole?: string
) {
  const role = delta.role ?? defaultRole;
  const content = delta.content ?? "";
  let additional_kwargs;
  if (delta.functionCall) {
    additional_kwargs = {
      function_call: delta.functionCall,
    };
  } else if (delta.toolCalls) {
    additional_kwargs = {
      tool_calls: delta.toolCalls,
    };
  } else {
    additional_kwargs = {};
  }
  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else if (role === "system") {
    return new SystemMessageChunk({ content });
  } else if (role === "function") {
    return new FunctionMessageChunk({
      content,
      additional_kwargs,
      name: delta.role,
    });
  } else if (role === "tool") {
    return new ToolMessageChunk({
      content,
      additional_kwargs,
      tool_call_id: delta.toolCalls[0].id,
    });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

function openAIResponseToChatMessage(
  message: ChatResponseMessage
): BaseMessage {
  switch (message.role) {
    case "assistant":
      return new AIMessage(message.content || "", {
        function_call: message.functionCall,
        tool_calls: message.toolCalls,
      });
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

interface OpenAILLMOutput {
  tokenUsage: TokenUsage;
}

function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== "system" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function" &&
    message.role !== "tool"
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role;
}

export function messageToOpenAIRole(message: BaseMessage): string {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    case "tool":
      return "tool";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export interface ChatOpenAICallOptions
  extends OpenAIChatCallOptions,
    BaseFunctionCallOptions {
  tools?: ChatCompletionsToolDefinition[];
  tool_choice?: ChatCompletionsNamedToolSelection;
  response_format?: ChatCompletionsResponseFormat;
  seed?: number;
}

/** @deprecated Import from "@langchain/openai" instead. */
export class AzureChatOpenAI
  extends BaseChatModel<ChatOpenAICallOptions>
  implements OpenAIChatInput, AzureOpenAIInput
{
  static lc_name() {
    return "AzureChatOpenAI";
  }

  get callKeys() {
    return [
      ...super.callKeys,
      "options",
      "function_call",
      "functions",
      "tools",
      "tool_choice",
      "promptIndex",
      "response_format",
      "seed",
    ];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
      azureOpenAIEndpoint: "AZURE_OPENAI_API_ENDPOINT",
      azureOpenAIApiDeploymentName: "AZURE_OPENAI_API_DEPLOYMENT_NAME",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      openAIApiKey: "openai_api_key",
      azureOpenAIApiKey: "azure_openai_api_key",
      azureOpenAIEndpoint: "azure_openai_api_endpoint",
      azureOpenAIApiDeploymentName: "azure_openai_api_deployment_name",
    };
  }

  lc_serializable = true;

  azureExtensionOptions?: AzureExtensionsOptions | undefined;

  maxTokens?: number | undefined;

  temperature: number;

  topP: number;

  logitBias?: Record<string, number> | undefined;

  user?: string | undefined;

  n: number;

  presencePenalty: number;

  frequencyPenalty: number;

  stop?: string[] | undefined;

  stopSequences?: string[] | undefined;

  streaming: boolean;

  model: string;

  modelKwargs?: OpenAIChatInput["modelKwargs"];

  timeout?: number | undefined;

  azureOpenAIEndpoint?: string;

  azureOpenAIApiKey?: string;

  apiKey?: string;

  azureOpenAIApiDeploymentName?: string;

  private client: AzureOpenAIClient;

  constructor(
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> &
      BaseChatModelParams & {
        configuration?: AzureOpenAIClientOptions;
      }
  ) {
    super(fields ?? {});

    this.azureOpenAIEndpoint =
      fields?.azureOpenAIEndpoint ??
      getEnvironmentVariable("AZURE_OPENAI_API_ENDPOINT");

    this.azureOpenAIApiDeploymentName =
      (fields?.azureOpenAIEmbeddingsApiDeploymentName ||
        fields?.azureOpenAIApiDeploymentName) ??
      getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME");

    const openAiApiKey =
      fields?.apiKey ??
      fields?.openAIApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");

    this.azureOpenAIApiKey =
      fields?.apiKey ??
      fields?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY") ??
      openAiApiKey;
    this.apiKey = this.azureOpenAIApiKey;

    const azureCredential =
      fields?.credentials ??
      (this.apiKey === openAiApiKey
        ? new OpenAIKeyCredential(this.apiKey ?? "")
        : new AzureKeyCredential(this.apiKey ?? ""));

    // eslint-disable-next-line no-instanceof/no-instanceof
    const isOpenAIApiKey = azureCredential instanceof OpenAIKeyCredential;

    if (!this.apiKey && !fields?.credentials) {
      throw new Error("Azure OpenAI API key not found");
    }

    if (!this.azureOpenAIEndpoint && !isOpenAIApiKey) {
      throw new Error("Azure OpenAI Endpoint not found");
    }

    if (!this.azureOpenAIApiDeploymentName && !isOpenAIApiKey) {
      throw new Error("Azure OpenAI Deployment name not found");
    }

    this.model = fields?.model ?? this.model;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.timeout = fields?.timeout;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.maxTokens = fields?.maxTokens;
    this.n = fields?.n ?? this.n;
    this.logitBias = fields?.logitBias;
    this.stop = fields?.stopSequences ?? fields?.stop;
    this.stopSequences = this.stop;
    this.user = fields?.user;
    this.azureExtensionOptions = fields?.azureExtensionOptions;

    this.streaming = fields?.streaming ?? false;

    const options = {
      userAgentOptions: { userAgentPrefix: USER_AGENT_PREFIX },
    };

    if (isOpenAIApiKey) {
      this.client = new AzureOpenAIClient(
        azureCredential as OpenAIKeyCredential
      );
    } else if (isTokenCredential(azureCredential)) {
      this.client = new AzureOpenAIClient(
        this.azureOpenAIEndpoint ?? "",
        azureCredential as TokenCredential,
        options
      );
    } else {
      this.client = new AzureOpenAIClient(
        this.azureOpenAIEndpoint ?? "",
        azureCredential as KeyCredential,
        options
      );
    }
  }

  private formatMessages(messages: BaseMessage[]): ChatRequestMessage[] {
    return messages.map(
      (message: BaseMessage) =>
        ({
          role: messageToOpenAIRole(message),
          content: message.content,
          name: message.name,
          toolCalls: message.additional_kwargs.tool_calls,
          functionCall: message.additional_kwargs.function_call,
          toolCallId: (message as ToolMessage).tool_call_id,
        } as ChatRequestMessage)
    );
  }

  protected async _streamChatCompletionsWithRetry(
    azureOpenAIMessages: ChatRequestMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<EventStream<ChatCompletions>> {
    return this.caller.call(async () => {
      const deploymentName = this.azureOpenAIApiDeploymentName || this.model;

      const res = await this.client.streamChatCompletions(
        deploymentName,
        azureOpenAIMessages,
        {
          functions: options?.functions,
          functionCall: options?.function_call,
          maxTokens: this.maxTokens,
          temperature: this.temperature,
          topP: this.topP,
          logitBias: this.logitBias,
          user: this.user,
          n: this.n,
          stop: this.stopSequences,
          presencePenalty: this.presencePenalty,
          frequencyPenalty: this.frequencyPenalty,
          azureExtensionOptions: this.azureExtensionOptions,
          requestOptions: {
            timeout: options?.timeout ?? this.timeout,
          },
          abortSignal: options?.signal ?? undefined,
          tools: options?.tools,
          toolChoice: options?.tool_choice,
          responseFormat: options?.response_format,
          seed: options?.seed,
          ...this.modelKwargs,
        }
      );
      return res;
    });
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const azureOpenAIMessages: ChatRequestMessage[] =
      this.formatMessages(messages);
    let defaultRole: string | undefined;
    const streamIterable = await this._streamChatCompletionsWithRetry(
      azureOpenAIMessages,
      options
    );

    for await (const data of streamIterable) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }

      const { delta } = choice;
      if (!delta) {
        continue;
      }
      const chunk = _convertDeltaToMessageChunk(delta, defaultRole);
      defaultRole = delta.role ?? defaultRole;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      if (typeof chunk.content !== "string") {
        console.log(
          "[WARNING]: Received non-string content from OpenAI. This is currently not supported."
        );
        continue;
      }
      const generationChunk = new ChatGenerationChunk({
        message: chunk,
        text: chunk.content,
        generationInfo: newTokenIndices,
      });
      yield generationChunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const deploymentName = this.azureOpenAIApiDeploymentName || this.model;
    const tokenUsage: TokenUsage = {};
    const azureOpenAIMessages: ChatRequestMessage[] =
      this.formatMessages(messages);

    if (!this.streaming) {
      const data = await this.caller.call(() =>
        this.client.getChatCompletions(deploymentName, azureOpenAIMessages, {
          functions: options?.functions,
          functionCall: options?.function_call,
          maxTokens: this.maxTokens,
          temperature: this.temperature,
          topP: this.topP,
          logitBias: this.logitBias,
          user: this.user,
          n: this.n,
          stop: this.stopSequences,
          presencePenalty: this.presencePenalty,
          frequencyPenalty: this.frequencyPenalty,
          azureExtensionOptions: this.azureExtensionOptions,
          requestOptions: {
            timeout: options?.timeout ?? this.timeout,
          },
          abortSignal: options?.signal ?? undefined,
          tools: options?.tools,
          toolChoice: options?.tool_choice,
          responseFormat: options?.response_format,
          seed: options?.seed,
          ...this.modelKwargs,
        })
      );

      const { completionTokens, promptTokens, totalTokens } = data?.usage ?? {};

      if (completionTokens) {
        tokenUsage.completionTokens =
          (tokenUsage.completionTokens ?? 0) + completionTokens;
      }

      if (promptTokens) {
        tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + promptTokens;
      }

      if (totalTokens) {
        tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + totalTokens;
      }

      const generations: ChatGeneration[] = [];
      for (const part of data?.choices ?? []) {
        const text = part.message?.content ?? "";
        const generation: ChatGeneration = {
          text,
          message: openAIResponseToChatMessage(
            part.message ?? {
              role: "assistant",
              content: text,
              toolCalls: [],
            }
          ),
        };
        generation.generationInfo = {
          ...(part.finishReason ? { finish_reason: part.finishReason } : {}),
        };
        generations.push(generation);
      }
      return {
        generations,
        llmOutput: { tokenUsage },
      };
    } else {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        const index =
          (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        if (finalChunks[index] === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = finalChunks[index].concat(chunk);
        }
      }

      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([_, value]) => value);

      const promptTokenUsage = await this.getEstimatedTokenCountFromPrompt(
        messages,
        options?.functions,
        options?.function_call
      );

      const completionTokenUsage = await this.getNumTokensFromGenerations(
        generations
      );

      tokenUsage.promptTokens = promptTokenUsage;
      tokenUsage.completionTokens = completionTokenUsage;
      tokenUsage.totalTokens = promptTokenUsage + completionTokenUsage;
      return { generations, llmOutput: { estimatedTokenUsage: tokenUsage } };
    }
  }

  /**
   * Estimate the number of tokens an array of generations have used.
   */
  private async getNumTokensFromGenerations(generations: ChatGeneration[]) {
    const generationUsages = await Promise.all(
      generations.map(async (generation) => {
        if (generation.message.additional_kwargs?.function_call) {
          return (await this.getNumTokensFromMessages([generation.message]))
            .countPerMessage[0];
        } else {
          return await this.getNumTokens(generation.message.content);
        }
      })
    );

    return generationUsages.reduce((a, b) => a + b, 0);
  }

  _llmType() {
    return "azure-openai";
  }

  /**
   * Estimate the number of tokens a prompt will use.
   * Modified from: https://github.com/hmarr/openai-chat-tokens/blob/main/src/index.ts
   */
  private async getEstimatedTokenCountFromPrompt(
    messages: BaseMessage[],
    functions?: FunctionDefinition[],
    function_call?: "none" | "auto" | FunctionCallOption
  ): Promise<number> {
    // It appears that if functions are present, the first system message is padded with a trailing newline. This
    // was inferred by trying lots of combinations of messages and functions and seeing what the token counts were.

    let tokens = (await this.getNumTokensFromMessages(messages)).totalCount;

    // If there are functions, add the function definitions as they count towards token usage
    if (functions && function_call !== "auto") {
      const promptDefinitions = formatFunctionDefinitions(
        functions as unknown as FunctionDef[]
      );
      tokens += await this.getNumTokens(promptDefinitions);
      tokens += 9; // Add nine per completion
    }

    // If there's a system message _and_ functions are present, subtract four tokens. I assume this is because
    // functions typically add a system message, but reuse the first one if it's already there. This offsets
    // the extra 9 tokens added by the function definitions.
    if (functions && messages.find((m) => m._getType() === "system")) {
      tokens -= 4;
    }

    // If function_call is 'none', add one token.
    // If it's a FunctionCall object, add 4 + the number of tokens in the function name.
    // If it's undefined or 'auto', don't add anything.
    if (function_call === "none") {
      tokens += 1;
    } else if (typeof function_call === "object") {
      tokens += (await this.getNumTokens(function_call.name)) + 4;
    }

    return tokens;
  }

  async getNumTokensFromMessages(messages: BaseMessage[]) {
    let totalCount = 0;
    let tokensPerMessage = 0;
    let tokensPerName = 0;

    // From: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
    if (this.model === "gpt-3.5-turbo-0301") {
      tokensPerMessage = 4;
      tokensPerName = -1;
    } else {
      tokensPerMessage = 3;
      tokensPerName = 1;
    }

    const countPerMessage = await Promise.all(
      messages.map(async (message) => {
        const textCount = await this.getNumTokens(message.content);
        const roleCount = await this.getNumTokens(messageToOpenAIRole(message));
        const nameCount =
          message.name !== undefined
            ? tokensPerName + (await this.getNumTokens(message.name))
            : 0;
        let count = textCount + tokensPerMessage + roleCount + nameCount;

        // From: https://github.com/hmarr/openai-chat-tokens/blob/main/src/index.ts messageTokenEstimate
        const openAIMessage = message;
        if (openAIMessage._getType() === "function") {
          count -= 2;
        }
        if (openAIMessage.additional_kwargs?.function_call) {
          count += 3;
        }
        if (openAIMessage?.additional_kwargs.function_call?.name) {
          count += await this.getNumTokens(
            openAIMessage.additional_kwargs.function_call?.name
          );
        }
        if (openAIMessage.additional_kwargs.function_call?.arguments) {
          count += await this.getNumTokens(
            // Remove newlines and spaces
            JSON.stringify(
              JSON.parse(
                openAIMessage.additional_kwargs.function_call?.arguments
              )
            )
          );
        }

        totalCount += count;
        return count;
      })
    );

    totalCount += 3; // every reply is primed with <|start|>assistant<|message|>

    return { totalCount, countPerMessage };
  }

  /** @ignore */
  _combineLLMOutput(...llmOutputs: OpenAILLMOutput[]): OpenAILLMOutput {
    return llmOutputs.reduce<{
      [key in keyof OpenAILLMOutput]: Required<OpenAILLMOutput[key]>;
    }>(
      (acc, llmOutput) => {
        if (llmOutput && llmOutput.tokenUsage) {
          acc.tokenUsage.completionTokens +=
            llmOutput.tokenUsage.completionTokens ?? 0;
          acc.tokenUsage.promptTokens += llmOutput.tokenUsage.promptTokens ?? 0;
          acc.tokenUsage.totalTokens += llmOutput.tokenUsage.totalTokens ?? 0;
        }
        return acc;
      },
      {
        tokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      }
    );
  }
}
