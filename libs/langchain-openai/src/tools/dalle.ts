/* eslint-disable no-param-reassign */
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { OpenAI as OpenAIClient } from "openai";
import { Tool, ToolParams } from "@langchain/core/tools";
import {
  MessageContentComplex,
  MessageContentImageUrl,
} from "@langchain/core/messages";

/**
 * An interface for the Dall-E API Wrapper.
 */
export interface DallEAPIWrapperParams extends ToolParams {
  /**
   * The OpenAI API key
   * Alias for `apiKey`
   */
  openAIApiKey?: string;
  /**
   * The OpenAI API key
   */
  apiKey?: string;
  /**
   * The model to use.
   * Alias for `model`
   * @params "dall-e-2" | "dall-e-3"
   * @default "dall-e-3"
   */
  modelName?: string;
  /**
   * The model to use.
   * @params "dall-e-2" | "dall-e-3"
   * @default "dall-e-3"
   */
  model?: string;
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
  dallEResponseFormat?: "url" | "b64_json";
  /**
   * @deprecated Use dallEResponseFormat instead for the Dall-E response type.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseFormat?: any;
  /**
   * A unique identifier representing your end-user, which will help
   * OpenAI to monitor and detect abuse.
   */
  user?: string;
  /**
   * The organization to use
   */
  organization?: string;
  /**
   * The base URL of the OpenAI API.
   */
  baseUrl?: string;
}

/**
 * A tool for generating images with Open AIs Dall-E 2 or 3 API.
 */
export class DallEAPIWrapper extends Tool {
  static lc_name() {
    return "DallEAPIWrapper";
  }

  name = "dalle_api_wrapper";

  description =
    "A wrapper around OpenAI DALL-E API. Useful for when you need to generate images from a text description. Input should be an image description.";

  protected client: OpenAIClient;

  static readonly toolName = "dalle_api_wrapper";

  private model = "dall-e-3";

  private style: "natural" | "vivid" = "vivid";

  private quality: "standard" | "hd" = "standard";

  private n = 1;

  private size:
    | "256x256"
    | "512x512"
    | "1024x1024"
    | "1792x1024"
    | "1024x1792" = "1024x1024";

  private dallEResponseFormat: "url" | "b64_json" = "url";

  private user?: string;

  constructor(fields?: DallEAPIWrapperParams) {
    // Shim for new base tool param name
    if (
      fields?.responseFormat !== undefined &&
      ["url", "b64_json"].includes(fields.responseFormat)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields.dallEResponseFormat = fields.responseFormat as any;
      fields.responseFormat = "content";
    }
    super(fields);
    const openAIApiKey =
      fields?.apiKey ??
      fields?.openAIApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");

    const organization =
      fields?.organization ?? getEnvironmentVariable("OPENAI_ORGANIZATION");

    const clientConfig = {
      apiKey: openAIApiKey,
      organization,
      dangerouslyAllowBrowser: true,
      baseURL: fields?.baseUrl,
    };
    this.client = new OpenAIClient(clientConfig);
    this.model = fields?.model ?? fields?.modelName ?? this.model;
    this.style = fields?.style ?? this.style;
    this.quality = fields?.quality ?? this.quality;
    this.n = fields?.n ?? this.n;
    this.size = fields?.size ?? this.size;
    this.dallEResponseFormat =
      fields?.dallEResponseFormat ?? this.dallEResponseFormat;
    this.user = fields?.user;
  }

  /**
   * Processes the API response if multiple images are generated.
   * Returns a list of MessageContentImageUrl objects. If the response
   * format is `url`, then the `image_url` field will contain the URL.
   * If it is `b64_json`, then the `image_url` field will contain an object
   * with a `url` field with the base64 encoded image.
   *
   * @param {OpenAIClient.Images.ImagesResponse[]} response The API response
   * @returns {MessageContentImageUrl[]}
   */
  private processMultipleGeneratedUrls(
    response: OpenAIClient.Images.ImagesResponse[]
  ): MessageContentImageUrl[] {
    if (this.dallEResponseFormat === "url") {
      return response.flatMap((res) => {
        const imageUrlContent =
          res.data
            ?.flatMap((item) => {
              if (!item.url) return [];
              return {
                type: "image_url" as const,
                image_url: item.url,
              };
            })
            .filter(
              (item) =>
                item !== undefined &&
                item.type === "image_url" &&
                typeof item.image_url === "string" &&
                item.image_url !== undefined
            ) ?? [];
        return imageUrlContent;
      });
    } else {
      return response.flatMap((res) => {
        const b64Content =
          res.data
            ?.flatMap((item) => {
              if (!item.b64_json) return [];
              return {
                type: "image_url" as const,
                image_url: {
                  url: item.b64_json,
                },
              };
            })
            .filter(
              (item) =>
                item !== undefined &&
                item.type === "image_url" &&
                typeof item.image_url === "object" &&
                "url" in item.image_url &&
                typeof item.image_url.url === "string" &&
                item.image_url.url !== undefined
            ) ?? [];
        return b64Content;
      });
    }
  }

  /** @ignore */
  async _call(input: string): Promise<string | MessageContentComplex[]> {
    const generateImageFields = {
      model: this.model,
      prompt: input,
      n: 1,
      size: this.size,
      response_format: this.dallEResponseFormat,
      style: this.style,
      quality: this.quality,
      user: this.user,
    };

    if (this.n > 1) {
      const results = await Promise.all(
        Array.from({ length: this.n }).map(() =>
          this.client.images.generate(generateImageFields)
        )
      );

      return this.processMultipleGeneratedUrls(results);
    }

    const response = await this.client.images.generate(generateImageFields);

    let data = "";
    if (this.dallEResponseFormat === "url") {
      [data] =
        response.data
          ?.map((item) => item.url)
          .filter((url): url is string => url !== "undefined") ?? [];
    } else {
      [data] =
        response.data
          ?.map((item) => item.b64_json)
          .filter((b64_json): b64_json is string => b64_json !== "undefined") ??
        [];
    }
    return data;
  }
}
