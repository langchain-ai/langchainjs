import { CallbackManager, Callbacks } from "@langchain/core/callbacks/manager";
import { BaseLLM, LLM } from "@langchain/core/language_models/llms";
import {
  type BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
} from "@langchain/core/language_models/base";
import { BaseMessage, MessageContent } from "@langchain/core/messages";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { AbstractGoogleLLMConnection } from "./connection.js";
import {
  GoogleAIBaseLLMInput,
  GoogleAIModelParams,
  GoogleAISafetySetting,
  GooglePlatformType,
  GeminiContent,
  GoogleAIResponseMimeType,
} from "./types.js";
import {
  copyAIModelParams,
  copyAndValidateModelParamsInto,
} from "./utils/common.js";
import { DefaultGeminiSafetyHandler } from "./utils/gemini.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";
import { ensureParams } from "./utils/failed_handler.js";
import { ChatGoogleBase } from "./chat_models.js";
import type { GoogleBaseLLMInput, GoogleAISafetyHandler } from "./types.js";

export { GoogleBaseLLMInput };

class GoogleLLMConnection<AuthOptions> extends AbstractGoogleLLMConnection<
  MessageContent,
  AuthOptions
> {
  async formatContents(
    input: MessageContent,
    _parameters: GoogleAIModelParams
  ): Promise<GeminiContent[]> {
    const parts = await this.api.messageContentToParts!(input);
    const contents: GeminiContent[] = [
      {
        role: "user", // Required by Vertex AI
        parts,
      },
    ];
    return contents;
  }
}

type ProxyChatInput<AuthOptions> = GoogleAIBaseLLMInput<AuthOptions> & {
  connection: GoogleLLMConnection<AuthOptions>;
};

class ProxyChatGoogle<AuthOptions> extends ChatGoogleBase<AuthOptions> {
  constructor(fields: ProxyChatInput<AuthOptions>) {
    super(fields);
  }

  buildAbstractedClient(
    fields: ProxyChatInput<AuthOptions>
  ): GoogleAbstractedClient {
    return fields.connection.client;
  }
}

/**
 * Integration with an LLM.
 */
export abstract class GoogleBaseLLM<AuthOptions>
  extends LLM<BaseLanguageModelCallOptions>
  implements GoogleBaseLLMInput<AuthOptions>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleLLM";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      authOptions: "GOOGLE_AUTH_OPTIONS",
    };
  }

  originalFields?: GoogleBaseLLMInput<AuthOptions>;

  lc_serializable = true;

  modelName = "gemini-pro";

  model = "gemini-pro";

  temperature = 0.7;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  stopSequences: string[] = [];

  safetySettings: GoogleAISafetySetting[] = [];

  safetyHandler: GoogleAISafetyHandler;

  responseMimeType: GoogleAIResponseMimeType = "text/plain";

  protected connection: GoogleLLMConnection<AuthOptions>;

  protected streamedConnection: GoogleLLMConnection<AuthOptions>;

  constructor(fields?: GoogleBaseLLMInput<AuthOptions>) {
    super(ensureParams(fields));
    this.originalFields = fields;

    copyAndValidateModelParamsInto(fields, this);
    this.safetyHandler =
      fields?.safetyHandler ?? new DefaultGeminiSafetyHandler();

    const client = this.buildClient(fields);
    this.buildConnection(fields ?? {}, client);
  }

  abstract buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<AuthOptions>
  ): GoogleAbstractedClient;

  buildApiKeyClient(apiKey: string): GoogleAbstractedClient {
    return new ApiKeyGoogleAuth(apiKey);
  }

  buildApiKey(fields?: GoogleAIBaseLLMInput<AuthOptions>): string | undefined {
    return fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
  }

  buildClient(
    fields?: GoogleAIBaseLLMInput<AuthOptions>
  ): GoogleAbstractedClient {
    const apiKey = this.buildApiKey(fields);
    if (apiKey) {
      return this.buildApiKeyClient(apiKey);
    } else {
      return this.buildAbstractedClient(fields);
    }
  }

  buildConnection(
    fields: GoogleBaseLLMInput<AuthOptions>,
    client: GoogleAbstractedClient
  ) {
    this.connection = new GoogleLLMConnection(
      { ...fields, ...this },
      this.caller,
      client,
      false
    );

    this.streamedConnection = new GoogleLLMConnection(
      { ...fields, ...this },
      this.caller,
      client,
      true
    );
  }

  get platform(): GooglePlatformType {
    return this.connection.platform;
  }

  // Replace
  _llmType() {
    return "googlellm";
  }

  formatPrompt(prompt: string): MessageContent {
    return prompt;
  }

  /**
   * For some given input string and options, return a string output.
   *
   * Despite the fact that `invoke` is overridden below, we still need this
   * in order to handle public APi calls to `generate()`.
   */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const parameters = copyAIModelParams(this, options);
    const result = await this.connection.request(prompt, parameters, options);
    const ret = this.connection.api.responseToString(result);
    return ret;
  }

  // Normally, you should not override this method and instead should override
  // _streamResponseChunks. We are doing so here to allow for multimodal inputs into
  // the LLM.
  async *_streamIterator(
    input: BaseLanguageModelInput,
    options?: BaseLanguageModelCallOptions
  ): AsyncGenerator<string> {
    // TODO: Refactor callback setup and teardown code into core
    const prompt = BaseLLM._convertInputToPromptValue(input);
    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptions(options);
    const callbackManager_ = await CallbackManager.configure(
      runnableConfig.callbacks,
      this.callbacks,
      runnableConfig.tags,
      this.tags,
      runnableConfig.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const extra = {
      options: callOptions,
      invocation_params: this?.invocationParams(callOptions),
      batch_size: 1,
    };
    const runManagers = await callbackManager_?.handleLLMStart(
      this.toJSON(),
      [prompt.toString()],
      undefined,
      undefined,
      extra,
      undefined,
      undefined,
      runnableConfig.runName
    );
    let generation = new GenerationChunk({
      text: "",
    });
    const proxyChat = this.createProxyChat();
    try {
      for await (const chunk of proxyChat._streamIterator(input, options)) {
        const stringValue = this.connection.api.chunkToString(chunk);
        const generationChunk = new GenerationChunk({
          text: stringValue,
        });
        generation = generation.concat(generationChunk);
        yield stringValue;
      }
    } catch (err) {
      await Promise.all(
        (runManagers ?? []).map((runManager) => runManager?.handleLLMError(err))
      );
      throw err;
    }
    await Promise.all(
      (runManagers ?? []).map((runManager) =>
        runManager?.handleLLMEnd({
          generations: [[generation]],
        })
      )
    );
  }

  async predictMessages(
    messages: BaseMessage[],
    options?: string[] | BaseLanguageModelCallOptions,
    _callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const { content } = messages[0];
    const result = await this.connection.request(
      content,
      {},
      options as BaseLanguageModelCallOptions
    );
    const ret = this.connection.api.responseToBaseMessage(result);
    return ret;
  }

  /**
   * Internal implementation detail to allow Google LLMs to support
   * multimodal input by delegating to the chat model implementation.
   *
   * TODO: Replace with something less hacky.
   */
  protected createProxyChat(): ChatGoogleBase<AuthOptions> {
    return new ProxyChatGoogle<AuthOptions>({
      ...this.originalFields,
      connection: this.connection,
    });
  }

  // TODO: Remove the need to override this - we are doing it to
  // allow the LLM to handle multimodal types of input.
  async invoke(
    input: BaseLanguageModelInput,
    options?: BaseLanguageModelCallOptions
  ): Promise<string> {
    const stream = await this._streamIterator(input, options);
    let generatedOutput = "";
    for await (const chunk of stream) {
      generatedOutput += chunk;
    }
    return generatedOutput;
  }
}
