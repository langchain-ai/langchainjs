import fs from "fs";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogle } from "../chat_models.js";

function convertMp3ToBase64(filePath: string): string {
  const fileData = fs.readFileSync(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

test("Gemini can understand audio", async () => {
  const model = new ChatGoogle({
    model: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  });

  const audioPath = "./src/tests/data/audio.mp3";
  const audioBase64 = convertMp3ToBase64(audioPath);

  const prompt = ChatPromptTemplate.fromMessages([new MessagesPlaceholder("audio")]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    audio: new HumanMessage({
      content: [{
        type: "audio",
        data: {
          url: `data:audio/mp3;base64,${audioBase64}`
        },
      }, {
        type: "text",
        text: "Summarize this audio. Be very concise.",
      }]
    }),
  });
  console.log("response", response);
});
