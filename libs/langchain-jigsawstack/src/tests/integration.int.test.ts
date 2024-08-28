import { test, expect } from "@jest/globals";
import { JigsawStack } from "jigsawstack";
import { JigsawStackAIScrape, JigsawStackVOCR } from "../tools.js";

test("JigsawStackAIScrape can scrape a website given a url and prompt", async () => {
  const tool = new JigsawStackAIScrape({
    // @ts-expect-error type errors
    client: new JigsawStack(),
  });

  const toolData = await tool.invoke({ url: "", element_prompt: [""] });

  const parsedData = JSON.parse(toolData);
  expect("results" in parsedData).toBeTruthy();
  console.log("results:", parsedData.success);
  expect(parsedData.success).toBeTruthy();
});

test("JigsawStackVocr can perform vision ocr", async () => {
  const tool = new JigsawStackVOCR({
    // @ts-expect-error type errors
    client: new JigsawStack(),
  });

  const toolData = await tool.invoke({});

  const parsedData = JSON.parse(toolData);
  expect("results" in parsedData).toBeTruthy();
  // console.log("results:", parsedData.results);
  expect(parsedData.success).toBe(true);
});
