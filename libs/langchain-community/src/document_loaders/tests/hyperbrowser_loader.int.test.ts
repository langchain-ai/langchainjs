import { test } from "@jest/globals";
import { HyperbrowserLoader } from "../web/hyperbrowser.js";

test.skip("HyperbrowserLoader scrape mode", async () => {
  const loader = new HyperbrowserLoader({
    url: "https://example.com",
    mode: "scrape",
    outputFormat: ["markdown"],
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
      acceptCookies: false,
      useStealth: false,
    },
  });

  const docs = await loader.load();
  expect(docs).toBeTruthy();
  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toBeTruthy();
  expect(docs[0].metadata.source).toBe("https://example.com");
});

test.skip("HyperbrowserLoader crawl mode", async () => {
  const loader = new HyperbrowserLoader({
    url: "https://example.com",
    mode: "crawl",
    maxPages: 2,
    outputFormat: ["markdown"],
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
      acceptCookies: false,
      useStealth: false,
    },
  });

  const docs = await loader.load();
  expect(docs).toBeTruthy();
  expect(docs.length).toBeGreaterThan(0);
  expect(docs[0].pageContent).toBeTruthy();
  expect(docs[0].metadata.source).toBeTruthy();
});

test.skip("HyperbrowserLoader with different output formats", async () => {
  const loader = new HyperbrowserLoader({
    url: "https://example.com",
    mode: "scrape",
    outputFormat: ["markdown", "html", "links"],
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
      acceptCookies: false,
      useStealth: false,
    },
  });

  const docs = await loader.load();
  expect(docs).toBeTruthy();
  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toBeTruthy();
  expect(docs[0].metadata.source).toBe("https://example.com");
});
