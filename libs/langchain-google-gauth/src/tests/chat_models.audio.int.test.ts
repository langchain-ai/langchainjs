import fs from "fs";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogle } from "../chat_models.js";

function convertMp3ToBase64(filePath: string): string {
  const fileData = fs.readFileSync(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

test("Gemini can understand audio", async () => {
  const model = new ChatGoogle({
    modelName: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  });

  const audioPath = "./src/tests/data/audio.mp3";
  const audioBase64 = convertMp3ToBase64(audioPath);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "human",
      [
        {
          type: "audio_url",
          audio_url: {
            url: `data:audio/mp3;base64,${audioBase64}`,
          },
        },
        {
          type: "text",
          text: "Summarize this audio. Be very concise.",
        },
      ],
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  console.log("response", response);
});
