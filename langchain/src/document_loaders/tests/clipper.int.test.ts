import { test } from "@jest/globals";
import { ClipperWebLoader } from "../web/clipper.js";

test("Test clipper web loader", async () => {
  const loader = new ClipperWebLoader(
    "https://news.ycombinator.com/item?id=38994680"
  );
  console.log(await loader.load());
});

test.skip("Test clipper web loader with Playwright", async () => {
  const loader = new ClipperWebLoader(
    "https://news.ycombinator.com/item?id=38994680",
    {
      usePlaywrightCrawler: true,
    }
  );
  console.log(await loader.load());
});
