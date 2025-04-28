import { Tool, type ToolParams } from "@langchain/core/tools";

/**
 * @example
 * ```typescript
 * const tool = new WolframAlphaTool({
 *   appid: "YOUR_APP_ID",
 * });
 * const res = await tool.invoke("What is 2 * 2?");
 * ```
 */
export class WolframAlphaTool extends Tool {
  appid: string;

  name = "wolfram_alpha";

  description = `A wrapper around Wolfram Alpha. Useful for when you need to answer questions about Math, Science, Technology, Culture, Society and Everyday Life. Input should be a search query.`;

  constructor(fields: ToolParams & { appid: string }) {
    super(fields);

    this.appid = fields.appid;
  }

  static lc_name() {
    return "WolframAlphaTool";
  }

  async _call(query: string): Promise<string> {
    const url = `https://www.wolframalpha.com/api/v1/llm-api?appid=${
      this.appid
    }&input=${encodeURIComponent(query)}`;
    const res = await fetch(url);

    return res.text();
  }
}
