import {
  InvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import {
  AIMessageChunk,
  BaseMessage,
  ChatGenerationChunk,
  ChatMessage,
} from "../schema/index.js";

import { BaseChatModelParams, SimpleChatModel } from "./base.js";

/**
 * A handler class to transform input from LLM to a format that SageMaker
 * endpoint expects. Similarily, the class also handles transforming output from
 * the SageMaker endpoint to a format that LLM class expects.
 *
 * Example:
 * ```
 * class ContentHandler implements ContentHandlerBase<string, string> {
 *   contentType = "application/json"
 *   accepts = "application/json"
 *
 *   transformInput(prompt: string, modelKwargs: Record<string, unknown>) {
 *     const inputString = JSON.stringify({
 *       prompt,
 *      ...modelKwargs
 *     })
 *     return Buffer.from(inputString)
 *   }
 *
 *   transformOutput(output: Uint8Array) {
 *     const responseJson = JSON.parse(Buffer.from(output).toString("utf-8"))
 *     return responseJson[0].generated_text
 *   }
 *
 * }
 * ```
 */
export abstract class BaseSageMakerContentHandler<InputType, OutputType> {
  contentType = "text/plain";

  accepts = "text/plain";

  /**
   * Transforms the prompt and model arguments into a specific format for sending to SageMaker.
   * @param {InputType} prompt The prompt to be transformed.
   * @param {Record<string, unknown>} modelKwargs Additional arguments.
   * @returns {Promise<Uint8Array>} A promise that resolves to the formatted data for sending.
   */
  abstract transformInput(
    prompt: InputType,
    modelKwargs: Record<string, unknown>
  ): Promise<Uint8Array>;

  /**
   * Transforms SageMaker output into a desired format.
   * @param {Uint8Array} output The raw output from SageMaker.
   * @returns {Promise<OutputType>} A promise that resolves to the transformed data.
   */
  abstract transformOutput(output: Uint8Array): Promise<OutputType>;
}

export type SageMakerLLMContentHandler = BaseSageMakerContentHandler<
  string,
  string
>;

/**
 * An interface defining the options for an Sagemaker API call. It extends
 * the BaseLanguageModelCallOptions interface.
 */
export interface SagemakerCallOptions extends BaseLanguageModelCallOptions {}

export interface SageMakerInput {
  endpointName: string;
  clientOptions: SageMakerRuntimeClientConfig;
  modelKwargs?: Record<string, unknown>;
  endpointKwargs?: Record<string, unknown>;
  contentHandler: SageMakerLLMContentHandler;
  chatMainInstruction: string;
  streaming?: boolean;
}

export class ChatSagemaker
  extends SimpleChatModel<SagemakerCallOptions>
  implements SageMakerInput
{
  /**
   * The name of the endpoint from the deployed SageMaker model. Must be unique
   * within an AWS Region.
   */
  endpointName: string;

  /**
   * Options passed to the SageMaker client.
   */
  clientOptions: SageMakerRuntimeClientConfig;

  /**
   * Key word arguments to pass to the model.
   */
  modelKwargs?: Record<string, unknown>;

  /**
   * Optional attributes passed to the InvokeEndpointCommand
   */
  endpointKwargs?: Record<string, unknown>;

  /**
   * The content handler class that provides an input and output transform
   * functions to handle formats between LLM and the endpoint.
   */
  contentHandler: SageMakerLLMContentHandler;

  client: SageMakerRuntimeClient;

  streaming: boolean;

  chatMainInstruction: string;

  _llmType() {
    return "sagemaker_endpoint";
  }

  static lc_name() {
    return "SageMakerEndpoint";
  }

  _combineLLMOutput() {
    return {};
  }

  constructor(fields: SageMakerInput & BaseChatModelParams) {
    super(fields);

    if (!fields.clientOptions.region) {
      throw new Error(
        `Please pass a "clientOptions" object with a "region" field to the constructor`
      );
    }

    const endpointName = fields?.endpointName;
    if (!endpointName) {
      throw new Error(`Please pass an "endpointName" field to the constructor`);
    }

    const contentHandler = fields?.contentHandler;
    if (!contentHandler) {
      throw new Error(
        `Please pass a "contentHandler" field to the constructor`
      );
    }

    this.endpointName = fields.endpointName;
    this.contentHandler = fields.contentHandler;
    this.endpointKwargs = fields.endpointKwargs;
    this.modelKwargs = fields.modelKwargs;
    this.streaming = fields.streaming ?? false;
    this.clientOptions = fields.clientOptions;
    this.client = new SageMakerRuntimeClient(fields.clientOptions);
    this.chatMainInstruction = fields.chatMainInstruction ?? `
      The pr
    `
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const prompt = this._formatMessagesAsPrompt(messages);
    const body = await this.contentHandler.transformInput(
      prompt,
      this.modelKwargs ?? {}
    );
    const { contentType, accepts } = this.contentHandler;

    const stream = await this.caller.call(() =>
      this.client.send(
        new InvokeEndpointWithResponseStreamCommand({
          EndpointName: this.endpointName,
          Body: body,
          ContentType: contentType,
          Accept: accepts,
          ...this.endpointKwargs,
        }),
        { abortSignal: options.signal }
      )
    );

    if (!stream.Body) {
      throw new Error("Inference result missing Body");
    }

    for await (const chunk of stream.Body) {
      if (chunk.PayloadPart && chunk.PayloadPart.Bytes) {
        yield new ChatGenerationChunk({
          text: await this.contentHandler.transformOutput(
            chunk.PayloadPart.Bytes
          ),
          message: new AIMessageChunk({
            content: await this.contentHandler.transformOutput(
              chunk.PayloadPart.Bytes
            ),
          }),
          generationInfo: {
            ...chunk,
            response: undefined,
          },
        });
      } else if (chunk.InternalStreamFailure) {
        throw new Error(chunk.InternalStreamFailure.message);
      } else if (chunk.ModelStreamError) {
        throw new Error(chunk.ModelStreamError.message);
      }
    }
  }

  protected _formatMessagesAsPrompt(messages: BaseMessage[]): string {
    const formattedMessages = messages
      .map((message) => {
        const type = message._getType();
        switch (type) {
          case "system":
            return `<<SYS>> ${message.content} <</SYS>>`
          case "human":
            return `[INST] ${message.content} [/INST]`
          case "ai":
            return message.content;

          default:
            throw new Error("Invalid chat message");
        }
      })
      .join("\n");

    return `${formattedMessages}`;
  }

  private async streamingCall(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(messages, options)) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }

  private async noStreamingCall(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const prompt = this._formatMessagesAsPrompt(messages);

    const body = await this.contentHandler.transformInput(
      prompt,
      this.modelKwargs ?? {}
    );
    const { contentType, accepts } = this.contentHandler;

    const response = await this.caller.call(() =>
      this.client.send(
        new InvokeEndpointCommand({
          EndpointName: this.endpointName,
          Body: body,
          ContentType: contentType,
          Accept: accepts,
          ...this.endpointKwargs,
        }),
        { abortSignal: options.signal }
      )
    );

    if (response.Body === undefined) {
      throw new Error("Inference result missing Body");
    }
    return this.contentHandler.transformOutput(response.Body);
  }

  /**
   * Calls the SageMaker endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @param {this["ParsedCallOptions"]} options Parsed call options.
   * @param {CallbackManagerForLLMRun} _runManager Optional run manager.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    return this.streaming
      ? await this.streamingCall(messages, options)
      : await this.noStreamingCall(messages, options);
  }
}
