import {
  InvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";
import {
  type BaseLLMCallOptions,
  type BaseLLMParams,
  LLM,
} from "@langchain/core/language_models/llms";

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
 * The SageMakerEndpointInput interface defines the input parameters for
 * the SageMakerEndpoint class, which includes the endpoint name, client
 * options for the SageMaker client, the content handler, and optional
 * keyword arguments for the model and the endpoint.
 */
export interface SageMakerEndpointInput extends BaseLLMParams {
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
  streaming?: boolean;
}

/**
 * The SageMakerEndpoint class is used to interact with SageMaker
 * Inference Endpoint models. It uses the AWS client for authentication,
 * which automatically loads credentials.
 * If a specific credential profile is to be used, the name of the profile
 * from the ~/.aws/credentials file must be passed. The credentials or
 * roles used should have the required policies to access the SageMaker
 * endpoint.
 */
export class SageMakerEndpoint extends LLM<BaseLLMCallOptions> {
  lc_serializable = true;

  static lc_name() {
    return "SageMakerEndpoint";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "clientOptions.credentials.accessKeyId": "AWS_ACCESS_KEY_ID",
      "clientOptions.credentials.secretAccessKey": "AWS_SECRET_ACCESS_KEY",
      "clientOptions.credentials.sessionToken": "AWS_SESSION_TOKEN",
    };
  }

  endpointName: string;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  contentHandler: SageMakerLLMContentHandler;

  streaming: boolean;

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

  _llmType() {
    return "sagemaker_endpoint";
  }

  /**
   * Calls the SageMaker endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @param {this["ParsedCallOptions"]} options Parsed call options.
   * @param {CallbackManagerForLLMRun} runManager Optional run manager.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    return this.streaming
      ? await this.streamingCall(prompt, options, runManager)
      : await this.noStreamingCall(prompt, options);
  }

  private async streamingCall(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(
      prompt,
      options,
      runManager
    )) {
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
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
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
        const text = await this.contentHandler.transformOutput(
          chunk.PayloadPart.Bytes
        );
        yield new GenerationChunk({
          text,
          generationInfo: {
            ...chunk,
            response: undefined,
          },
        });
        await runManager?.handleLLMNewToken(text);
      } else if (chunk.InternalStreamFailure) {
        throw new Error(chunk.InternalStreamFailure.message);
      } else if (chunk.ModelStreamError) {
        throw new Error(chunk.ModelStreamError.message);
      }
    }
  }
}
