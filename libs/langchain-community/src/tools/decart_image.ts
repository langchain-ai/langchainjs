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
   */
  baseUrl?: string;
  /**
   * Default resolution for generated images.
   * @default "720p"
   */
  resolution?: "480p" | "720p";
  /**
   * Default orientation for generated images.
   */
  orientation?: "landscape" | "portrait";
  /**
   * Whether to enhance prompts by default.
   * @default true
   */
  enhancePrompt?: boolean;
}

async function importDecartSDK() {
  try {
    const { createDecartClient, models } = await import("@decartai/sdk");
    return { createDecartClient, models };
  } catch (e) {
    throw new Error(
      "Failed to load @decartai/sdk. Please install it with: npm install @decartai/sdk"
    );
  }
}

/**
 * Decart AI image generation tool.
 *
 * Setup:
 * Install `@langchain/community` and `@decartai/sdk`.
 *
 * ```bash
 * npm install @langchain/community @decartai/sdk
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

  private baseUrl?: string;

  private resolution: "480p" | "720p";

  private orientation?: "landscape" | "portrait";

  private enhancePrompt: boolean;

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
    this.baseUrl = params?.baseUrl;
    this.resolution = params?.resolution ?? "720p";
    this.orientation = params?.orientation;
    this.enhancePrompt = params?.enhancePrompt ?? true;
  }

  async _call(input: string): Promise<string> {
    const { createDecartClient, models } = await importDecartSDK();

    const client = createDecartClient({
      apiKey: this.apiKey,
      ...(this.baseUrl && { baseUrl: this.baseUrl }),
    });

    const result = await client.process({
      model: models.image("lucy-pro-t2i"),
      prompt: input,
      resolution: this.resolution,
      ...(this.orientation && { orientation: this.orientation }),
      enhance_prompt: this.enhancePrompt,
    });

    // Convert Blob to base64 data URL
    const arrayBuffer = await result.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = result.type || "image/png";

    return `data:${mimeType};base64,${base64}`;
  }
}
