import { test } from "@jest/globals";
import { OpenAIWhisper } from "../openai-whisper.js";
import { AudioLoader } from "../../document_loaders/audio.js";

test("Test OpenAIWhisper", async () => {
  const audio = new AudioLoader("src/document_loaders/examples/hello.mp3");
  const files = await audio.load();
  const model = new OpenAIWhisper();
  const res = await model.call(files[0].file);
  console.log({ res });
});
