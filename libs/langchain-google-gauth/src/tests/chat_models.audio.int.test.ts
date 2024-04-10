import fs from "fs";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogle } from "../chat_models.js";

function fileToBase64(filePath: string): string {
  const fileData = fs.readFileSync(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

test.skip("Gemini can understand audio", async () => {
  const model = new ChatGoogle({
    model: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  });

  const audioPath = "../../examples/Mozart_Requiem_D_minor.mp3";
  const audioMimeType = "audio/mp3";
  const audioBase64 = fileToBase64(audioPath);

  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("audio"),
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    audio: new HumanMessage({
      content: [
        {
          type: "media",
          mimeType: audioMimeType,
          data: audioBase64,
        },
        {
          type: "text",
          text: "Do you know this song? If so, who is the composer and can you give me a brief overview of the tone/tempo?",
        },
      ],
    }),
  });

  expect(typeof response.content).toBe("string");
  expect((response.content as string).length).toBeGreaterThan(15);
});

test.skip("Gemini can understand video", async () => {
  const model = new ChatGoogle({
    model: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  });

  const audioPath = "../../examples/lance_ls_eval_video.mp4";
  const audioMimeType = "video/mp4";
  const audioBase64 = fileToBase64(audioPath);

  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("video"),
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    video: new HumanMessage({
      content: [
        {
          type: "media",
          mimeType: audioMimeType,
          data: audioBase64,
        },
        {
          type: "text",
          text: "Summarize the video in a few sentences.",
        },
      ],
    }),
  });

  expect(typeof response.content).toBe("string");
  expect((response.content as string).length).toBeGreaterThan(15);
});
