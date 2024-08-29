import { it, expect } from "@jest/globals";
import { JigsawStackSpeechToText } from "../tools/speech-to-text.js";

it("should run successfully and return the transcribe result", async () => {
  const tool = new JigsawStackSpeechToText();

  const metadata = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Video%201737458382653833217.mp4?t=2024-03-22T09%3A50%3A49.894"
  );
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.success).toBe(true);
});
