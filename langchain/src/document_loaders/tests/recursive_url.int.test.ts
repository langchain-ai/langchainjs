/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { compile } from "html-to-text";
import { RecursiveUrlLoader } from "../web/recursive_url.js";

describe("RecursiveUrlLoader", () => {
  test("loading valid url", async () => {
    const url = "https://js.langchain.com/docs/get_started/introduction";

    const compiledConvert = compile({ wordwrap: 130 }); // returns (input: string) => string;

    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 1,
      excludeDirs: ["https://js.langchain.com/docs/api/"],
    });

    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).toContain("LangChain");
  });

  test("loading single page", async () => {
    const url = "https://js.langchain.com/docs/get_started/introduction";

    const compiledConvert = compile({ wordwrap: 130 }); // returns (input: string) => string;

    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 0,
      excludeDirs: ["https://js.langchain.com/docs/api/"],
    });

    const docs = await loader.load();
    expect(docs.length).toBe(1);
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

  test("excludeDirs works for top-level calls", async () => {
    const url = "https://js.langchain.com/docs/";
    const compiledConvert = compile({ wordwrap: 130 });

    const excludeDir = "https://js.langchain.com/docs/api/";

    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 1,
      excludeDirs: [excludeDir],
    });

    const docs = await loader.load();

    expect(docs.some((doc) => doc.metadata.source.startsWith(excludeDir))).toBe(
      false
    );
  });

  test("excludeDirs works for recursive calls", async () => {
    const url = "https://js.langchain.com/docs/";
    const compiledConvert = compile({ wordwrap: 130 });

    const excludeDir = "https://js.langchain.com/docs/api/";

    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 2,
      excludeDirs: [excludeDir],
    });

    const docs = await loader.load();

    expect(docs.some((doc) => doc.metadata.source.startsWith(excludeDir))).toBe(
      false
    );
  });
});
