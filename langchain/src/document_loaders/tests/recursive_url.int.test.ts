/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { compile } from "html-to-text";
import { RecursiveUrlLoader } from "../web/recursive_url.js";

describe("RecursiveUrlLoader", () => {
  test("loading valid url", async () => {
    const url = "https://js.langchain.com/docs/get_started/introduction";

    const compiledConvert = compile({ wordwrap: 130 }); // returns (input: string;) => string;

    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 1,
      excludeDirs: ["https://js.langchain.com/docs/api/"],
    });

    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].pageContent).toContain("LangChain");
  });

  test("loading invalid url", async () => {
    const url = "https://this.url.is.invalid/this/is/a/test";
    const loader = new RecursiveUrlLoader(url, {
      maxDepth: 1,
      preventOutside: true,
    });
    const docs = await loader.load();
    expect(docs.length).toBe(0);
  });
});
