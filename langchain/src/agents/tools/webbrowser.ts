import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { BaseLanguageModel } from "base_language/index.js";
import { get_encoding } from "@dqbd/tiktoken";
import { Tool } from "./base.js";
import { StringPromptValue } from "../../prompts/index.js";

export const getText = (html: string, baseUrl: string): string => {
  const $ = cheerio.load(html);

  let text = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $("*:not(style):not(script):not(svg)").each((_i, elem: any) => {
    // we dont want duplicated content as we drill down so remove children
    let content = $(elem).clone().children().remove().end().text().trim();
    const $el = $(elem);

    // if its an ahref, print the conent and url
    let href = $el.attr("href");
    if ($el.prop("tagName")?.toLowerCase() === "a" && href) {
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).toString();
      }

      const imgAlt = $el.find("img[alt]").attr("alt");
      if (imgAlt) {
        content += ` ${imgAlt}`;
      }

      text += ` [${content}](${href})`;
    }
    // otherwise just print the content
    // found some tricky sites putting 404 text in title, probably updating in js to remove it?, not sure how common?
    else if (content !== "" && content !== "404 Page Not Found") {
      text += ` ${content}`;
    }
  });

  text = text.replace(/\n/g, " ");
  return text;
};

export class WebBrowser extends Tool {
  protected model: BaseLanguageModel;

  constructor(model: BaseLanguageModel) {
    super();

    this.model = model;
  }

  name = "web-browser";

  async _call(inputs: string) {
    const inputArray = inputs.split(",");
    // remove errant spaces and quotes
    const baseUrl = inputArray[0].trim().replace(/^"|"$/g, "").trim();
    const domain = new URL(baseUrl).hostname;

    // todo dont know which headers needed, but this worked on one page anyway, take in from user?
    const htmlResponse = await axios.get(baseUrl, {
      withCredentials: true,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.5",
        "Alt-Used": domain,
        Connection: "keep-alive",
        Host: domain,
        Referer: "https://www.google.com/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
      },
    });

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
