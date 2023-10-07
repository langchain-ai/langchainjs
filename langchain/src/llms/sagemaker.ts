import {
  InvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { GenerationChunk } from "../schema/index.js";
import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";

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

export interface SageMakerEndpointInput extends BaseLLMParams {
  endpointName: string;
  clientOptions: SageMakerRuntimeClientConfig;
  modelKwargs?: Record<string, unknown>;
  endpointKwargs?: Record<string, unknown>;
  contentHandler: SageMakerLLMContentHandler;
  streaming?: boolean;
}

/**
 * Class to interact with a SageMaker endpoint using aws InvokeEndpointCommand or InvokeEndpointWithResponseStreamCommand API.
 */
export class SageMaker extends LLM<BaseLLMCallOptions> {
  endpointName: string;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  contentHandler: SageMakerLLMContentHandler;

  streaming: boolean;

  _llmType() {
    return this.streaming ? "sagemaker_with_stream" : "sagemaker";
  }

  constructor(fields: SageMakerEndpointInput) {
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
    this.client = new SageMakerRuntimeClient(fields.clientOptions);
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
    prompt: string,
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    try {
      return this.streaming
        ? await this.streamingCall(prompt, options)
        : await this.noStreamingCall(prompt, options);
    } catch (error) {
      console.log("error calling Sagemaker LLM: ", error);
      return "";
    }
  }

  private async streamingCall(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(prompt, options)) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }

  private async noStreamingCall(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
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
   * Streams response chunks from the SageMaker endpoint.
   * @param {string} prompt The input prompt.
   * @param {this["ParsedCallOptions"]} options Parsed call options.
   * @returns {AsyncGenerator<GenerationChunk>} An asynchronous generator yielding generation chunks.
   */
  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): AsyncGenerator<GenerationChunk> {
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
        yield new GenerationChunk({
          text: Buffer.from(chunk.PayloadPart.Bytes).toString("utf-8"),
          generationInfo: {
            ...chunk,
            response: undefined,
          },
        });
      } else if (chunk.InternalStreamFailure) {
        yield new GenerationChunk({
          text: chunk.InternalStreamFailure.message,
          generationInfo: {
            ...chunk.InternalStreamFailure,
            response: undefined,
          },
        });
      } else if (chunk.ModelStreamError) {
        yield new GenerationChunk({
          text: chunk.ModelStreamError.message,
          generationInfo: {
            ...chunk.ModelStreamError,
            response: undefined,
          },
        });
      } else if (chunk.$unknown) {
        yield new GenerationChunk({
          text: chunk.$unknown.toString(),
          generationInfo: {
            ...chunk.$unknown,
            response: undefined,
          },
        });
      }
    }
  }
}
