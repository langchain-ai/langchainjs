import { test } from "@jest/globals";
import { HNLoader } from "../hn";

test("Test Hacker News loader", async () => {
  const loader = new HNLoader("https://news.ycombinator.com/item?id=34817881");
  const docs = await loader.load();
  console.log({ docs });
});
