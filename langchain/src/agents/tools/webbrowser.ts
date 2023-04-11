import axios, { isAxiosError } from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { BaseLanguageModel } from "base_language/index.js";
import { get_encoding } from "@dqbd/tiktoken";
import { Tool } from "./base.js";
import { StringPromptValue } from "../../prompts/index.js";

export const getText = (html: string, baseUrl: string): string => {
  const $ = cheerio.load(html);

  let text = "";

  // I think theres a bug in noscript text, it always prints all its children nodes in full
  // take :not(noscript) out when patched
  // https://github.com/cheeriojs/cheerio/issues/3121
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $("*:not(style):not(script):not(svg):not(noscript)").each((_i, elem: any) => {
    // we dont want duplicated content as we drill down so remove children
    let content = $(elem).clone().children().remove().end().text().trim();
    const $el = $(elem);

    // if its an ahref, print the conent and url
    let href = $el.attr("href");
    if ($el.prop("tagName")?.toLowerCase() === "a" && href) {
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).toString();
      }

      const imgAlt = $el.find("img[alt]").attr("alt")?.trim();
      if (imgAlt) {
        content += ` ${imgAlt}`;
      }

      text += ` [${content}](${href})`;
    }
    // otherwise just print the content
    else if (content !== "") {
      text += ` ${content}`;
    }
  });

  text = text.trim().replace(/\n+/g, " ");
  return text;
};

const DEFAULT_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "en-US,en;q=0.5",
  "Alt-Used": "LEAVE-THIS-KEY-SET-BY-TOOL",
  Connection: "keep-alive",
  Host: "LEAVE-THIS-KEY-SET-BY-TOOL",
  Referer: "https://www.google.com/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
};

export class WebBrowser extends Tool {
  protected model: BaseLanguageModel;

  headers: Record<string, any>;

  constructor(model: BaseLanguageModel, headers?: Record<string, any>) {
    super();

    this.model = model;
    this.headers = headers || DEFAULT_HEADERS;
  }

  name = "web-browser";

  async _call(inputs: string) {
    const inputArray = inputs.split(",");
    // remove errant spaces and quotes
    const baseUrl = inputArray[0].trim().replace(/^"|"$/g, "").trim();
    let domain;
    try {
      domain = new URL(baseUrl).hostname;
    } catch (e: unknown) {
      if (e) {
        return e.toString();
      }
      return "An error has occured parsing the url";
    }

    const headers = { ...this.headers };
    // these appear to be positional, which means they have to exist in the headers passed in
    headers.Host = domain;
    headers["Alt-Used"] = domain;

    let htmlResponse;
    try {
      htmlResponse = await axios.get(baseUrl, {
        withCredentials: true,
        headers,
      });
    } catch (e) {
      if (isAxiosError(e) && e.response) {
        return `http response ${e.response.status}`;
      }
      if (e) {
        return e.toString();
      }
      return "An error has occured connecting to url";
    }

    const allowedContentTypes = [
      "text/html",
      "application/json",
      "application/xml",
      "application/javascript",
      "text/plain",
    ];

    const contentType = htmlResponse.headers["content-type"];
    const contentTypeArray = contentType.split(";");
    if (
      contentTypeArray[0] &&
      !allowedContentTypes.includes(contentTypeArray[0])
    ) {
      return "returned page was not utf8";
    }

    const text = getText(htmlResponse.data, baseUrl);

    // todo need to pass in tokenizer i guess
    const tokenizer = get_encoding("gpt2");
    // doesnt support max tokens yet?
    const inputTokens = tokenizer.encode(text);
    const truncatedTokens = inputTokens.slice(0, 3000);
    const truncatedTextUint8 = tokenizer.decode(truncatedTokens);

    const truncatedTextDecoder = new TextDecoder("utf-8");
    const truncatedText = truncatedTextDecoder.decode(truncatedTextUint8);

    const input = `I need ${
      inputArray[1] ? inputArray[1] : "a summary"
    } from the following webpage text, also provide up to 5 html links from within that would be of interest. Text:\n${truncatedText}`;

    const { generations } = await this.model.generatePrompt([
      new StringPromptValue(input),
    ]);

    return Promise.resolve(generations[0][0].text);
  }

  description = `a web browser. useful for when you need to find something or summarize a url. input should be a comma seperated list of "url","what you want to find on the page".`;
}
