import fs from "node:fs";

import { test, expect, describe, vi } from "vitest";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

import { WebBrowser, getText, parseInputs } from "../webbrowser.js";
import { FakeListLLM } from "../../util/testing/llms/fake.js";

describe("webbrowser Test suite", () => {
  const html = fs.readFileSync(
    "./src/tools/fixtures/wordoftheday.html",
    "utf8"
  );

  test("parse html to text and links", async () => {
    const baseUrl = "https://www.merriam-webster.com/word-of-the-day";
    const text = getText(html, baseUrl, false);
    expect(text).toContain("Word of the Day: Foible");
  });

  test("parseInputs", () => {
    expect(
      parseInputs(`"https://www.merriam-webster.com/word-of-the-day",""`)
    ).toEqual(["https://www.merriam-webster.com/word-of-the-day", ""]);
    expect(
      parseInputs(
        `"https://www.merriam-webster.com/word-of-the-day","word of the day"`
      )
    ).toEqual([
      "https://www.merriam-webster.com/word-of-the-day",
      "word of the day",
    ]);
    expect(
      parseInputs(`"https://www.merriam-webster.com/word-of-the-day","`)
    ).toEqual(["https://www.merriam-webster.com/word-of-the-day", ""]);
    expect(
      parseInputs(`"https://www.merriam-webster.com/word-of-the-day",`)
    ).toEqual(["https://www.merriam-webster.com/word-of-the-day", ""]);
    expect(
      parseInputs(`"https://www.merriam-webster.com/word-of-the-day"`)
    ).toEqual(["https://www.merriam-webster.com/word-of-the-day", undefined]);
  });
});

describe("WebBrowser fetching", () => {
  const model = new FakeListLLM({ responses: ["summary"] });
  const embeddings = new SyntheticEmbeddings({ vectorSize: 4 });

  test("uses the fetch it is given", async () => {
    const fetch = vi.fn(
      async () =>
        new Response("<html><body><p>Hello there</p></body></html>", {
          headers: { "content-type": "text/html" },
        })
    );
    const browser = new WebBrowser({ model, embeddings, fetch });
    expect(await browser.invoke(`"https://example.com/",""`)).toContain(
      "summary"
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("refuses private network addresses by default", async () => {
    const browser = new WebBrowser({ model, embeddings });
    expect(await browser.invoke(`"http://127.0.0.1/",""`)).toMatch(/localhost/);
  });
});
