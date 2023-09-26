import {
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { LLMResult } from "../schema/index.js";
// import { GenerationChunk, LLMResult } from "../schema/index.js";
import { BaseLLM, BaseLLMCallOptions, BaseLLMParams } from "./base.js";

export abstract class BaseSageMakerContentHandler<InputType, OutputType> {
  contentType = "text/plain";

  accepts = "text/plain";

  abstract transformInput(
    prompt: InputType,
    modelKwargs: Record<string, unknown>
  ): Promise<Uint8Array>;

  abstract transformOutput(output: Uint8Array): Promise<OutputType>;
}

export type SageMakerWithStreamLLMContentHandler = BaseSageMakerContentHandler<
  string,
  string
>;

export interface SageMakerWithStreamParams extends BaseLLMParams {
  endpointName: string;
  clientOptions: SageMakerRuntimeClientConfig;
  modelKwargs?: Record<string, unknown>;
  endpointKwargs?: Record<string, unknown>;
  contentHandler: SageMakerWithStreamLLMContentHandler;
}

export class SageMakerWithStream extends BaseLLM<BaseLLMCallOptions> {
  endpointName: string;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  contentHandler: SageMakerWithStreamLLMContentHandler;

  constructor(params: SageMakerWithStreamParams) {
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

  async _generate(
      prompts: string[],
      _options: BaseLLMCallOptions
  ): Promise<LLMResult> {
      // For simplicity, this example just returns the prompt with 'Hello, ' prepended to each prompt
      return {
          generations: prompts.map(prompt => [{ text: `Hello, ${prompt}` }])
      };
  }

  _llmType(): string {
      return "sagemaker_endpoint";
  }
}
