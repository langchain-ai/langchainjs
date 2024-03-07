import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { OpenAI as OpenAIClient } from "openai";
import { Tool, ToolParams } from "@langchain/core/tools";

/**
 * An interface for the Dall-E API Wrapper.
 */
export interface DallEAPIWrapperParams extends ToolParams {
  /**
   * The OpenAI API key
   */
  openAIApiKey?: string;
  /**
   * The model to use.
   * @params "dall-e-2" | "dall-e-3"
   * @default "dall-e-3"
   */
  modelName?: string;
  /**
   * The style of the generated images. Must be one of vivid or natural.
   * Vivid causes the model to lean towards generating hyper-real and dramatic images.
   * Natural causes the model to produce more natural, less hyper-real looking images.
   * @default "vivid"
   */
  style?: "natural" | "vivid";
  /**
   * The quality of the image that will be generated. ‘hd’ creates images with finer
   * details and greater consistency across the image.
   * @default "standard"
   */
  quality?: "standard" | "hd";
  /**
   * The number of images to generate.
   * Must be between 1 and 10.
   * For dall-e-3, only `n: 1` is supported.
   * @default 1
   */
  n?: number;
  /**
   * The size of the generated images.
   * Must be one of 256x256, 512x512, or 1024x1024 for DALL·E-2 models.
   * Must be one of 1024x1024, 1792x1024, or 1024x1792 for DALL·E-3 models.
   * @default "1024x1024"
   */
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  /**
   * The format in which the generated images are returned.
   * Must be one of "url" or "b64_json".
   * @default "url"
   */
  responseFormat?: "url" | "b64_json";
  /**
   * A unique identifier representing your end-user, which will help
   * OpenAI to monitor and detect abuse.
   */
  user?: string;
  /**
   * The organization to use
   */
  organization?: string;
}

/**
 * A tool for generating images with Open AIs Dall-E 2 or 3 API.
 */
export class DallEAPIWrapper extends Tool {
  static lc_name() {
    return "DallEAPIWrapper";
  }

  name = "dalle_api_wrapper";

  description = `Dall-E tool. Useful for generating images with Open AIs Dall-E API.`;

  protected client: OpenAIClient;

  static readonly toolName = "dalle_api_wrapper";

  private modelName = "dall-e-3";

  private style: "natural" | "vivid" = "vivid";

  private quality: "standard" | "hd" = "standard";

  private n = 1;

  private size:
    | "256x256"
    | "512x512"
    | "1024x1024"
    | "1792x1024"
    | "1024x1792" = "1024x1024";

  private responseFormat: "url" | "b64_json" = "url";

  private user?: string;

  constructor(fields?: DallEAPIWrapperParams) {
    super(fields);
    const openAIApiKey =
      fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");

    const organization =
      fields?.organization ?? getEnvironmentVariable("OPENAI_ORGANIZATION");

    const clientConfig = {
      apiKey: openAIApiKey,
      organization,
      dangerouslyAllowBrowser: true,
    };
    this.client = new OpenAIClient(clientConfig);
    this.modelName = fields?.modelName ?? this.modelName;
    this.style = fields?.style ?? this.style;
    this.quality = fields?.quality ?? this.quality;
    this.n = fields?.n ?? this.n;
    this.size = fields?.size ?? this.size;
    this.responseFormat = fields?.responseFormat ?? this.responseFormat;
    this.user = fields?.user;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    const response = await this.client.images.generate({
      model: this.modelName,
      prompt: input,
      n: this.n,
      size: this.size,
      response_format: this.responseFormat,
      style: this.style,
      quality: this.quality,
      user: this.user,
    });

    let data = "";
    if (this.responseFormat === "url") {
      [data] = response.data
        .map((item) => item.url)
        .filter((url): url is string => url !== "undefined");
    } else {
      [data] = response.data
        .map((item) => item.b64_json)
        .filter((b64_json): b64_json is string => b64_json !== "undefined");
    }

    return data;
  }
}
