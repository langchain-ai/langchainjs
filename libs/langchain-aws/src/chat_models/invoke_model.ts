import type { BaseMessage } from "@langchain/core/messages";
import {
  DefaultProviderInit,
  defaultProvider,
} from "@aws-sdk/credential-provider-node";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { Runnable } from "@langchain/core/runnables";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import type { DocumentType as __DocumentType } from "@smithy/types";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { ChatBedrockConverseInput } from "./converse.js";
import {
  convertToInvokeModelTools,
  BedrockConverseToolChoice,
  convertToBedrockInvokeModelToolChoice,
  convertToInvokeModelMessages,
  convertInvokeModelMessageToLangChainMessage,
} from "../common.js";
import { ChatBedrockInvokeModelToolType } from "../types.js";

export interface ChatBedrockInvokeModelInput
  extends BaseChatModelParams,
    Pick<
      ChatBedrockConverseInput,
      | "model"
      | "credentials"
      | "region"
      | "client"
      | "supportsToolChoiceValues"
      | "streaming"
    >,
    Partial<DefaultProviderInit> {
  contentType?: string;

  trace?: "DISABLED" | "ENABLED";

  guardrailIdentifier?: string;

  guardrailVersion?: string;

  performanceConfigLatency?: "standard" | "optimized";

  anthropicVersion?: string;
}

export interface ChatBedrockInvokeModelCallOptions
  extends BaseChatModelCallOptions,
    ChatBedrockInvokeModelInput {
  body?: Record<string, any>;

  /**
   * A list of stop sequences. A stop sequence is a sequence of characters that causes
   * the model to stop generating the response.
   */
  stop?: string[];

  tools?: ChatBedrockInvokeModelToolType[];

  /**
   * Tool choice for the model. If passing a string, it must be "any", "auto" or the
   * name of the tool to use. Or, pass a BedrockToolChoice object.
   *
   * If "any" is passed, the model must request at least one tool.
   * If "auto" is passed, the model automatically decides if a tool should be called
   * or whether to generate text instead.
   * If a tool name is passed, it will force the model to call that specific tool.
   */
  tool_choice?: BedrockConverseToolChoice;
}

export class ChatBedrockInvokeModel
  extends BaseChatModel<ChatBedrockInvokeModelCallOptions, AIMessageChunk>
  implements ChatBedrockInvokeModelInput
{
  streaming = false;

  model = "anthropic.claude-3-haiku-20240307-v1:0";

  region: string;

  client: BedrockRuntimeClient;

  contentType: string;

  trace?: "DISABLED" | "ENABLED";

  guardrailIdentifier?: string;

  guardrailVersion?: string;

  body?: Record<string, any>;

  performanceConfigLatency?: "standard" | "optimized";

  /**
   * Which types of `tool_choice` values the model supports.
   *
   * Inferred if not specified. Inferred as ['auto', 'any', 'tool'] if a 'claude-3'
   * model is used, ['auto', 'any'] if a 'mistral-large' model is used, empty otherwise.
   */
  supportsToolChoiceValues?: Array<"auto" | "any" | "tool">;

  constructor(fields?: ChatBedrockInvokeModelInput) {
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

    this.client =
      fields?.client ??
      new BedrockRuntimeClient({
        region,
        credentials,
      });
    this.region = region;
    this.model = rest?.model ?? this.model;
    this.trace = rest?.trace ?? this.trace;
    this.contentType = rest?.contentType ?? this.contentType;
    this.streaming = rest?.streaming ?? this.streaming;
    this.guardrailVersion = rest?.guardrailVersion ?? this.guardrailVersion;
    this.guardrailIdentifier =
      rest?.guardrailIdentifier ?? this.guardrailIdentifier;
    this.performanceConfigLatency =
      rest?.performanceConfigLatency ?? this.performanceConfigLatency;
    if (rest?.supportsToolChoiceValues === undefined) {
      if (this.model.includes("claude-3")) {
        this.supportsToolChoiceValues = ["auto", "any", "tool"];
      } else if (this.model.includes("mistral-large")) {
        this.supportsToolChoiceValues = ["auto", "any"];
      } else {
        this.supportsToolChoiceValues = undefined;
      }
    } else {
      this.supportsToolChoiceValues = rest.supportsToolChoiceValues;
    }
  }

  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatBedrockInvokeModel";
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

  _llmType() {
    return "chat_bedrock_invoke_model";
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      throw new Error("streaming not supported yet.");
    }
    console.log(messages[0])
    return this._generateNonStreaming(messages, options, runManager);
  }

  async _generateNonStreaming(
    messages: BaseMessage[],
    options: Partial<this["ParsedCallOptions"]>,
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const { invokeModelMessages, invokeModelSystem } =
      convertToInvokeModelMessages(messages);
    const { toolConfig, ...rest } = this.invocationParams(options);
    const body = options?.body ?? {};

    const command = new InvokeModelCommand({
      ...rest,
      body: JSON.stringify({
        ...body,
        ...toolConfig,
        messages: invokeModelMessages,
        system: invokeModelSystem,
      }),
    });
    const response = await this.client.send(command, {
      abortSignal: options.signal,
    });
    const { body: output, ...responseMetadata } = response;
    if (!output) {
      throw new Error("No message found in Bedrock response.");
    }
    const message = convertInvokeModelMessageToLangChainMessage(
      output,
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

  invocationParams(options?: this["ParsedCallOptions"]) {
    let toolConfig;
    if (options?.tools && options.tools.length) {
      const tools = convertToInvokeModelTools(options.tools);
      toolConfig = {
        tools,
        toolChoice: options.tool_choice
          ? convertToBedrockInvokeModelToolChoice(options.tool_choice, tools, {
              model: this.model,
              supportsToolChoiceValues: this.supportsToolChoiceValues,
            })
          : undefined,
      };
    }

    return {
      modelId: this.model,
      contentType: this.contentType,
      trace: this.trace,
      guardrailVersion: this.guardrailVersion,
      guardrailIdentifier: this.guardrailIdentifier,
      performanceConfigLatency: this.performanceConfigLatency,
      toolConfig,
    };
  }

  override bindTools(
    tools: ChatBedrockInvokeModelToolType[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    this["ParsedCallOptions"]
  > {
    return this.bind({ tools: convertToInvokeModelTools(tools), ...kwargs });
  }
}
