import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { URL } from "url";
import { BaseLanguageModel } from "base_language/index.js";
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
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
    );
    const htmlResponse = await page.goto(baseUrl, {
      waitUntil: "networkidle2",
    });

    if (htmlResponse?.status() !== 200) {
      return Promise.resolve(`http response ${htmlResponse?.status()}`);
    }

    const html = await page.content();
    await browser.close();

    let text = getText(html, baseUrl);

    // ~3500 token max estimate
    text = text.slice(0, 1000);

    const input = `I need ${
      inputArray[1] ? inputArray[1] : "a summary"
    } from the following webpage text, also provide up to 5 html links from within that would be of interest. Text:\n${text}`;

    const { generations } = await this.model.generatePrompt([
      new StringPromptValue(input),
    ]);

    return Promise.resolve(generations[0][0].text);
  }

  description = `a web browser. useful for when you need to find something or summarize a url. input should be a comma seperated list of "url","what you want to find on the page".`;
}
