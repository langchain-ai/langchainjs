import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool, type ToolParams } from "@langchain/core/tools";

/**
 * Parameters for the DecartImageGeneration tool.
 */
export interface DecartImageGenerationParams extends ToolParams {
  /**
   * Decart API key. If not provided, will use DECART_API_KEY env variable.
   */
  apiKey?: string;
  /**
   * Base URL for Decart API. Optional.
   * @default "https://api.decart.ai"
   */
  baseUrl?: string;
  /**
   * Orientation for generated images.
   * @default "landscape"
   */
  orientation?: "landscape" | "portrait";
}

const DEFAULT_BASE_URL = "https://api.decart.ai";

/**
 * Decart AI image generation tool.
 *
 * Setup:
 * Install `@langchain/community`.
 *
 * ```bash
 * npm install @langchain/community
 * ```
 *
 * Set your API key:
 * ```bash
 * export DECART_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_community.tools_decart_image.DecartImageGeneration.html#constructor)
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { DecartImageGeneration } from "@langchain/community/tools/decart_image";
 *
 * const tool = new DecartImageGeneration();
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 *
 * <summary><strong>Invocation</strong></summary>
 *
 * ```typescript
 * const imageDataUrl = await tool.invoke("A sunset over mountains");
 * // Returns: "data:image/png;base64,..."
 * ```
 * </details>
 */
export class DecartImageGeneration extends Tool {
  static lc_name() {
    return "DecartImageGeneration";
  }

  get lc_namespace(): string[] {
    return [...super.lc_namespace, "decart_image"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "DECART_API_KEY",
    };
  }

  private apiKey: string;

  private baseUrl: string;

  private orientation: "landscape" | "portrait";

  name = "decart_image_generation";

  description =
    "Generate images from text descriptions using Decart AI. Input should be a text prompt describing the image to generate. Returns a base64-encoded PNG image as a data URL.";

  constructor(params?: DecartImageGenerationParams) {
    super(params ?? {});

    const apiKey = params?.apiKey ?? getEnvironmentVariable("DECART_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Decart API key is required. Set DECART_API_KEY environment variable or pass apiKey in constructor."
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = params?.baseUrl ?? DEFAULT_BASE_URL;
    this.orientation = params?.orientation ?? "landscape";
  }

  async _call(input: string): Promise<string> {
    const url = `${this.baseUrl}/v1/generate/lucy-pro-t2i`;

    const formData = new FormData();
    formData.append("prompt", input);
    formData.append("orientation", this.orientation);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Decart API error (${response.status}): ${errorText}`
      );
    }

    // Response is binary image data
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";

    return `data:${contentType};base64,${base64}`;
  }
}
