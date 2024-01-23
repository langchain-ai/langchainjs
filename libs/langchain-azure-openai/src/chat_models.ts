import {
  type OpenAIClientOptions as AzureOpenAIClientOptions,
  OpenAIClient as AzureOpenAIClient,
  AzureKeyCredential,
  FunctionDefinition,
  FunctionCallPreset,
  FunctionName,
  AzureExtensionsOptions,
  ChatChoice,
  ChatRequestMessage
} from "@azure/openai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { KeyCredential, TokenCredential, isTokenCredential } from "@azure/core-auth";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { AzureOpenAIInput, OpenAIChatCallOptions, OpenAIChatInput } from "./types.js";

export { type AzureOpenAIInput, type OpenAIChatInput };

export class AzureOpenAIChat
  extends LLM<OpenAIChatCallOptions>
  implements OpenAIChatInput, AzureOpenAIInput
{
  static lc_name() {
    return "AzureOpenAIChat";
  }

  get callKeys() {
    return [...super.callKeys, "options", "promptIndex"];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
      azureOpenAIEndpoint: "AZURE_OPENAI_API_ENDPOINT",
      azureOpenAIApiDeploymentName: "AZURE_OPENAI_API_DEPLOYMENT_NAME",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
      azureOpenAIApiKey: "azure_openai_api_key",
      azureOpenAIEndpoint: "azure_openai_api_endpoint",
      azureOpenAIApiDeploymentName: "azure_openai_api_deployment_name",
    };
  }

  _llmType() {
    return "openai";
  }

  temperature = 1;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  logitBias?: Record<string, number>;

  maxTokens?: number;

  modelName = "gpt-3.5-turbo";

  prefixMessages?: ChatRequestMessage[];

  modelKwargs?: OpenAIChatInput["modelKwargs"];

  timeout?: number;

  stop?: string[];

  user?: string;

  streaming = false;
  

  functions?: FunctionDefinition[];

  functionCall?: FunctionCallPreset | FunctionName;

  azureExtensionOptions?: AzureExtensionsOptions;

  azureOpenAIEndpoint?: string;

  azureOpenAIApiKey?: string;

  azureOpenAIApiCompletionsDeploymentName?: string;

  private client: AzureOpenAIClient;

  constructor(
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: AzureOpenAIClientOptions;
      }
  ) {
    super(fields ?? {});

    this.azureOpenAIEndpoint =
      fields?.azureOpenAIEndpoint ??
      getEnvironmentVariable("AZURE_OPENAI_API_ENDPOINT");

    this.azureOpenAIApiCompletionsDeploymentName =
      fields?.azureOpenAIApiDeploymentName ??
      getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME");

    this.azureOpenAIApiKey =
      fields?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");

    if (!this.azureOpenAIApiKey) {
      throw new Error("Azure OpenAI API key not found");
    }

    if (!this.azureOpenAIEndpoint) {
      throw new Error("Azure OpenAI Endpoint not found");
    }

    if (!this.azureOpenAIApiCompletionsDeploymentName) {
      throw new Error("Azure OpenAI Completion Deployment name not found");
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.timeout = fields?.timeout;

    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.n = fields?.n ?? this.n;
    this.logitBias = fields?.logitBias;
    this.maxTokens = fields?.maxTokens;
    this.stop = fields?.stop;
    this.user = fields?.user;
    this.functions = fields?.functions;
    this.functionCall = fields?.functionCall;
    this.azureExtensionOptions = fields?.azureExtensionOptions;

    this.streaming = fields?.streaming ?? false;

    if (this.n > 1) {
      throw new Error(
        "Cannot use n > 1 in OpenAIChat LLM. Use ChatOpenAI Chat Model instead."
      );
    }

    if (this.azureOpenAIApiKey) {
      if (!this.azureOpenAIApiCompletionsDeploymentName) {
        throw new Error("Azure OpenAI API deployment name not found");
      }
      this.azureOpenAIApiKey = this.azureOpenAIApiKey ?? "";
    }

    const azureCredential = fields?.credentials ?? new AzureKeyCredential(
      this.azureOpenAIApiKey
    );

    if (isTokenCredential(azureCredential)) {
      this.client = new AzureOpenAIClient(
        this.azureOpenAIEndpoint ?? "",
        azureCredential as TokenCredential
      );
    } else {
      this.client = new AzureOpenAIClient(
        this.azureOpenAIEndpoint ?? "",
        azureCredential as KeyCredential
      );
    }
  }

  /**
   * Formats the messages for the OpenAI API.
   * @param prompt The prompt to be formatted.
   * @returns Array of formatted messages.
   */
  private formatMessages(
    prompt: string
  ): ChatRequestMessage[] {
    const message: ChatRequestMessage = {
      role: "user",
      content: prompt,
    };
    return this.prefixMessages ? [...this.prefixMessages, message] : [message];
  }

  async *_streamResponseChunks(
    content: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    if (!this.azureOpenAIApiCompletionsDeploymentName) {
      throw new Error("Azure OpenAI Completion Deployment name not found");
    }

    const stream = await this.client.streamChatCompletions(
      this.azureOpenAIApiCompletionsDeploymentName,
      this.formatMessages(content),
      {
        functions: this.functions,
        functionCall: this.functionCall,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        topP: this.topP,
        logitBias: this.logitBias,
        user: this.user,
        n: this.n,
        stop: this.stop,
        presencePenalty: this.presencePenalty,
        frequencyPenalty: this.frequencyPenalty,
        azureExtensionOptions: this.azureExtensionOptions,
        requestOptions: {
          timeout: options?.timeout,
        },
        abortSignal: options?.signal ?? undefined,
      }
    );

    for await (const data of stream) {
      const choice: ChatChoice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const { delta } = choice;
      const generationChunk = new GenerationChunk({
        text: delta?.content ?? "",
      });
      yield generationChunk;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices
      );
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  /** @ignore */
  async _call(
    content: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (!this.azureOpenAIApiCompletionsDeploymentName) {
      throw new Error("Azure OpenAI Completion Deployment name not found");
    }

    if (!this.streaming) {
      const data = await this.client.getChatCompletions(
        this.azureOpenAIApiCompletionsDeploymentName,
        [
          {
            content,
            role: "user",
          },
        ],
        {
          functions: this.functions,
          functionCall: this.functionCall,
          maxTokens: this.maxTokens,
          temperature: this.temperature,
          topP: this.topP,
          logitBias: this.logitBias,
          user: this.user,
          n: this.n,
          stop: this.stop,
          presencePenalty: this.presencePenalty,
          frequencyPenalty: this.frequencyPenalty,
          azureExtensionOptions: this.azureExtensionOptions,
          requestOptions: {
            timeout: options?.timeout,
          },
          abortSignal: options?.signal ?? undefined,
        }
      );

      data.choices.map((choice) => {
        const newTokenIndices = {
          prompt: options.promptIndex ?? 0,
          completion: choice.index ?? 0,
        };
        void runManager?.handleLLMNewToken(
          choice.delta?.content ?? "",
          newTokenIndices
        );
        return choice;
      });

      return data.choices[0].message?.content ?? "";
    } else {
      const streams = await this.client.streamChatCompletions(
        this.azureOpenAIApiCompletionsDeploymentName,
        this.formatMessages(content),
        {
          functions: this.functions,
          functionCall: this.functionCall,
          maxTokens: this.maxTokens,
          temperature: this.temperature,
          topP: this.topP,
          logitBias: this.logitBias,
          user: this.user,
          n: this.n,
          stop: this.stop,
          presencePenalty: this.presencePenalty,
          frequencyPenalty: this.frequencyPenalty,
          azureExtensionOptions: this.azureExtensionOptions,
          requestOptions: {
            timeout: options?.timeout,
          },
          abortSignal: options?.signal ?? undefined,
        }
      );
      let result: string | null | undefined = null;
      for await (const stream of streams) {
        for (const choice of stream.choices) {
          const delta = choice.delta?.content;
          if (result == null) {
            result = delta;
          } else {
            result = result.concat(delta ?? "");
          }
          const newTokenIndices = {
            prompt: options.promptIndex ?? 0,
            completion: choice.index ?? 0,
          };
          void runManager?.handleLLMNewToken(
            choice.delta?.content ?? "",
            newTokenIndices
          );
        }
      }
      return result ?? "";
    }
  }
}
