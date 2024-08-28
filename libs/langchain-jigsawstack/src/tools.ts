import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";

interface ScrapeParams {
  element_prompts: string[];
  url: string;
  elements?: Array<{
    selector: string;
  }>;
  http_headers?: object;
  reject_request_pattern?: string[];
  goto_options?: {
    timeout: number;
    wait_until: string;
  };
  wait_for?: {
    mode: string;
    value: string | number;
  };
  advance_config?: {
    console: boolean;
    network: boolean;
    cookies: boolean;
  };
  size_preset?: string;
  is_mobile?: boolean;
  scale?: number;
  width?: number;
  height?: number;
  cookies?: Array<object>;
}

export type JigsawStackArgs = ToolParams & {
  client: any;
};

export class JigsawStackVOCR extends Tool {
  static lc_name(): string {
    return "JigsawStackVOCRResults";
  }

  description =
    "A wrapper around JigsawStack VOCR. Output is a JSON object of the results";

  name = "jigsawstack_vocr_results_json";

  private client: any;

  constructor(fields: JigsawStackArgs) {
    super(fields);
    this.client = fields.client;
  }

  protected async _call(
    params: {
      prompt: string | string[];
      url: string;
    },
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const result = await this.client.vision.vocr(params);
    return JSON.stringify(result);
  }
}

export class JigsawStackAIScrape extends Tool {
  static lc_name(): string {
    return "JigsawStackAIScrape";
  }

  description =
    "A wrapper around JigsawStack AI scrape. Output is a object of the results";

  name = "jigsawstack_ai_scrape_result_json";

  private client: any;

  constructor(fields: JigsawStackArgs) {
    super(fields);
    this.client = fields.client;
  }

  protected async _call(
    params: ScrapeParams,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return JSON.stringify(await this.client.web.ai_scrape(params));
  }
}
