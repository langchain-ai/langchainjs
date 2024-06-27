import type {
  MessageContentComplex,
  BaseMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import {
  AIMessage,
  ToolMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import type {
  ToolDefinition,
  BaseLanguageModelCallOptions,
} from "@langchain/core/language_models/base";
import { isOpenAITool } from "@langchain/core/language_models/base";
import type { AwsCredentialIdentity, Provider } from "@aws-sdk/types";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
} from "@langchain/core/language_models/chat_models";
import type {
  Message as BedrockMessage,
  SystemContentBlock as BedrockSystemContentBlock,
  ToolConfiguration,
  Tool as BedrockTool,
  ToolChoice,
  ContentBlock,
  ImageFormat,
  ConverseResponse,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  defaultProvider,
  DefaultProviderInit,
} from "@aws-sdk/credential-provider-node";
import type { DocumentType as __DocumentType } from "@smithy/types";
import { StructuredToolInterface } from "@langchain/core/tools";
import { isStructuredTool } from "@langchain/core/utils/function_calling";
import { zodToJsonSchema } from "zod-to-json-schema";

export type CredentialType =
  | AwsCredentialIdentity
  | Provider<AwsCredentialIdentity>;
export type ConverseCommandParams = ConstructorParameters<
  typeof ConverseCommand
>[0];
export type BedrockToolChoice =
  | ToolChoice.AnyMember
  | ToolChoice.AutoMember
  | ToolChoice.ToolMember;

function extractImageInfo(base64: string): ContentBlock.ImageMember {
  // Extract the format from the base64 string
  const formatMatch = base64.match(/^data:image\/(\w+);base64,/);
  let format: ImageFormat | undefined;
  if (formatMatch) {
    const extractedFormat = formatMatch[1].toLowerCase();
    if (["gif", "jpeg", "png", "webp"].includes(extractedFormat)) {
      format = extractedFormat as ImageFormat;
    }
  }

  // Remove the data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

  // Convert base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    image: {
      format,
      source: {
        bytes,
      },
    },
  };
}

function convertToConverseMessages(messages: BaseMessage[]): {
  converseMessages: BedrockMessage[];
  converseSystem: BedrockSystemContentBlock[];
} {
  const converseSystem: BedrockSystemContentBlock[] = messages
    .filter((msg) => msg._getType() === "system")
    .map((msg) => {
      const text = msg.content;
      if (typeof text !== "string") {
        throw new Error("System message content must be a string.");
      }
      return { text };
    });
  const converseMessages: BedrockMessage[] = messages
    .filter((msg) => !["system", "tool", "function"].includes(msg._getType()))
    .map((msg) => {
      if (msg._getType() === "ai") {
        const castMsg = msg as AIMessage;
        if (typeof castMsg.content === "string") {
          return {
            role: "assistant",
            content: [
              {
                text: castMsg.content,
              },
            ],
          };
        } else {
          if (castMsg.tool_calls && castMsg.tool_calls.length) {
            return {
              role: "assistant",
              content: castMsg.tool_calls.map((tc) => ({
                toolUse: {
                  toolUseId: tc.id,
                  name: tc.name,
                  input: tc.args,
                },
              })),
            };
          } else {
            const contentBlocks: ContentBlock[] = castMsg.content.map(
              (block) => {
                if (block.type === "text") {
                  return {
                    text: block.text,
                  };
                } else {
                  throw new Error(
                    `Unsupported content block type: ${block.type}`
                  );
                }
              }
            );
            return {
              role: "assistant",
              content: contentBlocks,
            };
          }
        }
      } else if (msg._getType() === "human" || msg._getType() === "generic") {
        if (typeof msg.content === "string") {
          return {
            role: "user",
            content: [
              {
                text: msg.content,
              },
            ],
          };
        } else {
          const contentBlocks: ContentBlock[] = msg.content.flatMap((block) => {
            if (block.type === "image_url") {
              const base64: string =
                typeof block.image_url === "string"
                  ? block.image_url
                  : block.image_url.url;
              return extractImageInfo(base64);
            } else if (block.type === "text") {
              return {
                text: block.text,
              };
            } else {
              throw new Error(`Unsupported content block type: ${block.type}`);
            }
          });
          return {
            role: "user",
            content: contentBlocks,
          };
        }
      } else if (msg._getType() === "tool") {
        const castMsg = msg as ToolMessage;
        if (typeof castMsg.content === "string") {
          return {
            role: undefined,
            content: [
              {
                toolResult: {
                  toolUseId: castMsg.tool_call_id,
                  content: [
                    {
                      text: castMsg.content,
                    },
                  ],
                },
              },
            ],
          };
        } else {
          return {
            role: undefined,
            content: [
              {
                toolResult: {
                  toolUseId: castMsg.tool_call_id,
                  content: [
                    {
                      json: castMsg.content,
                    },
                  ],
                },
              },
            ],
          };
        }
      } else {
        throw new Error(`Unsupported message type: ${msg._getType()}`);
      }
    });

  return { converseMessages, converseSystem };
}

function isBedrockTool(tool: unknown): tool is BedrockTool {
  if (typeof tool === "object" && tool && "toolSpec" in tool) {
    return true;
  }
  return false;
}

function convertToConverseTools(
  tools: (StructuredToolInterface | ToolDefinition | BedrockTool)[]
): BedrockTool[] {
  if (tools.every(isOpenAITool)) {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: {
          json: tool.function.parameters as __DocumentType,
        },
      },
    }));
  } else if (tools.every(isStructuredTool)) {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: zodToJsonSchema(tool.schema) as __DocumentType,
        },
      },
    }));
  } else if (tools.every(isBedrockTool)) {
    return tools;
  }

  throw new Error(
    "Invalid tools passed. Must be an array of StructuredToolInterface, ToolDefinition, or BedrockTool."
  );
}

function convertToBedrockToolChoice(
  toolChoice: string | BedrockToolChoice,
  tools: BedrockTool[]
): BedrockToolChoice {
  if (typeof toolChoice === "string") {
    switch (toolChoice) {
      case "any":
        return {
          any: {},
        };
      case "auto":
        return {
          auto: {},
        };
      default: {
        const foundTool = tools.find(
          (tool) => tool.toolSpec?.name === toolChoice
        );
        if (!foundTool) {
          throw new Error(
            `Tool with name ${toolChoice} not found in tools list.`
          );
        }
        return {
          tool: {
            name: toolChoice,
          },
        };
      }
    }
  }
  return toolChoice;
}

function convertConverseMessageToLangChainMessage(
  message: BedrockMessage,
  responseMetadata: Omit<ConverseResponse, "output">
): BaseMessage {
  if (!message.content) {
    throw new Error("No message content found in response.");
  }
  if (message.role !== "assistant") {
    throw new Error(
      `Unsupported message role received in ChatBedrockConverse response: ${message.role}`
    );
  }
  let tokenUsage: UsageMetadata | undefined;
  if (responseMetadata.usage) {
    const input_tokens = responseMetadata.usage.inputTokens ?? 0;
    const output_tokens = responseMetadata.usage.outputTokens ?? 0;
    tokenUsage = {
      input_tokens,
      output_tokens,
      total_tokens:
        responseMetadata.usage.totalTokens ?? input_tokens + output_tokens,
    };
  }

  if (
    message.content?.length === 1 &&
    "text" in message.content[0] &&
    typeof message.content[0].text === "string"
  ) {
    return new AIMessage({
      content: message.content[0].text,
      response_metadata: responseMetadata,
      usage_metadata: tokenUsage,
    });
  } else {
    const toolCalls: ToolCall[] = [];
    const content: MessageContentComplex[] = [];
    message.content.forEach((c) => {
      if (
        "toolUse" in c &&
        c.toolUse &&
        c.toolUse.name &&
        c.toolUse.input &&
        typeof c.toolUse.input === "object"
      ) {
        toolCalls.push({
          id: c.toolUse.toolUseId,
          name: c.toolUse.name,
          args: c.toolUse.input,
        });
      } else if ("text" in c && typeof c.text === "string") {
        content.push({ type: "text", text: c.text });
      } else {
        content.push(c);
      }
    });
    return new AIMessage({
      content: content.length ? content : "",
      tool_calls: toolCalls.length ? toolCalls : undefined,
      response_metadata: responseMetadata,
      usage_metadata: tokenUsage,
    });
  }
}

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
      ...credentials,
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
    console.log("RES", JSON.stringify(response, null, 2));
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
  // async *_streamResponseChunks(
  //   messages: BaseMessage[],
  //   options: this["ParsedCallOptions"],
  //   runManager?: CallbackManagerForLLMRun
  // ): AsyncGenerator<ChatGenerationChunk> {
  //   // All models have a built in `this.caller` property for retries
  //   const stream = await this.caller.call(async () => createStreamMethod());
  //   for await (const chunk of stream) {
  //     if (!chunk.done) {
  //       yield new ChatGenerationChunk({
  //         text: chunk.response,
  //         message: new AIMessageChunk({ content: chunk.response }),
  //       });
  //       await runManager?.handleLLMNewToken(chunk.response ?? "");
  //     }
  //   }
  // }
}
