import { it, expect } from "@jest/globals";
import { JigsawStackAIScrape } from "../tools/ai-scrape.js";

it("should run success scrape result", async () => {
  const tool = new JigsawStackAIScrape({
    params: {
      element_prompts: ["Pro plan"],
    },
    apiKey:
      "sk_0b9b4fab624794c93fd423d4c079738a8bf0eed4b5c93dd4ac0d77b155c3d7ce91a572f60d1ac4d00a799d0f924d431f6ab42c4a128d689bdae69db59cf67b25024fS7GiEZWQ2HvXOHcdt",
  });
  const metadata = await tool.invoke("https://jigsawstack.com/pricing");
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
});
