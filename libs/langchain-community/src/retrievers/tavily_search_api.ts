import { Document } from "@langchain/core/documents";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Options for the TavilySearchAPIRetriever class, which includes a BaseLanguageModel
 * instance, a VectorStore instance, and an optional promptTemplate which
 * can either be a BasePromptTemplate instance or a PromptKey.
 */
export type TavilySearchAPIRetrieverFields = BaseRetrieverInput & {
  k?: number;
  includeGeneratedAnswer?: boolean;
  includeRawContent?: boolean;
  includeImages?: boolean;
  searchDepth?: "basic" | "advanced";
  includeDomains?: string[];
  excludeDomains?: string[];
  kwargs?: Record<string, unknown>;
  apiKey?: string;
};

/**
 * A class for retrieving documents related to a given search term
 * using the Tavily Search API.
 */
export class TavilySearchAPIRetriever extends BaseRetriever {
  static lc_name() {
    return "TavilySearchAPIRetriever";
  }

  get lc_namespace(): string[] {
    return ["langchain", "retrievers", "tavily_search_api"];
  }

  k = 10;

  includeGeneratedAnswer = false;

  includeRawContent = false;

  includeImages = false;

  searchDepth = "basic";

  includeDomains?: string[];

  excludeDomains?: string[];

  kwargs: Record<string, unknown> = {};

  apiKey?: string;

  constructor(fields?: TavilySearchAPIRetrieverFields) {
    super(fields);
    this.k = fields?.k ?? this.k;
    this.includeGeneratedAnswer =
      fields?.includeGeneratedAnswer ?? this.includeGeneratedAnswer;
    this.includeRawContent =
      fields?.includeRawContent ?? this.includeRawContent;
    this.includeImages = fields?.includeImages ?? this.includeImages;
    this.searchDepth = fields?.searchDepth ?? this.searchDepth;
    this.includeDomains = fields?.includeDomains ?? this.includeDomains;
    this.excludeDomains = fields?.excludeDomains ?? this.excludeDomains;
    this.kwargs = fields?.kwargs ?? this.kwargs;
    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("TAVILY_API_KEY");
    if (this.apiKey === undefined) {
      throw new Error(
        `No Tavily API key found. Either set an environment variable named "TAVILY_API_KEY" or pass an API key as "apiKey".`
      );
    }
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const body: Record<string, unknown> = {
      query,
      include_answer: this.includeGeneratedAnswer,
      include_raw_content: this.includeRawContent,
      include_images: this.includeImages,
      max_results: this.k,
      search_depth: this.searchDepth,
      api_key: this.apiKey,
    };
    if (this.includeDomains) {
      body.include_domains = this.includeDomains;
    }
    if (this.excludeDomains) {
      body.exclude_domains = this.excludeDomains;
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, ...this.kwargs }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(
        `Request failed with status code ${response.status}: ${json.error}`
      );
    }
    if (!Array.isArray(json.results)) {
      throw new Error(`Could not parse Tavily results. Please try again.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs: Document[] = json.results.map((result: any) => {
      const pageContent = this.includeRawContent
        ? result.raw_content
        : result.content;
      const metadata = {
        title: result.title,
        source: result.url,
        ...Object.fromEntries(
          Object.entries(result).filter(
            ([k]) => !["content", "title", "url", "raw_content"].includes(k)
          )
        ),
        images: json.images,
      };
      return new Document({ pageContent, metadata });
    });
    if (this.includeGeneratedAnswer) {
      docs.push(
        new Document({
          pageContent: json.answer,
          metadata: {
            title: "Suggested Answer",
            source: "https://tavily.com/",
          },
        })
      );
    }
    return docs;
  }
}
