import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;

export type VOCRInputParams = Omit<
  Parameters<JigsawStackType["vision"]["vocr"]>["0"],
  "url"
>;

export type VOCROutputParams = Awaited<
  ReturnType<JigsawStackType["vision"]["vocr"]>
>;

export interface JigsawStackVOCRParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  /**
   * VOCR input parameters. if `file_store_key` is specified, provide an empty string to the `url` input.
   */
  params: VOCRInputParams;
}

/**
 * A tool that leverages the JigsawStack VOCR API.
 *
 * This tool allows you to recognize, describe, and retrieve data from images with great accuracy.
 *
 * To use this tool, ensure that the `JIGSAWSTACK_API_KEY` environment variable is set.
 * You can create a free API key at [JigsawStack](https://jigsawstack.com).
 *
 * @example
 * ```typescript
 * const tool = new JigsawStackVOCR({
 *   params: {
 *     prompt: "Describe the image in detail",
 *   },
 * });
 * const res = await tool.invoke("https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z");
 * console.log({ res });
 * ```
 */

export class JigsawStackVOCR extends Tool {
  client: JigsawStackType;
  static lc_name(): string {
    return "JigsawStackVOCRResults";
  }

  description = "A wrapper around JigsawStack VOCR";

  name = "jigsawstack_vocr";

  params: VOCRInputParams;

  constructor(fields: JigsawStackVOCRParams) {
    super(fields);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Please set the JIGSAWSTACK_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
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
    const payload = {
      prompt: this.params.prompt,
      url: this.params?.file_store_key ? undefined : url,
      file_store_key: this.params?.file_store_key ?? undefined,
    };

    return JSON.stringify(await this.client.vision.vocr(payload));
  }
}
