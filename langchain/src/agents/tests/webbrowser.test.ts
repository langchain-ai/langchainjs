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

  const text = getText(wordOfTheDayHtml, baseUrl, false);
  expect(text).toContain("Word of the Day: Foible");
}, 3000000);

// random site I saw my agent try to use and received a sneaky 403
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
}, 3000000);

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
}, 3000000);

// puppeteer tends to work but heavyweight dependency
test.skip("get url and parse html to text and links wih puppeteer", async () => {
  const baseUrl = "https://www.merriam-webster.com/word-of-the-day";

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
  );
  await page.goto(baseUrl, { waitUntil: "networkidle2" });
  const html = await page.content();
  await browser.close();

  const text = getText(html, baseUrl, false);
  console.log(text);
}, 3000000);
