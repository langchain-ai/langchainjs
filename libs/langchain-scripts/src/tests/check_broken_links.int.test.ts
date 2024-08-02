import { test, expect } from "@jest/globals";
import { checkBrokenLinks } from "../check_broken_links.js";

test("Can load mdx file and find broken links", async () => {
  const pathToMdxFiles = "./src/tests/__mdx__/";

  await expect(
    checkBrokenLinks(pathToMdxFiles, { logErrors: true })
  ).rejects.toThrow();
});
