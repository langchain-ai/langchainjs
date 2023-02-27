import { test } from "@jest/globals";
import { HNLoader } from "../hn.js";

test("Test Hacker News loader", async () => {
  const loader = new HNLoader("https://news.ycombinator.com/item?id=34817881");
  await loader.load();
});
