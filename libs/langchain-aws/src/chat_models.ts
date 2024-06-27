import type { BaseMessage } from "@langchain/core/messages";
import { AIMessageChunk } from "@langchain/core/messages";
import type {
  ToolDefinition,
  BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
} from "@langchain/core/language_models/chat_models";
import type {
  ToolConfiguration,
  Tool as BedrockTool,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  defaultProvider,
  DefaultProviderInit,
} from "@aws-sdk/credential-provider-node";
import type { DocumentType as __DocumentType } from "@smithy/types";
import { StructuredToolInterface } from "@langchain/core/tools";
import { Runnable } from "@langchain/core/runnables";
import {
  BedrockToolChoice,
  ConverseCommandParams,
  CredentialType,
} from "./types.js";
import {
  convertToConverseTools,
  convertToBedrockToolChoice,
  convertToConverseMessages,
  convertConverseMessageToLangChainMessage,
  handleConverseStreamContentBlockDelta,
  handleConverseStreamMetadata,
  handleConverseStreamContentBlockStart,
} from "./common.js";

/**
 * Inputs for ChatBedrockConverse.
 */
export interface ChatBedrockConverseInput
  extends BaseChatModelParams,
    Partial<DefaultProviderInit> {
  /**
   * Whether or not to stream responses
   */
  streaming?: boolean;

  /**
   * Model to use.
   * For example, "anthropic.claude-3-haiku-20240307-v1:0", this is equivalent to the modelId property in the
   * list-foundation-models api.
   * See the below link for a full list of models.
   * @link https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html#model-ids-arns
   *
   * @default anthropic.claude-3-haiku-20240307-v1:0
   */
  model?: string;

  /**
   * The AWS region e.g. `us-west-2`.
   * Fallback to AWS_DEFAULT_REGION env variable or region specified in ~/.aws/config
   * in case it is not provided here.
   */
  region?: string;

  /**
   * AWS Credentials. If no credentials are provided, the default credentials from
   * `@aws-sdk/credential-provider-node` will be used.
   */
  credentials?: CredentialType;

  /**
   * Temperature.
   */
  temperature?: number;

  /**
   * Max tokens.
   */
  maxTokens?: number;

  /**
   * Override the default endpoint hostname.
   */
  endpointHost?: string;

  /**
   * The percentage of most-likely candidates that the model considers for the next token. For
   * example, if you choose a value of 0.8 for `topP`, the model selects from the top 80% of the
   * probability distribution of tokens that could be next in the sequence.
   * The default value is the default value for the model that you are using.
   * For more information, see the inference parameters for foundation models link below.
   * @link https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
   */
  topP?: number;

  /**
   * Additional inference parameters that the model supports, beyond the
   * base set of inference parameters that the Converse API supports in the `inferenceConfig`
   * field. For more information, see the model parameters link below.
   * @link https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
   */
  additionalModelRequestFields?: __DocumentType;
}

export interface ChatBedrockConverseCallOptions
  extends BaseLanguageModelCallOptions,
    Pick<ChatBedrockConverseInput, "additionalModelRequestFields"> {
  /**
   * A list of stop sequences. A stop sequence is a sequence of characters that causes
   * the model to stop generating the response.
   */
  stop?: string[];

  tools?: (StructuredToolInterface | ToolDefinition | BedrockTool)[];

  /**
   * Tool choice for the model. If passing a string, it must be "any", "auto" or the
   * name of the tool to use. Or, pass a BedrockToolChoice object.
   *
   * If "any" is passed, the model must request at least one tool.
   * If "auto" is passed, the model automatically decides if a tool should be called
   * or whether to generate text instead.
   * If a tool name is passed, it will force the model to call that specific tool.
   */
  tool_choice?: "any" | "auto" | string | BedrockToolChoice;
}

/**
 * Integration with AWS Bedrock Converse API.
 */
export class ChatBedrockConverse
  extends BaseChatModel<ChatBedrockConverseCallOptions, AIMessageChunk>
  implements ChatBedrockConverseInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatBedrockConverse";
  }

  /**
   * Replace with any secrets this class passes to `super`.
   * See {@link ../../langchain-cohere/src/chat_model.ts} for
   * an example.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  model = "anthropic.claude-3-haiku-20240307-v1:0";

  streaming = false;

  region: string;

  temperature?: number | undefined = undefined;

  maxTokens?: number | undefined = undefined;

  endpointHost?: string;

  topP?: number;

  additionalModelRequestFields?: __DocumentType;

  client: BedrockRuntimeClient;

  constructor(fields?: ChatBedrockConverseInput) {
    super(fields ?? {});
    const {
      profile,
      filepath,
      configFilepath,
      ignoreCache,
      mfaCodeProvider,
      roleAssumer,
      roleArn,
      webIdentityTokenFile,
      roleAssumerWithWebIdentity,
      ...rest
    } = fields ?? {};

    const credentials =
      rest?.credentials ??
      defaultProvider({
        profile,
        filepath,
        configFilepath,
        ignoreCache,
        mfaCodeProvider,
        roleAssumer,
        roleArn,
        webIdentityTokenFile,
        roleAssumerWithWebIdentity,
      });

    const region = rest?.region ?? getEnvironmentVariable("AWS_DEFAULT_REGION");
    if (!region) {
      throw new Error(
        "Please set the AWS_DEFAULT_REGION environment variable or pass it to the constructor as the region field."
      );
    }

    this.client = new BedrockRuntimeClient({
      region,
      credentials,
    });
    this.region = region;
    this.model = rest?.model ?? this.model;
    this.streaming = rest?.streaming ?? this.streaming;
    this.temperature = rest?.temperature;
    this.maxTokens = rest?.maxTokens;
    this.endpointHost = rest?.endpointHost;
    this.topP = rest?.topP;
    this.additionalModelRequestFields = rest?.additionalModelRequestFields;
  }

  override bindTools(
    tools: (
      | StructuredToolInterface
      | BedrockTool
      | ToolDefinition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>
    )[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    this["ParsedCallOptions"]
  > {
    return this.bind({ tools: convertToConverseTools(tools), ...kwargs });
  }

  // Replace
  _llmType() {
    return "chat_bedrock_converse";
  }

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Partial<ConverseCommandParams> {
    let toolConfig: ToolConfiguration | undefined;
    if (options?.tools && options.tools.length) {
      const tools = convertToConverseTools(options.tools);
      toolConfig = {
        tools,
        toolChoice: options.tool_choice
          ? convertToBedrockToolChoice(options.tool_choice, tools)
          : undefined,
      };
    }
    return {
      inferenceConfig: {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        topP: this.topP,
        stopSequences: options?.stop,
      },
      toolConfig,
      additionalModelRequestFields:
        this.additionalModelRequestFields ??
        options?.additionalModelRequestFields,
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      let finalResult: ChatGenerationChunk | undefined;
      for await (const chunk of stream) {
        if (finalResult === undefined) {
          finalResult = chunk;
        } else {
          finalResult = finalResult.concat(chunk);
        }
      }
      if (finalResult === undefined) {
        throw new Error(
          "Could not parse final output from Bedrock streaming call."
        );
      }
      return {
        generations: [finalResult],
        llmOutput: finalResult.generationInfo,
      };
    }
    return this._generateNonStreaming(messages, options, runManager);
  }

  async _generateNonStreaming(
    messages: BaseMessage[],
    options: Partial<this["ParsedCallOptions"]>,
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const { converseMessages, converseSystem } =
      convertToConverseMessages(messages);
    const params = this.invocationParams(options);

    const command = new ConverseCommand({
      modelId: this.model,
      messages: converseMessages,
      system: converseSystem,
      ...params,
    });
    const response = await this.client.send(command);
    const { output, ...responseMetadata } = response;
    if (!output?.message) {
      throw new Error("No message found in Bedrock response.");
    }

    const message = convertConverseMessageToLangChainMessage(
      output.message,
      responseMetadata
    );
    return {
      generations: [
        {
          text: typeof message.content === "string" ? message.content : "",
          message,
        },
      ],
    };
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const { converseMessages, converseSystem } =
      convertToConverseMessages(messages);
    const params = this.invocationParams(options);

    const command = new ConverseStreamCommand({
      modelId: this.model,
      messages: converseMessages,
      system: converseSystem,
      ...params,
    });
    const response = await this.client.send(command);
    if (response.stream) {
      for await (const chunk of response.stream) {
        if (chunk.contentBlockStart) {
          yield handleConverseStreamContentBlockStart(chunk.contentBlockStart);
        } else if (chunk.contentBlockDelta) {
          const textChatGeneration = handleConverseStreamContentBlockDelta(
            chunk.contentBlockDelta
          );
          yield textChatGeneration;
          await runManager?.handleLLMNewToken(textChatGeneration.text);
        } else if (chunk.metadata) {
          yield handleConverseStreamMetadata(chunk.metadata);
        } else {
          yield new ChatGenerationChunk({
            text: "",
            message: new AIMessageChunk({
              content: "",
              response_metadata: chunk,
            }),
          });
        }
      }
    }
  }
}
