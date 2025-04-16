import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { z } from "zod";
import {
  TavilyExtractAPIWrapper,
  type TavilyExtractResponse,
} from "./utils.js";

export type ExtractDepth = "basic" | "advanced";

export interface TavilyExtractInput {
  urls: string[];
  extractDepth?: ExtractDepth;
  includeImages?: boolean;
}

export type TavilyExtractAPIRetrieverFields = ToolParams & {
  /**
   * The API key used for authentication with the Tavily Search API.
   *
   */
  tavilyApiKey?: string;

  /**
   * The depth of the extract. It can be "basic" or "advanced".
   *
   */
  extractDepth?: ExtractDepth;

  /**
   * Include a list of query-related images in the response.
   *
   * @default false
   */
  includeImages?: boolean;

  /**
   * The name of the tool.
   *
   * @default "tavily_extract"
   */
  name?: string;

  /**
   * The description of the tool.
   *
   * @default "Extracts comprehensive content from web pages based on provided URLs. Useful for when you need to answer questions about current events. Input should be a list of one or more URLs."
   */
  description?: string;
  /**
   * Whether to return the tool's output directly.
   *
   * Setting this to true means that after the tool is called,
   * an agent should stop looping.
   *
   * @default false
   */
  returnDirect?: boolean;

  /**
   * An API wrapper that can be used to interact with the Tavily Extract API. Useful for testing.
   *
   * If specified, the tool will use this API wrapper instead of creating a new one, and fields used
   * in API Wrapper initialization, like {@link TavilyExtractAPIRetrieverFields.tavilyApiKey}, will be
   * ignored.
   */
  apiWrapper?: TavilyExtractAPIWrapper;
};

function generateSuggestions(params: Record<string, unknown>): string[] {
  const suggestions: string[] = [];

  const { extractDepth } = params;

  if (extractDepth === "basic") {
    suggestions.push(
      "Try a more detailed extraction using 'advanced' extractDepth"
    );
  }

  return suggestions;
}

const inputSchema = z.object({
  urls: z.array(z.string()).describe("List of URLs to extract"),
  extractDepth: z
    .enum(["basic", "advanced"])
    .optional()
    .describe(
      `Controls the thoroughness of web content extraction.

Use "basic" for faster extraction of main text content.

Use "advanced" (default) to retrieve comprehensive content including 
tables and embedded elements. Always use "advanced" for LinkedIn 
and YouTube URLs for optimal results.

Better for complex websites but may increase response time.`
    ),
  includeImages: z
    .boolean()
    .optional()
    .describe(
      `Determines whether to extract and include images from the source URLs.

Set to True when visualizations are needed for better context or understanding.

Default is False (extracts text content only).`
    ),
});

export class TavilyExtract extends StructuredTool<typeof inputSchema> {
  static lc_name() {
    return "tavily_extract";
  }

  override name: string = "tavily_extract";

  override description: string =
    "Extracts comprehensive content from web pages based on provided URLs. " +
    "This tool retrieves raw text of a web page, with an option to include images. " +
    "It supports two extraction depths: 'basic' for standard text extraction and " +
    "'advanced' for a more comprehensive extraction with higher success rate. " +
    "Ideal for use cases such as content curation, data ingestion for NLP models, " +
    "and automated information retrieval, this endpoint seamlessly integrates into " +
    "your content processing pipeline. Input should be a list of one or more URLs.";

  override schema = inputSchema;

  extractDepthDefault: ExtractDepth;

  includeImagesDefault: boolean;

  private apiWrapper: TavilyExtractAPIWrapper;

  constructor(params: TavilyExtractAPIRetrieverFields = {}) {
    super(params);

    if (typeof params.name === "string") {
      this.name = params.name;
    }

    if (typeof params.description === "string") {
      this.description = params.description;
    }

    if (params.apiWrapper) {
      this.apiWrapper = params.apiWrapper;
    } else if (params.tavilyApiKey) {
      this.apiWrapper = new TavilyExtractAPIWrapper({
        tavilyApiKey: params.tavilyApiKey,
      });
    } else {
      this.apiWrapper = new TavilyExtractAPIWrapper({});
    }

    this.extractDepthDefault = params.extractDepth ?? "basic";
    this.includeImagesDefault = params.includeImages ?? false;
  }

  async _call(
    input: z.infer<typeof inputSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<TavilyExtractResponse | { error: string }> {
    try {
      const { urls, extractDepth, includeImages } = input;

      const effectiveExtractDepth = extractDepth ?? this.extractDepthDefault;
      const effectiveIncludeImages = includeImages ?? this.includeImagesDefault;

      const rawResults = await this.apiWrapper.rawResults({
        urls,
        extractDepth: effectiveExtractDepth,
        includeImages: effectiveIncludeImages,
      });

      if (
        !rawResults ||
        typeof rawResults !== "object" ||
        !("results" in rawResults) ||
        !Array.isArray(rawResults.results) ||
        rawResults.results.length === 0 ||
        (rawResults.failed_results &&
          Array.isArray(rawResults.failed_results) &&
          rawResults.failed_results.length === urls.length)
      ) {
        const searchParams = {
          extractDepth: effectiveExtractDepth,
          includeImages: effectiveIncludeImages,
        };
        const suggestions = generateSuggestions(searchParams);

        const errorMessage =
          `No extracted results found for '${urls.join(", ")}'. ` +
          `Suggestions: ${suggestions.join(", ")}. ` +
          `Try modifying your extract parameters with one of these approaches.`;

        throw new Error(errorMessage);
      }

      return rawResults;
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "message" in e ? e.message : String(e);

      return { error: errorMessage as string };
    }
  }
}
