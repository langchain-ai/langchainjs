import { test } from "@jest/globals";
import { CheerioWebBaseLoader } from "../cheerio_web_base";

test("Test cheerio web scraper loader", async () => {
  const loader = new CheerioWebBaseLoader(
    "https://news.ycombinator.com/item?id=34817881"
  );
  const docs = await loader.load();
  console.log({ docs });
});
