import { EmbeddingsParams, MultimodalEmbeddings } from "@langchain/core/embeddings";
import { ApiClient } from "../clients/index.js";
import { getPlatformType, GooglePlatformType } from "../utils/platform.js";
import { ConfigurationError, RequestError } from "../utils/errors.js";
import { convertParamsToPlatformType } from "../converters/params.js";
import { ContentBlock } from "@langchain/core/messages";
import { convertStandardContentBlockToGeminiPart } from "../converters/messages.js";
import { Gemini } from "../chat_models/types.js";
import { AIStudio } from "./ai-typtes-aistudio.js";
import { Vertex } from "./ai-types-vertex.js";

export interface BaseGoogleEmbeddingsParams extends EmbeddingsParams {
  /**
   * The name of the embedding model to use.
   */
  model: string;

  /**
   * The number of dimensions the resulting output embeddings should have.
   */
  dimensions?: number;

  /**
   * An alias for `dimensions` for compatibility.
   */
  outputDimensionality?: number;

  /**
   * Optional. The API client implementation for making HTTP requests to the Gemini API.
   * If not set, a default client will be used based on the runtime environment.
   */
  apiClient?: ApiClient;

  /**
   * Hostname for the API call (if this is running on GCP)
   * Usually this is computed based on location and platformType.
   **/
  endpoint?: string;

  /**
   * Region where the LLM is stored (if this is running on GCP)
   * Defaults to "global"
   **/
  location?: string;

  /**
   * The version of the API functions. Part of the path.
   * Usually this is computed based on platformType.
   **/
  apiVersion?: string;

  /**
   * What platform to run the service on.
   * If not specified, the class should determine this from other
   * means. Either way, the platform actually used will be in
   * the "platform" getter.
   */
  platformType?: GooglePlatformType;

  /**
   * For compatibility with Google's libraries, should this use Vertex?
   * The "platformType" parameter takes precedence.
   */
  vertexai?: boolean;

}

export abstract class BaseGoogleEmbeddings<TOutput = number[]>
  extends MultimodalEmbeddings<TOutput>
{

  model: string;

  outputDimensionality?: number;

  protected _platform?: GooglePlatformType;

  protected _endpoint?: string;

  protected _location?: string;

  protected _apiVersion?: string;

  protected apiClient: ApiClient;

  protected constructor(params: BaseGoogleEmbeddingsParams) {
    super(params);

    if (!params.apiClient) {
      throw new ConfigurationError(
        "BaseGoogleEmbeddings requires an apiClient. This should be provided automatically by ChatGoogle constructors. If you're extending BaseGoogleEmbeddings directly, please provide an apiClient instance."
      );
    }
    this.apiClient = params.apiClient;

    this.model = params.model;
    this.outputDimensionality = params.dimensions ?? params.outputDimensionality;
    this._platform = convertParamsToPlatformType(params);
    this._endpoint = params.endpoint;
    this._location = params.location;
    this._apiVersion = params.apiVersion;
  }

  protected get platformType(): GooglePlatformType | undefined {
    return this._platform;
  }

  protected get platform(): GooglePlatformType {
    return getPlatformType(this._platform, this.apiClient.hasApiKey());
  }

  protected get apiVersion(): string {
    if (typeof this._apiVersion !== "undefined") {
      return this._apiVersion;
    } else if (this.platform === "gai") {
      return "v1beta";
    } else {
      return "v1";
    }
  }

  protected get location(): string {
    return this._location || "us-central1";
  }

  protected get endpoint(): string {
    if (typeof this._endpoint !== "undefined") {
      return this._endpoint;
    } else if (this.platform === "gai") {
      return "generativelanguage.googleapis.com";
    } else if (this.location === "global") {
      // See https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#use_the_global_endpoint
      return "aiplatform.googleapis.com";
    } else {
      return `${this.location}-aiplatform.googleapis.com`;
    }
  }

  protected get publisher(): string {
    return "google";
  }

  protected get urlMethod(): string {
    switch (this.platform) {
      case "gcp":
        return "predict";
      case "gai":
        return "embedContent";
      default:
        throw new Error(
          `Unknown platform when building method: ${this.platform}`
        );
    }
  }

  protected async buildUrlAIStudio(urlMethod?: string): Promise<string> {
    return `https://${this.endpoint}/${this.apiVersion}/models/${this.model}:${
      urlMethod ?? this.urlMethod
    }`;
  }

  protected async buildUrlVertex(urlMethod?: string): Promise<string> {
    const projectId = await this.apiClient.getProjectId();
    return `https://${this.endpoint}/${
      this.apiVersion
    }/projects/${projectId}/locations/${this.location}/publishers/${
      this.publisher
    }/models/${this.model}:${urlMethod ?? this.urlMethod}`;
  }

  protected async buildUrl(urlMethod?: string): Promise<string> {
    switch (this.platform) {
      case "gai":
        return this.buildUrlAIStudio(urlMethod);
      case "gcp":
        return this.buildUrlVertex(urlMethod);
      default:
        throw new Error(
          `Unknown platform when building URL: ${this.platform}`
        )
    }
  }

  get isMultimodal(): boolean {
    const isGeminiMultimodal = this.model.startsWith("gemini") && (this.model !== 'gemini-embedding-001');
    return this.model.startsWith("multimodal") || isGeminiMultimodal;
  }

  protected _convertDocumentsToBodyAIStudio(documents: ContentBlock.Standard[]): AIStudio.Request {
    const parts: Gemini.Part[] = documents.map((document: ContentBlock.Standard) => {
      const part = convertStandardContentBlockToGeminiPart(document);
      if (part === null) {
        throw new Error(`Unsupported block type: ${document.type}`);
      }
      return part;
    })
    const content: Gemini.Content = {
      parts,
    }
    return {
      model: this.model,
      content,
      outputDimensionality: this.outputDimensionality,
    }
  }

  protected _convertStandardDataContentBlockToVertexInstance(block: ContentBlock.Multimodal.Data): Vertex.Instance {
    function uint8arrayToString(data: Uint8Array): string {
      return btoa(
        Array.from(data as Uint8Array)
          .map((byte) => String.fromCharCode(byte))
          .join("")
      );
    }

    const type = block.type;
    if ("data" in block) {
      const bytesBase64Encoded: string =
        typeof block.data === "string"
          ? block.data
          : uint8arrayToString(block.data!);
      return {
        [type]: {
          bytesBase64Encoded,
        }
      }
    } else if ("url" in block && block.url?.startsWith('gs:')) {
      return {
        [type]: {
          gcsUri: block.url
        }
      }
    } else {
      throw new Error(`Unsupported block type or value: ${block.type}`);
    }
  }

  protected _convertStandardContentBlockToVertexInstance(block: ContentBlock.Standard): Vertex.Instance {
    switch (block.type) {
      case "text":
        return this.isMultimodal
          ? {text: block.text}
          : {content: block.text};
      case "image":
      case "video":
        return this._convertStandardDataContentBlockToVertexInstance(block);
      default:
        throw new Error(`Unsupported block type: ${block.type}`);
    }
  }

  protected _convertDocumentsToBodyVertex(documents: ContentBlock.Standard[]): Vertex.Request {
    const instances: Vertex.Instance[] = documents.map((document: ContentBlock.Standard) => {
      return this._convertStandardContentBlockToVertexInstance(document);
    })
    const parameters: Vertex.Params = {
      outputDimensionality: this.outputDimensionality,
    }
    const body: Vertex.Request = {
      instances,
    }
    if (Object.values(parameters).some((v) => v !== undefined)) {
      body.parameters = parameters;
    }
    return body;
  }

  protected _convertDocumentsToBody(documents: ContentBlock.Standard[]) {
    switch (this.platform) {
      case "gai":
        return this._convertDocumentsToBodyAIStudio(documents);
      case "gcp":
        return this._convertDocumentsToBodyVertex(documents);
      default:
        throw new Error(
          `Unknown platform when converting documents: ${this.platform}`
        )
    }
  }

  protected async _convertResponseToValuesAIStudio(response: Response): Promise<number[]> {
    const body: AIStudio.Response = await response.json();
    return body.embedding.values;
  }

  protected async _convertResponseToValuesVertex(response: Response): Promise<number[]> {
    const body: Vertex.Response = await response.json();
    const embeddings: number[][] = body.predictions.map((prediction: Vertex.Prediction) => {
      if ("embeddings" in prediction) {
        return prediction.embeddings?.values ?? [];
      } else if ("textEmbedding" in prediction) {
        return prediction.textEmbedding ?? [];
      } else if ("imageEmbedding" in prediction) {
        return prediction.imageEmbedding ?? [];
      } else if ("videoEmbedding" in prediction) {
        const videoEmbeddings = (prediction as Vertex.VideoEmbeddings).videoEmbeddings;
        const videoEmbedding = videoEmbeddings?.[0];
        return videoEmbedding?.embedding ?? [];
      } else {
        return [];
      }
    })
    return embeddings[0] ?? [];
  }

  protected async _convertResponseToValues(response: Response): Promise<number[]> {
    switch (this.platform) {
      case "gai":
        return this._convertResponseToValuesAIStudio(response);
      case "gcp":
        return this._convertResponseToValuesVertex(response);
      default:
        throw new Error(
          `Unknown platform when converting response: ${this.platform}`
        )
    }
  }

  protected async _process(documents: ContentBlock.Standard[]): Promise<TOutput | undefined> {
    const url = await this.buildUrl();
    const body = this._convertDocumentsToBody(documents);
    console.log(JSON.stringify(body,null,1));
    const request = new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const response: Response = await this.apiClient.fetch(request);
    if (!response.ok) {
      const error = await RequestError.fromResponse(response);
      throw error;
    }
    return await this._convertResponseToValues(response) as TOutput;
  }

  async embedContent(document: ContentBlock.Standard): Promise<TOutput | undefined> {
    return this._process([document]);
  }
}

export function getGoogleEmbeddingsParams<
  TParams extends BaseGoogleEmbeddingsParams
>(
  modelOrParams: string | TParams,
  paramsArg?: Omit<TParams, "model">
): TParams {
  const model =
    typeof modelOrParams === "string" ? modelOrParams : modelOrParams.model;
  const params = typeof modelOrParams === "string" ? paramsArg : modelOrParams;
  return {model, ...params} as TParams;
}
