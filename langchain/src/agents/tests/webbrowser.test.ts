import axios from "axios";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import puppeteer from "puppeteer";
import { test, expect } from "@jest/globals";
import { getText } from "../tools/webbrowser.js";

test("parse html to text and links", async () => {
  const baseUrl = "https://www.merriam-webster.com/word-of-the-day";

  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./wordoftheday.html"
  );

  const wordOfTheDayHtml = await fs.readFile(filePath, "utf-8");

  const text = getText(wordOfTheDayHtml, baseUrl);
  expect(text).toContain("Word of the Day: Foible");
}, 3000000);

// cant figure a user agent and cookies etc to get this to not 404 so we dont use puppeteer
test.skip("get url and parse html to text and links", async () => {
  const baseUrl = "https://www.merriam-webster.com/word-of-the-day";

  const htmlResponse = await axios.get(baseUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
    },
  });

  const text = getText(htmlResponse.data, baseUrl);
  console.log(text);
}, 3000000);

// use puppeteer instead for now
test.skip("get url and parse html to text and links", async () => {
  const baseUrl = "https://www.merriam-webster.com/word-of-the-day";

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
  );
  await page.goto(baseUrl, { waitUntil: "networkidle2" });
  const html = await page.content();
  await browser.close();

  const text = getText(html, baseUrl);
  console.log(text);
}, 3000000);
