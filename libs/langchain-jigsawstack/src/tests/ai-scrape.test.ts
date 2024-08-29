import { it, expect } from "@jest/globals";
import { JigsawStackAIScrape } from "../tools/ai-scrape.js";

it("should run successfully and return scrape result", async () => {
  const tool = new JigsawStackAIScrape({
    params: {
      element_prompts: ["Pro plan"],
    },
  });
  const metadata = await tool.invoke("https://jigsawstack.com/pricing");
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
});
