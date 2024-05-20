import { Tool } from "./base.js";

export class OpenIndex extends Tool {
  name = "OpenIndex Search";

  description =
    "Useful for when you need to search or ask a question about your private documents or the public repository of websites, documents, regulations, laws, scientific papers available on OpenIndex.ai. The input should be a search query or a question.";

  protected apiKey: string;

  constructor(
    apiKey: string | undefined = typeof process !== "undefined"
      ? // eslint-disable-next-line no-process-env
        process.env?.OPENINDEX_API_KEY
      : undefined
  ) {
    super();

    if (!apiKey) {
      throw new Error(
        "OpenIndex API key not set. You can set it as OPENINDEX_API_KEY in your .env file, or pass it to OpenIndex."
      );
    }

    this.apiKey = apiKey;
  }

  async _call(input: string) {
    const response = await fetch("https://www.openindex.ai/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        message: input,
        streaming: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenIndex returned an error ${response.statusText}`);
    }

    const data = await response.json();

    return data.message;
  }
}
