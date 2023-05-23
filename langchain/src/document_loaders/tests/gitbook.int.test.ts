import { test } from "@jest/globals";
import { GitbookLoader } from "../web/gitbook.js";

test("Test GitbookLoader", async () => {
  const loader = new GitbookLoader(
    "https://docs.gitbook.com/product-tour/navigation"
  );

  const docs = await loader.load();
  console.log(docs);
});

test.only("Test GitbookLoader with shouldLoadAllPaths", async () => {
  const loader = new GitbookLoader("https://docs.gitbook.com", {
    shouldLoadAllPaths: true,
  });
  const docs = await loader.load();
  console.log(docs);
});
