import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool, ToolParams } from "@langchain/core/tools";

const TEXT2IMG_URL = "https://modelslab.com/api/v6/images/text2img";
const FETCH_BASE_URL = "https://modelslab.com/api/v6/images/fetch";
const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 5000;

/**
 * Parameters for the ModelsLab text-to-image tool.
 */
export interface ModelsLabTextToImageParams extends ToolParams {
  /**
   * ModelsLab API key.
   * Defaults to the MODELSLAB_API_KEY environment variable.
   */
  apiKey?: string;
  /**
   * Model ID to use for image generation.
   * @default "flux"
   */
  modelId?: string;
  /**
   * Width of the generated image in pixels (256–1024, divisible by 8).
   * @default 512
   */
  width?: number;
  /**
   * Height of the generated image in pixels (256–1024, divisible by 8).
   * @default 512
   */
  height?: number;
  /**
   * Number of images to generate (1–4).
   * @default 1
   */
  samples?: number;
}

/**
 * A tool for generating images from text prompts using the ModelsLab API.
 *
 * ModelsLab (https://modelslab.com) supports Flux, SDXL, Stable Diffusion,
 * and 50k+ community models. Returns a comma-separated list of image URLs.
 *
 * @example
 * ```typescript
 * import { ModelsLabTextToImage } from "@langchain/community/tools/modelslab";
 *
 * const tool = new ModelsLabTextToImage({
 *   apiKey: process.env.MODELSLAB_API_KEY,
 *   modelId: "flux",
 * });
 *
 * const result = await tool.invoke("a serene mountain landscape at sunset");
 * console.log(result); // https://cdn.modelslab.com/...
 * ```
 */
export class ModelsLabTextToImage extends Tool {
  static lc_name() {
    return "ModelsLabTextToImage";
  }

  name = "modelslab_text_to_image";

  description =
    "Generate an image from a text prompt using ModelsLab AI. " +
    "Input should be a detailed description of the image to generate. " +
    "Returns a URL to the generated image.";

  protected apiKey: string;

  protected modelId: string;

  protected width: number;

  protected height: number;

  protected samples: number;

  constructor(fields: ModelsLabTextToImageParams = {}) {
    super(fields);

    const apiKey =
      fields.apiKey ?? getEnvironmentVariable("MODELSLAB_API_KEY");

    if (!apiKey) {
      throw new Error(
        "ModelsLab API key not set. Pass it in or set the MODELSLAB_API_KEY environment variable. " +
          "Get your key at https://modelslab.com/account/api-key"
      );
    }

    this.apiKey = apiKey;
    this.modelId = fields.modelId ?? "flux";
    this.width = fields.width ?? 512;
    this.height = fields.height ?? 512;
    this.samples = Math.min(Math.max(fields.samples ?? 1, 1), 4);
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    const body = {
      key: this.apiKey,
      model_id: this.modelId,
      prompt: input,
      negative_prompt:
        "low quality, blurry, watermark, text, nsfw, deformed",
      width: this.width,
      height: this.height,
      samples: this.samples,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      seed: -1,
      safety_checker: "yes",
    };

    const response = await fetch(TEXT2IMG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `ModelsLab API request failed with status ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      status: string;
      output?: string[];
      id?: string;
      messege?: string;
    };

    if (data.status === "error") {
      throw new Error(`ModelsLab API error: ${data.messege ?? "Unknown error"}`);
    }

    // Handle async generation
    if (data.status === "processing" && data.id) {
      const urls = await this._pollForResult(data.id);
      return urls.join(", ");
    }

    return (data.output ?? []).join(", ");
  }

  protected async _pollForResult(requestId: string): Promise<string[]> {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const response = await fetch(`${FETCH_BASE_URL}/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: this.apiKey }),
      });

      if (!response.ok) continue;

      const data = (await response.json()) as {
        status: string;
        output?: string[];
        messege?: string;
      };

      if (data.status === "success" && data.output) {
        return data.output;
      }

      if (data.status === "error") {
        throw new Error(
          `ModelsLab generation failed: ${data.messege ?? "Unknown error"}`
        );
      }
    }

    throw new Error("ModelsLab image generation timed out.");
  }
}
