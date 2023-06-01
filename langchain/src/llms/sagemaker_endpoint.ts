import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { LLM, BaseLLMParams } from "./base.js";

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
  /** The MIME type of the input data passed to endpoint */
  contentType = "text/plain";

  /** The MIME type of the response data returned from endpoint */
  accepts = "text/plain";

  /**
   * Transforms the input to a format that model can accept as the request Body.
   * Should return bytes or seekable file like object in the format specified in
   * the contentType request header.
   */
  abstract transformInput(
    prompt: InputType,
    modelKwargs: Record<string, unknown>
  ): Promise<Uint8Array>;

  /**
   * Transforms the output from the model to string that the LLM class expects.
   */
  abstract transformOutput(output: Uint8Array): Promise<OutputType>;
}

/** Content handler for LLM class. */
export type SageMakerLLMContentHandler = BaseSageMakerContentHandler<
  string,
  string
>;

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
   * The content handler class that provides an input and output transform
   * functions to handle formats between LLM and the endpoint.
   */
  contentHandler: SageMakerLLMContentHandler;

  /**
   * Key word arguments to pass to the model.
   */
  modelKwargs?: Record<string, unknown>;

  /**
   * Optional attributes passed to the InvokeEndpointCommand
   */
  endpointKwargs?: Record<string, unknown>;
}

export class SageMakerEndpoint extends LLM {
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "0.clientOptions.credentials.accessKeyId": "AWS_ACCESS_KEY_ID",
      "0.clientOptions.credentials.secretAccessKey": "AWS_SECRETE_ACCESS_KEY",
      "0.clientOptions.credentials.sessionToken": "AWS_SESSION_TOKEN",
    };
  }

  endpointName: string;

  contentHandler: SageMakerLLMContentHandler;

  modelKwargs?: Record<string, unknown>;

  endpointKwargs?: Record<string, unknown>;

  client: SageMakerRuntimeClient;

  constructor(fields: SageMakerEndpointInput) {
    super(fields ?? {});

    const regionName = fields.clientOptions.region;
    if (!regionName) {
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
    this.client = new SageMakerRuntimeClient(fields.clientOptions);
  }

  _llmType() {
    return "sagemaker_endpoint";
  }

  /** @ignore */
  async _call(
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
}
