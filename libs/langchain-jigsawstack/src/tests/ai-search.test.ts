import { it, expect } from "@jest/globals";
import { JigsawStackAISearch } from "../tools/ai-search.js";

it("should run successfully and return the search result", async () => {
  const tool = new JigsawStackAISearch({
    apiKey:
      "sk_0b9b4fab624794c93fd423d4c079738a8bf0eed4b5c93dd4ac0d77b155c3d7ce91a572f60d1ac4d00a799d0f924d431f6ab42c4a128d689bdae69db59cf67b25024fS7GiEZWQ2HvXOHcdt",
  });

  const metadata = await tool.invoke("The leaning tower of pisa");
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.success).toBe(true);
});
