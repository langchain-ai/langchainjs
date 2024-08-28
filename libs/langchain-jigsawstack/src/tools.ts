import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

interface ScrapeOptions {
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

interface VocrOptions {
  prompt: string | string[];
}

export interface JigsawStackVocrParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  params: VocrOptions;
}

export interface JigsawStackAIScrapeParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  params: Omit<ScrapeOptions, "url">;
}

export class JigsawStackVOCR extends Tool {
  client: any;
  static lc_name(): string {
    return "JigsawStackVOCRResults";
  }

  description =
    "A wrapper around JigsawStack VOCR. Output is a JSON object of the results";

  name = "jigsawstack_vocr_results_json";

  params: VocrOptions;

  constructor(fields: JigsawStackVocrParams) {
    super(fields);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");
    if (!apiKey) {
      throw new Error("JIGSAWSTACK_API_KEY is required.");
    }

    const _params = fields?.params;
    if (!_params) {
      throw new Error("params.prompt is required.");
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
    const result = await this.client.vision.vocr({
      url: url,
      prompt: this.params.prompt,
    });

    return JSON.stringify(result);
  }
}

export class JigsawStackAIScrape extends Tool {
  client: any;

  params: ScrapeOptions;
  static lc_name(): string {
    return "JigsawStackAIScrape";
  }

  description =
    "A wrapper around JigsawStack AI scrape. Output is a object of the results";

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
      url,
      element_prompts: this.params.element_prompts,
      ...this.params,
    };
    return JSON.stringify(await this.client.web.ai_scrape(_params));
  }
}
