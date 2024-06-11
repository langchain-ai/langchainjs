import { test, expect } from "@jest/globals";
import { getRelevantHtml, parseInputs } from "../puppeteer.js";


test("getRelevantHtml should extract relevant parts of the html", async () => {
  const html = "<html><body><div><svg>ahh</svg><strong>Hello,</strong> world!<style>*{background-color: pink;}</style><script>Remove me!</script></div></body>";

  expect(getRelevantHtml(html)).toBe("<div><strong>Hello,</strong> world!</div>");
});

test("parseInputs", () => {
  expect(parseInputs(`"https://supermagictaste.com",""`)).toEqual([
    "https://supermagictaste.com",
    "",
  ]);
  expect(
    parseInputs(`"https://supermagictaste.com","word of the day"`)
  ).toEqual(["https://supermagictaste.com", "word of the day"]);
  expect(parseInputs(`"https://supermagictaste.com","`)).toEqual([
    "https://supermagictaste.com",
    "",
  ]);
  expect(parseInputs(`"https://supermagictaste.com",`)).toEqual([
    "https://supermagictaste.com",
    "",
  ]);
  expect(parseInputs(`"https://supermagictaste.com"`)).toEqual([
    "https://supermagictaste.com",
    undefined,
  ]);
});
