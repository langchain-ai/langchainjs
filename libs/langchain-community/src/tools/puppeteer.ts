import { launch } from "puppeteer";
import { load } from "cheerio";

import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { Tool, ToolParams } from "@langchain/core/tools";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import {
  RecursiveCharacterTextSplitter,
  TextSplitter,
} from "@langchain/textsplitters";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { formatDocumentsAsString } from "langchain/util/document";
import { Document } from "langchain/document";

export const parseInputs = (inputs: string): [string, string] => {
  const [baseUrl, task] = inputs.split(",").map((input) => {
    let t = input.trim();
    t = t.startsWith('"') ? t.slice(1) : t;
    t = t.endsWith('"') ? t.slice(0, -1) : t;
    t = t.endsWith("/") ? t.slice(0, -1) : t;
    return t.trim();
  });

  return [baseUrl, task];
};

export const getRelevantHtml = async (html: string): Promise<string> => {
  const $ = load(html);

  const tagsToRemove = ["script", "svg", "style"];

  for (const tag of tagsToRemove) {
    await $(tag).remove();
  }

  return $("body").html()?.trim().replace(/\n+/g, " ") ?? "";
};

export const getHtml = async (
  baseUrl: string,
  headers: Headers = DEFAULT_HEADERS
) => {
  const browser = await launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders(headers);
  await page.goto(baseUrl, { waitUntil: "networkidle0" });

  const bodyHtml = await page.content();
  await browser.close();

  return bodyHtml;
};

const DEFAULT_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "en-US,en;q=0.5",

  Referer: "https://www.google.com/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Headers = Record<string, any>;

/**
 * Defines the arguments that can be passed to the WebBrowser constructor.
 * It extends the ToolParams interface and includes properties for a
 * language model, embeddings, HTTP headers, and a text splitter.
 */
export interface PuppeteerBrowserArgs extends ToolParams {
  model: LanguageModelLike;

  embeddings: EmbeddingsInterface;

  headers?: Headers;

  textSplitter?: TextSplitter;
}

export class PuppeteerBrowser extends Tool {
  name = "puppeteer-browser";

  description = `Useful for when you need to find something on a webpage. Input should be a comma separated list of "ONE valid URL including protocol","What you want to find on the page or empty string for a summary"`;

  static lc_name() {
    return "PuppeteerBrowser";
  }

  get lc_namespace() {
    return [...super.lc_namespace, "puppeteer"];
  }

  private model: LanguageModelLike;

  private embeddings: EmbeddingsInterface;

  private headers: Headers;

  private textSplitter: TextSplitter;

  constructor({
    model,
    headers,
    embeddings,
    textSplitter,
  }: PuppeteerBrowserArgs) {
    super(...arguments);

    this.model = model;
    this.embeddings = embeddings;
    this.headers = headers ?? DEFAULT_HEADERS;

    this.textSplitter =
      textSplitter ??
      new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 200,
      });
  }

  async _call(inputs: string) {
    const [baseUrl, task] = parseInputs(inputs);
    const doSummary = !task;

    let text;
    try {
      const html = await getHtml(baseUrl, this.headers);
      text = await getRelevantHtml(html);
    } catch (e) {
      if (e) {
        return e.toString();
      }
      return "There was a problem connecting to the site";
    }

    const texts = await this.textSplitter.splitText(text);

    let context;
    if (doSummary) {
      context = texts.slice(0, 4).join("\n");
    } else {
      const docs = texts.map(
        (pageContent: string) =>
          new Document({
            pageContent,
            metadata: [],
          })
      );

      const vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        this.embeddings
      );
      const results = await vectorStore.similaritySearch(task, 4);
      context = formatDocumentsAsString(results);
    }

    const input = `Text:${context}\n\nI need ${
      doSummary ? "a summary" : task
    } from the above text, also provide up to 5 markdown links from within that would be of interest (always including URL and text). Links should be provided, if present, in markdown syntax as a list under the heading "Relevant Links:".`;

    const chain = RunnableSequence.from([this.model, new StringOutputParser()]);
    return chain.invoke(input);
  }
}
