import { Tool } from "@langchain/core/tools";

export interface Headers {
  [key: string]: string;
}

/**
 * Interface for HTTP request tools. Contains properties for headers and
 * maximum output length.
 */
export interface RequestTool {
  headers: Headers;
  maxOutputLength: number;
}

/**
 * Class for making GET requests. Extends the Tool class and implements
 * the RequestTool interface. The input should be a URL string, and the
 * output will be the text response of the GET request.
 */
export class RequestsGetTool extends Tool implements RequestTool {
  static lc_name() {
    return "RequestsGetTool";
  }

  name = "requests_get";

  maxOutputLength = 2000;

  constructor(
    public headers: Headers = {},
    { maxOutputLength }: { maxOutputLength?: number } = {}
  ) {
    super(...arguments);

    this.maxOutputLength = maxOutputLength ?? this.maxOutputLength;
  }

  /** @ignore */
  async _call(input: string) {
    const res = await fetch(input, {
      headers: this.headers,
    });
    const text = await res.text();
    return text.slice(0, this.maxOutputLength);
  }

  description = `A portal to the internet. Use this when you need to get specific content from a website.
  Input should be a url string (i.e. "https://www.google.com"). The output will be the text response of the GET request.`;
}

/**
 * Class for making POST requests. Extends the Tool class and implements
 * the RequestTool interface. The input should be a JSON string with two
 * keys: 'url' and 'data'. The output will be the text response of the
 * POST request.
 */
export class RequestsPostTool extends Tool implements RequestTool {
  static lc_name() {
    return "RequestsPostTool";
  }

  name = "requests_post";

  maxOutputLength = Infinity;

  constructor(
    public headers: Headers = {},
    { maxOutputLength }: { maxOutputLength?: number } = {}
  ) {
    super(...arguments);

    this.maxOutputLength = maxOutputLength ?? this.maxOutputLength;
  }

  /** @ignore */
  async _call(input: string) {
    try {
      const { url, data } = JSON.parse(input);
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(data),
      });
      const text = await res.text();
      return text.slice(0, this.maxOutputLength);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Use this when you want to POST to a website.
  Input should be a json string with two keys: "url" and "data".
  The value of "url" should be a string, and the value of "data" should be a dictionary of
  key-value pairs you want to POST to the url as a JSON body.
  Be careful to always use double quotes for strings in the json string
  The output will be the text response of the POST request.`;
}
