import axios from "axios";
import { test, expect, describe } from "@jest/globals";
import { readFileSync } from "fs";
import { getText, WebBrowser } from "../tools/webbrowser.js";
import { ChatOpenAI } from "../../chat_models/openai.js";

describe("webbrowser Test suite", () => {
  // todo when we have the fetch adapter presumably that can be used to mock axios as well?
  const html = readFileSync("./src/agents/tests/wordoftheday.html", "utf8");

  test("get word of the day", async () => {
    const model = new ChatOpenAI({ temperature: 0 });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day","word of the day"`
    );

    expect(result).toContain("Word of the Day:");
  }, 30000);

  test("get a summary of the page when empty request", async () => {
    const model = new ChatOpenAI({
      temperature: 0,
    });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day",""`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  }, 30000);

  test("get a summary of the page if it drops second request quote", async () => {
    const model = new ChatOpenAI({
      temperature: 0,
    });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day","`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  }, 30000);

  test("get a summary of the page if it gives nothing after comma", async () => {
    const model = new ChatOpenAI({
      temperature: 0,
    });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day",`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  }, 30000);

  test("get a summary of the page if it gives no comma", async () => {
    const model = new ChatOpenAI({
      temperature: 0,
    });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day"`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  }, 30000);

  test("error no url", async () => {
    const model = new ChatOpenAI({ temperature: 0 });

    const browser = new WebBrowser(model);
    const result = await browser.call(`"",""`);

    expect(result).toEqual("TypeError [ERR_INVALID_URL]: Invalid URL");
  }, 30000);

  test("error no protocol or malformed", async () => {
    const model = new ChatOpenAI({ temperature: 0 });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"www.merriam-webster.com/word-of-the-day","word of the day"`
    );

    expect(result).toEqual("TypeError [ERR_INVALID_URL]: Invalid URL");
  }, 30000);

  test("error bad site", async () => {
    const model = new ChatOpenAI({ temperature: 0 });

    const browser = new WebBrowser(model);
    const result = await browser.call(
      `"https://www.hDjRBKoAD0EIbF29TWM4rbXDGGM5Nhy4uzNEAdDS.com","word of the day"`
    );

    expect(result).toEqual(
      "Error: getaddrinfo ENOTFOUND www.hdjrbkoad0eibf29twm4rbxdggm5nhy4uzneadds.com"
    );
  }, 30000);

  test("parse html to text and links", async () => {
    const baseUrl = "https://www.merriam-webster.com/word-of-the-day";
    const text = getText(html, baseUrl, false);
    expect(text).toContain("Word of the Day: Foible");
  }, 30000);

  // random site I saw my agent try to use and received a sneaky 403 if headers are altered
  // test any new header changes against this
  test.skip("get url and parse html to text and links", async () => {
    const baseUrl = "https://www.musicgateway.com/spotify-pre-save";
    const domain = new URL(baseUrl).hostname;

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

    const text = getText(htmlResponse.data, baseUrl, false);
    console.log(text);
  }, 30000);

  // todo make fetch work and stub axios
  // fetch gives InvalidArgumentError: invalid connection header
  // if you remove the Connection: "keep-alive" it 'works' but is back to giving 403
  test.skip("get url and parse html to text and links with fetch", async () => {
    const baseUrl = "https://www.musicgateway.com/spotify-pre-save";
    const domain = new URL(baseUrl).hostname;

    const headers = {
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
    };

    const response = await fetch(baseUrl, {
      headers,
      credentials: "include",
    });

    const htmlResponse = await response.text();

    const text = getText(htmlResponse, baseUrl, false);
    console.log(text);
  }, 30000);
});
