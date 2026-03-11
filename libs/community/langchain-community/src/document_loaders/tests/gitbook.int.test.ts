import { test } from "@jest/globals";
import { GitbookLoader } from "../web/gitbook.js";

test("Test GitbookLoader", async () => {
  const loader = new GitbookLoader(
    "https://docs.gitbook.com/product-tour/navigation"
  );

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const docs = await loader.load();
  // console.log("Loaded", docs.length, "Gitbook documents");
});

test("Test GitbookLoader with shouldLoadAllPaths", async () => {
  const loader = new GitbookLoader("https://docs.maildrop.cc", {
    shouldLoadAllPaths: true,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const docs = await loader.load();
  // console.log("Loaded", docs.length, "Gitbook documents");
});
