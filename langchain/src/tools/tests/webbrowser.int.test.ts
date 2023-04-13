import { test, expect, describe } from "@jest/globals";
import { WebBrowser } from "../webbrowser.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";

describe("webbrowser Test suite", () => {
  // todo when we have the fetch adapter presumably that can be used to mock axios as well?

  test("get word of the day", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day","word of the day"`
    );

    expect(result).toContain("Word of the Day:");
  });

  test("get a summary of the page when empty request", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day",""`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  });

  test("get a summary of the page if it drops second request quote", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day","`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  });

  test("get a summary of the page if it gives nothing after comma", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day",`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  });

  test("get a summary of the page if it gives no comma", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.merriam-webster.com/word-of-the-day"`
    );

    // fuzzy, sometimes its capped and others not
    expect(result).toMatch(/word of the day/i);
  });

  test("error no url", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(`"",""`);

    expect(result).toEqual("TypeError [ERR_INVALID_URL]: Invalid URL");
  });

  test("error no protocol or malformed", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"www.merriam-webster.com/word-of-the-day","word of the day"`
    );

    expect(result).toEqual("TypeError [ERR_INVALID_URL]: Invalid URL");
  });

  test("error bad site", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.hDjRBKoAD0EIbF29TWM4rbXDGGM5Nhy4uzNEAdDS.com","word of the day"`
    );

    expect(result).toEqual(
      "Error: getaddrinfo ENOTFOUND www.hdjrbkoad0eibf29twm4rbxdggm5nhy4uzneadds.com"
    );
  });

  // can probably remove this test when fetch stubbed and everything passes
  test("get a summary of a page that detects scraping", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    const browser = new WebBrowser({ model, embeddings });
    const result = await browser.call(
      `"https://www.musicgateway.com/spotify-pre-save",""`
    );

    expect(result).toMatch(/streaming royalty calculator/i);
  });
});
