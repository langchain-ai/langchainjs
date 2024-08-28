import { it, expect } from "@jest/globals";
import { JigsawStackVOCR } from "../tools.ts";

it("should exclude the text field from metadata", async () => {
  const tool = new JigsawStackVOCR({
    params: {
      prompt: "Describe the image in detail",
    },
    apiKey:
      "sk_0b9b4fab624794c93fd423d4c079738a8bf0eed4b5c93dd4ac0d77b155c3d7ce91a572f60d1ac4d00a799d0f924d431f6ab42c4a128d689bdae69db59cf67b25024fS7GiEZWQ2HvXOHcdt",
  });
  const metadata = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z"
  );
  const jsonData = JSON.parse(metadata);
  expect(jsonData.success).toBe(true);
});
