import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;

export type TextToSQLInputParams = Omit<
  Parameters<JigsawStackType["text_to_sql"]>["0"],
  "prompt"
>;

export type TextToSQLOutputParams = Awaited<
  ReturnType<JigsawStackType["text_to_sql"]>
>;

export interface JigsawStackTextToSQLParams extends ToolParams {
  /**
   * The API key to use.
   * @default {process.env.JIGSAWSTACK_API_KEY}
   */

  apiKey?: string;

  /**
   * Text to SQL input parameters. if `file_store_key` is specified,  `sql_schema` is not required.
   */
  params: TextToSQLInputParams;
}

export class JigsawStackTextToSQL extends Tool {
  client: JigsawStackType;
  static lc_name(): string {
    return "JigsawStackTextToSQL";
  }

  description = "A wrapper around JigsawStack Text to SQL";

  name = "jigsawstack_text_to_sql_results_json";

  params: TextToSQLInputParams;

  constructor(fields: JigsawStackTextToSQLParams) {
    super(fields);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Please set the JIGSAWSTACK_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
    }

    this.validateParams(fields?.params);

    this.client = JigsawStack({
      apiKey,
    });
    this.params = fields?.params;
  }

  protected async _call(
    prompt: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const payload: any = {
      prompt: prompt,
      sql_schema: this.params?.file_store_key
        ? undefined
        : this.params.sql_schema,
      file_store_key: this.params?.file_store_key ?? undefined,
    };

    return JSON.stringify(await this.client.text_to_sql(payload));
  }

  private validateParams(params?: TextToSQLInputParams) {
    if (!params) {
      throw new Error("params is required.");
    }

    if (!params?.file_store_key && !params?.sql_schema) {
      throw new Error(
        "Either file_store_key or sql_schema must be specified. Please provide one of these parameters."
      );
    }
  }
}
