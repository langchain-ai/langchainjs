import {
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { GenerationChunk } from "../schema/index.js";
import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";

/**
 * Abstract handler for transforming SageMaker input and output data.
 * @template InputType Type of the input data.
 * @template OutputType Type of the output data.
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

export type SageMakerEndpointWithStreamLLMContentHandler =
  BaseSageMakerContentHandler<string, string>;

export interface SageMakerEndpointWithStreamParams extends BaseLLMParams {
  endpointName: string;
  clientOptions: SageMakerRuntimeClientConfig;
  modelKwargs?: Record<string, unknown>;
  endpointKwargs?: Record<string, unknown>;
  contentHandler: SageMakerEndpointWithStreamLLMContentHandler;
}

/**
 * Class to interact with a SageMaker endpoint using aws InvokeEndpointWithResponseStreamCommand API.
 */
export class SageMakerEndpointWithStream extends LLM<BaseLLMCallOptions> {
  endpointName: string;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  contentHandler: SageMakerEndpointWithStreamLLMContentHandler;

  _llmType(): string {
    return "sagemaker_endpoint_with_stream";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "clientOptions.credentials.accessKeyId": "AWS_ACCESS_KEY_ID",
      "clientOptions.credentials.secretAccessKey": "AWS_SECRET_ACCESS_KEY",
      "clientOptions.credentials.sessionToken": "AWS_SESSION_TOKEN",
    };
  }

  constructor(params: SageMakerEndpointWithStreamParams) {
    super(params ?? {});

    const regionName = params.clientOptions.region;
    if (!regionName) {
      throw new Error(
        `Please pass a "clientOptions" object with a "region" field to the constructor`
      );
    }

    const endpointName = params?.endpointName;
    if (!endpointName) {
      throw new Error(`Please pass an "endpointName" field to the constructor`);
    }

    const contentHandler = params?.contentHandler;
    if (!contentHandler) {
      throw new Error(
        `Please pass a "contentHandler" field to the constructor`
      );
    }
    this.endpointName = params.endpointName;
    this.modelKwargs = params.modelKwargs;
    this.endpointKwargs = params.endpointKwargs;
    this.contentHandler = params.contentHandler;
    this.client = new SageMakerRuntimeClient(params.clientOptions);
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

    if (stream.Body === undefined) {
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
      const chunks = [];
      for await (const chunk of this._streamResponseChunks(prompt, options)) {
        chunks.push(chunk.text);
      }
      return chunks.join("");
    } catch (error) {
      console.log("error calling SageMakerEndpointWithStream: ", error);
      return "";
    }
  }
}
