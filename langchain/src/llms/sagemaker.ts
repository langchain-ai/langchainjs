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

  abstract transformInput(
    prompt: InputType,
    modelKwargs: Record<string, unknown>
  ): Promise<Uint8Array>;

  abstract transformOutput(output: Uint8Array): Promise<OutputType>;
}

export type SageMakerLLMContentHandler = BaseSageMakerContentHandler<string, string>;

export interface SageMakerEndpointInput extends BaseLLMParams {
  endpointName: string;
  clientOptions: SageMakerRuntimeClientConfig;
  modelKwargs?: Record<string, unknown>;
  endpointKwargs?: Record<string, unknown>;
  contentHandler: SageMakerLLMContentHandler;
  streaming?: boolean; // flag to control streaming vs non-streaming behavior
}

export class UnifiedSageMakerEndpoint extends LLM<BaseLLMCallOptions> {
  endpointName: string;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  contentHandler: SageMakerLLMContentHandler;

  streaming: boolean;

  constructor(fields: SageMakerEndpointInput) {
    super(fields);

    if (!fields.clientOptions.region) {
      throw new Error(`Please pass a "clientOptions" object with a "region" field to the constructor`);
    }

    this.endpointName = fields.endpointName;
    this.contentHandler = fields.contentHandler;
    this.modelKwargs = fields.modelKwargs;
    this.endpointKwargs = fields.endpointKwargs;
    this.streaming = fields.streaming ?? false;
    this.client = new SageMakerRuntimeClient(fields.clientOptions);
  }

  _llmType() {
    return this.streaming ? "sagemaker_endpoint_with_stream" : "sagemaker_endpoint";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    return this.streaming ? 
           await this.streamingCall(prompt, options) : 
           await this.noStreamingCall(prompt, options);
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
    const body = await this.contentHandler.transformInput(prompt, this.modelKwargs ?? {});
    const { contentType, accepts } = this.contentHandler;

    const response = await this.client.send(
      new InvokeEndpointCommand({
        EndpointName: this.endpointName,
        Body: body,
        ContentType: contentType,
        Accept: accepts,
        ...this.endpointKwargs
      })
    );

    if (!response.Body) {
      throw new Error("Inference result missing Body");
    }
    return this.contentHandler.transformOutput(response.Body);
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): AsyncGenerator<GenerationChunk> {
    const body = await this.contentHandler.transformInput(prompt, this.modelKwargs ?? {});
    const { contentType, accepts } = this.contentHandler;

    const stream = await this.client.send(
      new InvokeEndpointWithResponseStreamCommand({
        EndpointName: this.endpointName,
        Body: body,
        ContentType: contentType,
        Accept: accepts,
        ...this.endpointKwargs
      })
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
            response: undefined
          }
        });
      }
      // Additional conditions can be added here if necessary
    }
  }
}