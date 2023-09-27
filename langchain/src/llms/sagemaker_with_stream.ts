import {
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { GenerationChunk } from "../schema/index.js";
// import { GenerationChunk, LLMResult } from "../schema/index.js";
import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";
// import { BaseLLM, BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";

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

export class SageMakerWithStream extends LLM<BaseLLMCallOptions> {
  endpointName: string;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  contentHandler: SageMakerWithStreamLLMContentHandler;

  _llmType(): string {
    return "sagemaker_endpoint";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "clientOptions.credentials.accessKeyId": "AWS_ACCESS_KEY_ID",
      "clientOptions.credentials.secretAccessKey": "AWS_SECRET_ACCESS_KEY",
      "clientOptions.credentials.sessionToken": "AWS_SESSION_TOKEN",
    };
  }

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

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
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
      console.log('\n ...');
      if (chunk.PayloadPart && chunk.PayloadPart.Bytes) {
        console.log('@@@@ chunk.PayloadPart.Bytes: ', chunk.PayloadPart.Bytes);
        yield new GenerationChunk({
          text: Buffer.from(chunk.PayloadPart.Bytes).toString("utf-8"),
          generationInfo: {
            ...chunk,
            response: undefined,
          },
        });
      } else if (chunk.InternalStreamFailure) {
        console.log('@@@@ chunk.InternalStreamFailure: ', chunk.InternalStreamFailure);
        yield new GenerationChunk({
          text: chunk.InternalStreamFailure.message,
          generationInfo: {
            ...chunk.InternalStreamFailure,
            response: undefined,
          },
        });
      } else if (chunk.ModelStreamError) {
        console.log('@@@@ chunk.ModelStreamError: ', chunk.ModelStreamError);
        yield new GenerationChunk({
          text: chunk.ModelStreamError.message,
          generationInfo: {
            ...chunk.ModelStreamError,
            response: undefined,
          },
        });
      } else {
        console.log('@@@@ chunk: ', chunk);
      }

      // check chunk.$unknown ?
    }

    // const stream = await this.caller.call(async () =>
    //   createOllamaStream(
    //     this.baseUrl,
    //     { ...this.invocationParams(options), prompt },
    //     options
    //   )
    // );

    // for await (const chunk of stream) {
    //   if (!chunk.done) {
    //     yield new GenerationChunk({
    //       text: chunk.response,
    //       generationInfo: {
    //         ...chunk,
    //         response: undefined,
    //       },
    //     });
    //   } else {
    //     yield new GenerationChunk({
    //       text: "",
    //       generationInfo: {
    //         model: chunk.model,
    //         total_duration: chunk.total_duration,
    //         load_duration: chunk.load_duration,
    //         prompt_eval_count: chunk.prompt_eval_count,
    //         prompt_eval_duration: chunk.prompt_eval_duration,
    //         eval_count: chunk.eval_count,
    //         eval_duration: chunk.eval_duration,
    //       },
    //     });
    //   }
    // }
  }

  // async _generate(
  //     prompts: string[],
  //     _options: BaseLLMCallOptions,
  //     runManager?: CallbackManagerForLLMRun
  // ): Promise<LLMResult> {
  //     // For simplicity, this example just returns the prompt with 'Hello, ' prepended to each prompt
  //     return {
  //         generations: prompts.map(prompt => [{ text: `Hello, ${prompt}` }])
  //     };
  // }

   /** @ignore */
   async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(
      prompt,
      options,
    )) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }
}
