import { expect, test } from "@jest/globals";
import { JigsawStackVOCR, JigsawStackAIScrape } from "../tools.ts";

test("JigsawStackAIScrape can scrape a website given a url and prompt", async () => {
  const tool = new JigsawStackAIScrape({
    params: {
      element_prompts: ["Pro plan"],
    },
    apiKey:
      "sk_0b9b4fab624794c93fd423d4c079738a8bf0eed4b5c93dd4ac0d77b155c3d7ce91a572f60d1ac4d00a799d0f924d431f6ab42c4a128d689bdae69db59cf67b25024fS7GiEZWQ2HvXOHcdt",
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
    apiKey:
      "sk_0b9b4fab624794c93fd423d4c079738a8bf0eed4b5c93dd4ac0d77b155c3d7ce91a572f60d1ac4d00a799d0f924d431f6ab42c4a128d689bdae69db59cf67b25024fS7GiEZWQ2HvXOHcdt",
  });

  const toolData = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z"
  );

  const parsedData = JSON.parse(toolData);
  expect(parsedData.success).toBe(true);
});
