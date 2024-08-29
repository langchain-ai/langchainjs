import { expect, test } from "@jest/globals";
import { JigsawStackAIScrape } from "../tools/ai-scrape.js";
import { JigsawStackTextToSQL } from "../tools/text-to-sql.js";

test("JigsawStackAIScrape can scrape a website given a url and prompt", async () => {
  const tool = new JigsawStackAIScrape({
    params: {
      element_prompts: ["Pro plan"],
    },
  });

  const toolData = await tool.invoke("https://jigsawstack.com/pricing");

  const parsedData = JSON.parse(toolData);
  console.log("results:", parsedData.success);
  expect(parsedData.success).toBeTruthy();
});

test("JigsawStackVocr can perform vision ocr", async () => {
  const tool = new JigsawStackVOCR({
    params: {
      prompt: "Describe the image in detail",
    },
  });

  const toolData = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z"
  );

  const parsedData = JSON.parse(toolData);
  expect(parsedData.success).toBe(true);
});
