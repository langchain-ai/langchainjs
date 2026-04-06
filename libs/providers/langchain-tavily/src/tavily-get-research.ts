import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { z } from "zod/v3";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import {
  TavilyResearchAPIWrapper,
  type TavilyGetIncompleteResearchResponse,
  type TavilyGetResearchResponse,
} from "./utils.js";

export type TavilyGetResearchAPIRetrieverFields = ToolParams & {
  /**
   * The base URL to be used for the Tavily Research API.
   */
  apiBaseUrl?: string;

  /**
   * The API key used for authentication with the Tavily Research API.
   */
  tavilyApiKey?: string;

  /**
   * The name of the tool.
   *
   * @default "tavily_get_research"
   */
  name?: string;

  /**
   * The description of the tool.
   *
   * @default "Retrieves the results of a research task by its request_id. Use this tool after creating a research task to get the completed research report, including the content, sources, and status. Input should be a request_id from a previously created research task."
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
   * An API wrapper that can be used to interact with the Tavily Research API. Useful for testing.
   *
   * If specified, the tool will use this API wrapper instead of creating a new one, and fields used
   * in API Wrapper initialization, like {@link TavilyGetResearchAPIRetrieverFields.tavilyApiKey}, will be
   * ignored.
   */
  apiWrapper?: TavilyResearchAPIWrapper;
};

const inputSchema = z.object({
  requestId: z.string().describe("The unique identifier of the research task."),
});

/**
 * A Tool for retrieving research results by request_id from the Tavily Research API.
 * Extends the StructuredTool class and allows you to check the status and retrieve
 * results of a research task that was previously created.
 *
 * Authentication is handled via an API key, which can be passed during
 * instantiation or set as an environment variable `TAVILY_API_KEY`.
 *
 * Example:
 * ```typescript
 * const tool = new TavilyGetResearch({
 *   tavilyApiKey: "YOUR_API_KEY"
 * });
 * const results = await tool.invoke({
 *   requestId: "abc123-def456-ghi789"
 * });
 * console.log(results);
 * ```
 */
export class TavilyGetResearch extends StructuredTool<typeof inputSchema> {
  static lc_name(): string {
    return "TavilyGetResearch";
  }

  override description: string =
    "Retrieves the results of a research task by its request_id. " +
    "Use this tool after creating a research task to get the completed research report, " +
    "including the content, sources, and status. Input should be a request_id from a " +
    "previously created research task.";

  override name: string = "tavily_get_research";

  override schema = inputSchema;

  apiBaseUrl?: string;

  private apiWrapper: TavilyResearchAPIWrapper;

  constructor(params: TavilyGetResearchAPIRetrieverFields = {}) {
    super(params);

    if (typeof params.name === "string") {
      this.name = params.name;
    }

    if (typeof params.description === "string") {
      this.description = params.description;
    }

    if (params.apiWrapper) {
      this.apiWrapper = params.apiWrapper;
    } else {
      const apiWrapperParams: { tavilyApiKey?: string; apiBaseUrl?: string } =
        {};
      if (params.tavilyApiKey) {
        apiWrapperParams.tavilyApiKey = params.tavilyApiKey;
      }
      if (params.apiBaseUrl) {
        apiWrapperParams.apiBaseUrl = params.apiBaseUrl;
      }
      this.apiWrapper = new TavilyResearchAPIWrapper(apiWrapperParams);
    }
  }

  async _call(
    input: InferInteropZodOutput<typeof inputSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<
    | TavilyGetResearchResponse
    | TavilyGetIncompleteResearchResponse
    | { error: string }
  > {
    try {
      const { requestId } = input;

      const result:
        | TavilyGetResearchResponse
        | TavilyGetIncompleteResearchResponse =
        await this.apiWrapper.getResearch(requestId);

      if (
        !result ||
        typeof result !== "object" ||
        !("request_id" in result) ||
        !("status" in result)
      ) {
        const errorMessage =
          `Invalid research response for request_id '${requestId}'. ` +
          `Please verify the request_id is correct.`;

        throw new Error(errorMessage);
      }

      return result;
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "message" in e ? e.message : String(e);
      return { error: errorMessage as string };
    }
  }
}
