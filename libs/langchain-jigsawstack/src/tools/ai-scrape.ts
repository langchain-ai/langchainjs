import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;

export type ScrapeInputParams = Omit<
  Parameters<JigsawStackType["web"]["ai_scrape"]>["0"],
  "url"
>;

export type ScrapeOutputParams = Awaited<
  ReturnType<JigsawStackType["web"]["ai_scrape"]>
>;

export interface JigsawStackAIScrapeParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  params: ScrapeInputParams;
}

export class JigsawStackAIScrape extends Tool {
  client: JigsawStackType;
  params: ScrapeInputParams;

  static lc_name(): string {
    return "JigsawStackAIScrape";
  }

  description =
    "A wrapper around JigsawStack AI scrape. Output is a JSON object of the result";

  name = "jigsawstack_ai_scrape_result_json";

  constructor(fields: JigsawStackAIScrapeParams) {
    super(fields);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");
    if (!apiKey) {
      throw new Error("JIGSAWSTACK_API_KEY is required.");
    }

    const _params = fields?.params;
    if (!_params) {
      throw new Error("params is required.");
    }

    this.client = JigsawStack({
      apiKey,
    });

    this.params = _params;
  }

  protected async _call(
    url: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const _params = {
      ...this.params,
      url,
    };
    const output: ScrapeOutputParams = await this.client.web.ai_scrape(_params);
    return JSON.stringify(output);
  }
}
