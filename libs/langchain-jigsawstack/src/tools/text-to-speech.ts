import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;

export type TextToSpeechInputParams = Omit<
  Parameters<JigsawStackType["audio"]["text_to_speech"]>["0"],
  "text"
>;

export type TextToSpeechOutputParams = Awaited<
  ReturnType<JigsawStackType["audio"]["text_to_speech"]>
>;

export interface JigsawStackTextToSpeechParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  /**
   * Text to Speech input parameters.
   */
  params: TextToSpeechInputParams;
}

export class JigsawStackTextToSpeech extends Tool {
  client: JigsawStackType;
  static lc_name(): string {
    return "JigsawStackTextToSpeech";
  }

  description = "A wrapper around JigsawStack Text to Speech ";

  name = "jigsawstack_text_to_speech_results_json";

  params?: TextToSpeechInputParams;

  constructor(fields: JigsawStackTextToSpeechParams) {
    super(fields);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");
    if (!apiKey) {
      throw new Error("JIGSAWSTACK_API_KEY is required.");
    }

    this.client = JigsawStack({
      apiKey,
    });
    this.params = fields?.params ?? {};
  }

  protected async _call(
    text: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const payload = {
      text,
      ...this.params,
    };
    const result = await this.client.audio.text_to_speech(payload);
    const buffer = await result.buffer();
    return JSON.stringify(buffer);
  }
}
