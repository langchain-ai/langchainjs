import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;

export type SpeechToTextInputParams = Omit<
  Parameters<JigsawStackType["audio"]["speech_to_text"]>["0"],
  "url"
>;

export type SpeechToTextOutputParams = Awaited<
  ReturnType<JigsawStackType["audio"]["speech_to_text"]>
>;

export interface JigsawStackSpeechToTextParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  /**
   * Speech to Text input parameters.  if `file_store_key` is specified, provide an empty string to the `url` input.
   */
  params: SpeechToTextInputParams;
}

export class JigsawStackSpeechToText extends Tool {
  client: JigsawStackType;
  static lc_name(): string {
    return "JigsawStackSpeechToText";
  }

  description = "A wrapper around JigsawStack Speech to Text ";

  name = "jigsawstack_speech_to_text_results_json";

  params?: SpeechToTextInputParams;

  constructor(fields: JigsawStackSpeechToTextParams) {
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
    url: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const payload = {
      ...this.params,
      url: this.params?.file_store_key ? undefined : url,
      file_store_key: this.params?.file_store_key ?? undefined,
    };
    const result = await this.client.audio.speech_to_text(payload);
    return JSON.stringify(result);
  }
}
