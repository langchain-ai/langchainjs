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
 *   transformInput(prompt: string, modelKwargs: { [key: string]: unknown }) {
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
export abstract class ContentHandlerBase<InputType, OutputType> {
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
    modelKwargs: { [key: string]: unknown }
  ): Uint8Array;

  /**
   * Transforms the output from the model to string that the LLM class expects.
   */
  abstract transformOutput(output: Uint8Array): OutputType;
}

/** Content handler for LLM class. */
type LLMContentHandler = ContentHandlerBase<string, string>;

export interface SagemakerEndpointInput extends BaseLLMParams {
  /**
   * The name of the endpoint from the deployed Sagemaker model. Must be unique
   * within an AWS Region.
   */
  endpointName: string;

  /** The aws region where the Sagemaker model is deployed, eg. `us-west-2`. */
  regionName: string;

  /**
   * The content handler class that provides an input and output transform
   * functions to handle formats between LLM and the endpoint.
   */
  contentHandler: LLMContentHandler;

  /**
   * Key word arguments to pass to the model.
   */
  modelKwargs?: { [key: string]: unknown };

  /**
   * Optional attributes passed to the InvokeEndpointCommand
   */
  endpointKwargs?: { [key: string]: unknown };
}

export class SagemakerEndpoint extends LLM implements SagemakerEndpointInput {
  regionName: string;

  endpointName: string;

  contentHandler: LLMContentHandler;

  modelKwargs?: { [key: string]: unknown };

  endpointKwargs?: { [key: string]: unknown };

  constructor(fields?: SagemakerEndpointInput) {
    super(fields ?? {});

    const regionName = fields?.regionName;
    if (!regionName) {
      throw new Error("Please pass regionName field to the constructor");
    }

    const endpointName = fields?.endpointName;
    if (!endpointName) {
      throw new Error("Please pass endpointName field to the constructor");
    }

    const contentHandler = fields?.contentHandler;
    if (!contentHandler) {
      throw new Error("Please pass contentHandler field to the constructor");
    }

    this.regionName = fields.regionName;
    this.endpointName = fields.endpointName;
    this.contentHandler = fields.contentHandler;
    this.endpointKwargs = fields.endpointKwargs;
    this.modelKwargs = fields.modelKwargs;
  }

  _llmType() {
    return "sagemaker_endpoint";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const { SageMakerRuntimeClient, InvokeEndpointCommand } =
      await SagemakerEndpoint.imports();
    const client = new SageMakerRuntimeClient({ region: this.regionName });

    const body = this.contentHandler.transformInput(
      prompt,
      this.modelKwargs ?? {}
    );
    const { contentType, accepts } = this.contentHandler;

    const response = await client.send(
      new InvokeEndpointCommand({
        EndpointName: this.endpointName,
        Body: body,
        ContentType: contentType,
        Accept: accepts,
        ...this.endpointKwargs,
      }),
      { abortSignal: options.signal }
    );

    if (response.Body === undefined) {
      throw new Error("Inference result missing Body");
    }

    const text = this.contentHandler.transformOutput(response.Body);

    return text;
  }

  /** @ignore */
  static async imports(): Promise<{
    SageMakerRuntimeClient: typeof import("@aws-sdk/client-sagemaker-runtime").SageMakerRuntimeClient;
    InvokeEndpointCommand: typeof import("@aws-sdk/client-sagemaker-runtime").InvokeEndpointCommand;
  }> {
    try {
      const { SageMakerRuntimeClient, InvokeEndpointCommand } = await import(
        "@aws-sdk/client-sagemaker-runtime"
      );
      return { SageMakerRuntimeClient, InvokeEndpointCommand };
    } catch (e) {
      throw new Error(
        "Please install @aws-sdk/client-sagemaker-runtime as a dependency with, e.g. `yarn add @aws-sdk/client-sagemaker-runtime`"
      );
    }
  }
}
