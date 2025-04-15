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

export class TavilyExtract extends StructuredTool {
  static lc_name() {
    return "tavily_extract";
  }

  name: "tavily_extract";

  description =
    "Extracts comprehensive content from web pages based on provided URLs. " +
    "This tool retrieves raw text of a web page, with an option to include images. " +
    "It supports two extraction depths: 'basic' for standard text extraction and " +
    "'advanced' for a more comprehensive extraction with higher success rate. " +
    "Ideal for use cases such as content curation, data ingestion for NLP models, " +
    "and automated information retrieval, this endpoint seamlessly integrates into " +
    "your content processing pipeline. Input should be a list of one or more URLs.";

  schema = z.object({
    urls: z.array(z.string()).describe("List of URLs to extract"),
    extractDepth: z
      .enum(["basic", "advanced"])
      .default("basic")
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
      .default(false)
      .describe(
        `Determines whether to extract and include images from the source URLs.
      
      Set to True when visualizations are needed for better context or understanding.
      
      Default is False (extracts text content only).`
      ),
  });

  extractDepthDefault: ExtractDepth;

  includeImagesDefault: boolean;

  private apiWrapper: TavilyExtractAPIWrapper;

  constructor(params: TavilyExtractAPIRetrieverFields = {}) {
    super(params);

    if (params.tavilyApiKey) {
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
    input: z.infer<(typeof this)["schema"]>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<TavilyExtractResponse | { error: string }> {
    try {
      const {
        urls,
        extractDepth = this.extractDepthDefault,
        includeImages = this.includeImagesDefault,
      } = input;

      const rawResults = await this.apiWrapper.rawResults({
        urls,
        extractDepth,
        includeImages,
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
          extractDepth,
          includeImages,
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
