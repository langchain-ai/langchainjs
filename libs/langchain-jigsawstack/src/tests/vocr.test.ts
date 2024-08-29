import { it, expect } from "@jest/globals";
import { JigsawStackVOCR } from "../tools/vocr.js";

it("should return result.success is true", async () => {
  const tool = new JigsawStackVOCR({
    params: {
      prompt: "Describe the image in detail",
    },
  });
  const metadata = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z"
  );
  const jsonData = JSON.parse(metadata);
  expect(jsonData.success).toBe(true);
});
