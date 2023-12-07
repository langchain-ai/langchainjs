import { test, expect, describe } from "@jest/globals";
import { readFileSync } from "fs";
import { getText, parseInputs } from "../webbrowser.js";

describe("webbrowser Test suite", () => {
  const html = readFileSync("./src/tools/fixtures/wordoftheday.html", "utf8");

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
