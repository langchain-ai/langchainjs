import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;

export type AISearchInputParams = Omit<
  Parameters<JigsawStackType["web"]["search"]>["0"],
  "query"
>;

export type AISearchOutputParams = Awaited<
  ReturnType<JigsawStackType["web"]["search"]>
>;

export interface JigsawStackAISearchParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  /**
   * AI Search input parameters.
   */
  params: AISearchInputParams;
}

/**
 * A tool that leverages the JigsawStack Search API for AI-driven web search.
 *
 * This tool enables you to perform web searches and retrieve high-quality results powered by AI.
 *
 * To use this tool, ensure that the `JIGSAWSTACK_API_KEY` environment variable is set.
 * You can create a free API key at [JigsawStack](https://jigsawstack.com).
 *
 * @example
 * ```typescript
 * const tool = new JigsawStackAISearch();
 * const res = await tool.invoke("The leaning tower of Pisa");
 * console.log({ res });
 * ```
 */

export class JigsawStackAISearch extends Tool {
  client: JigsawStackType;

  static lc_name(): string {
    return "JigsawStackAISearch";
  }

  description = "A wrapper around JigsawStack AI Search";

  name = "jigsawstack_ai_search";

  params?: AISearchInputParams;

  constructor(fields: JigsawStackAISearchParams) {
    super(fields);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Please set the JIGSAWSTACK_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
    }

    this.client = JigsawStack({
      apiKey,
    });
    this.params = fields?.params ?? {};
  }

  protected async _call(
    query: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const payload = {
      query,
      ...this.params,
    };

    return JSON.stringify(await this.client.web.search(payload));
  }
}
