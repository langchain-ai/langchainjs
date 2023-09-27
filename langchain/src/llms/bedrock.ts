import { SignatureV4 } from "@aws-sdk/signature-v4";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { EventStreamCodec } from "@smithy/eventstream-codec";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";
import { Sha256 } from "@aws-crypto/sha256-js";
import type { AwsCredentialIdentity, Provider } from "@aws-sdk/types";
import { getEnvironmentVariable } from "../util/env.js";
import { LLM, BaseLLMParams } from "./base.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { GenerationChunk } from "../schema/index.js";

type Dict = { [key: string]: unknown };
type CredentialType = AwsCredentialIdentity | Provider<AwsCredentialIdentity>;

/**
 * A helper class used within the `Bedrock` class. It is responsible for
 * preparing the input and output for the Bedrock service. It formats the
 * input prompt based on the provider (e.g., "anthropic", "ai21",
 * "amazon") and extracts the generated text from the service response.
 */
class BedrockLLMInputOutputAdapter {
  /** Adapter class to prepare the inputs from Langchain to a format
  that LLM model expects. Also, provides a helper function to extract
  the generated text from the model response. */

  static prepareInput(
    provider: string,
    prompt: string,
    maxTokens = 50,
    temperature = 0
  ): Dict {
    const inputBody: Dict = {};

    if (provider === "anthropic") {
      inputBody.prompt = prompt;
      inputBody.max_tokens_to_sample = maxTokens;
      inputBody.temperature = temperature;
    } else if (provider === "ai21") {
      inputBody.prompt = prompt;
      inputBody.maxTokens = maxTokens;
      inputBody.temperature = temperature;
    } else if (provider === "amazon") {
      inputBody.inputText = prompt;
      inputBody.textGenerationConfig = {
        maxTokenCount: maxTokens,
        temperature,
      };
    }
    return inputBody;
  }

  /**
   * Extracts the generated text from the service response.
   * @param provider The provider name.
   * @param responseBody The response body from the service.
   * @returns The generated text.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static prepareOutput(provider: string, responseBody: any): string {
    if (provider === "anthropic") {
      return responseBody.completion;
    } else if (provider === "ai21") {
      return responseBody.data.text;
    }
    return responseBody.outputText;
  }
}

/** Bedrock models.
    To authenticate, the AWS client uses the following methods to automatically load credentials:
    https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html
    If a specific credential profile should be used, you must pass the name of the profile from the ~/.aws/credentials file that is to be used.
    Make sure the credentials / roles used have the required policies to access the Bedrock service.
*/
export interface BedrockInput {
  /** Model to use.
      For example, "amazon.titan-tg1-large", this is equivalent to the modelId property in the list-foundation-models api.
  */
  model: string;

  /** The AWS region e.g. `us-west-2`.
      Fallback to AWS_DEFAULT_REGION env variable or region specified in ~/.aws/config in case it is not provided here.
  */
  region?: string;

  /** AWS Credentials.
      If no credentials are provided, the default credentials from `@aws-sdk/credential-provider-node` will be used.
   */
  credentials?: CredentialType;

  /** Temperature */
  temperature?: number;

  /** Max tokens */
  maxTokens?: number;

  /** A custom fetch function for low-level access to AWS API. Defaults to fetch() */
  fetchFn?: typeof fetch;

  /** Override the default endpoint url */
  endpointUrl?: string;
}

/**
 * A type of Large Language Model (LLM) that interacts with the Bedrock
 * service. It extends the base `LLM` class and implements the
 * `BedrockInput` interface. The class is designed to authenticate and
 * interact with the Bedrock service, which is a part of Amazon Web
 * Services (AWS). It uses AWS credentials for authentication and can be
 * configured with various parameters such as the model to use, the AWS
 * region, and the maximum number of tokens to generate.
 */
export class Bedrock extends LLM implements BedrockInput {
  model = "amazon.titan-tg1-large";

  region: string;

  credentials: CredentialType;

  temperature?: number | undefined = undefined;

  maxTokens?: number | undefined = undefined;

  fetchFn: typeof fetch;

  endpointUrl?: string;

  codec: EventStreamCodec = new EventStreamCodec(toUtf8, fromUtf8);

  get lc_secrets(): { [key: string]: string } | undefined {
    return {};
  }

  _llmType() {
    return "bedrock";
  }

  constructor(fields?: Partial<BedrockInput> & BaseLLMParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    const allowedModels = ["ai21", "anthropic", "amazon"];
    if (!allowedModels.includes(this.model.split(".")[0])) {
      throw new Error(
        `Unknown model: '${this.model}', only these are supported: ${allowedModels}`
      );
    }
    const region =
      fields?.region ?? getEnvironmentVariable("AWS_DEFAULT_REGION");
    if (!region) {
      throw new Error(
        "Please set the AWS_DEFAULT_REGION environment variable or pass it to the constructor as the region field."
      );
    }
    this.region = region;
    this.credentials = fields?.credentials ?? defaultProvider();
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.fetchFn = fields?.fetchFn ?? fetch;
    this.endpointUrl = fields?.endpointUrl;
  }

  /** Call out to Bedrock service model.
    Arguments:
      prompt: The prompt to pass into the model.

    Returns:
      The string generated by the model.

    Example:
      response = model.call("Tell me a joke.")
  */
  async _call(
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
      chunks.push(chunk);
    }
    return chunks.map((chunk) => chunk.text).join("");
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const provider = this.model.split(".")[0];
    const service = "bedrock";

    const inputBody = BedrockLLMInputOutputAdapter.prepareInput(
      provider,
      prompt,
      this.maxTokens,
      this.temperature
    );

    const endpointUrl =
      this.endpointUrl ?? `${service}.${this.region}.amazonaws.com`;

    const url = new URL(
      `https://${endpointUrl}/model/${this.model}/invoke-with-response-stream`
    );

    const request = new HttpRequest({
      hostname: url.hostname,
      path: url.pathname,
      protocol: url.protocol,
      method: "POST", // method must be uppercase
      body: JSON.stringify(inputBody),
      query: Object.fromEntries(url.searchParams.entries()),
      headers: {
        // host is required by AWS Signature V4: https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
        host: url.host,
        accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const signer = new SignatureV4({
      credentials: this.credentials,
      service,
      region: this.region,
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    // Send request to AWS using the low-level fetch API
    const response = await this.caller.callWithOptions(
      { signal: options.signal },
      async () =>
        this.fetchFn(url, {
          headers: signedRequest.headers,
          body: signedRequest.body,
          method: signedRequest.method,
        })
    );

    if (response.status < 200 || response.status >= 300) {
      throw Error(
        `Failed to access underlying url '${url}': got ${response.status} ${
          response.statusText
        }: ${await response.text()}`
      );
    }

    const reader = response.body?.getReader();
    for await (const chunk of this._readChunks(reader)) {
      const event = this.codec.decode(chunk);
      if (
        event.headers[":event-type"].value !== "chunk" ||
        event.headers[":content-type"].value !== "application/json"
      ) {
        throw Error(`Failed to get event chunk: got ${chunk}`);
      }
      const body = JSON.parse(
        Buffer.from(
          JSON.parse(new TextDecoder("utf-8").decode(event.body)).bytes,
          "base64"
        ).toString()
      );
      const text = BedrockLLMInputOutputAdapter.prepareOutput(provider, body);
      yield new GenerationChunk({
        text,
        generationInfo: {},
      });
      await runManager?.handleLLMNewToken(text);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _readChunks(reader: any) {
    return {
      async *[Symbol.asyncIterator]() {
        let readResult = await reader.read();
        while (!readResult.done) {
          yield readResult.value;
          readResult = await reader.read();
        }
      },
    };
  }
}
