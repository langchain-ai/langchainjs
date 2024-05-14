import fs from "fs";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatGoogle } from "../chat_models.js";

function fileToBase64(filePath: string): string {
  const fileData = fs.readFileSync(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

const audioPath = "/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/langchain-google-gauth/src/tests/data/audio.mp3";
const audioMimeType = "audio/mp3";

const videoPath = "/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/langchain-google-gauth/src/tests/data/video.mp4";
const videoMimeType = "video/mp4";

test.only("Gemini can understand audio", async () => {
  const model = new ChatGoogle({
    model: "gemini-1.5-pro-latest",
    temperature: 0,
  });

  const audioBase64 = fileToBase64(audioPath);

  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("audio"),
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    audio: new HumanMessage({
      content: [
        // {
        //   type: "media",
        //   mimeType: audioMimeType,
        //   data: audioBase64,
        // },
        {
          type: "text",
          text: "Do you know this song? If so, who is the composer and can you give me a brief overview of the tone/tempo?",
        },
      ],
    }),
  });

  console.log(response.content)
  expect(typeof response.content).toBe("string");
  expect((response.content as string).length).toBeGreaterThan(15);
});

test.skip("Gemini can understand video", async () => {
  const model = new ChatGoogle({
    model: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  });

  const videoBase64 = fileToBase64(videoPath);

  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("video"),
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    video: new HumanMessage({
      content: [
        {
          type: "media",
          mimeType: videoMimeType,
          data: videoBase64,
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

test.skip("Gemini can use tools with audio", async () => {
  const audioBase64 = fileToBase64(audioPath);

  const tool = z.object({
    instruments: z
      .array(z.string())
      .describe("A list of instruments found in the audio."),
  });

  const model = new ChatGoogle({
    model: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  }).withStructuredOutput(tool, {
    name: "instruments_list_tool",
  });

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
          text: `The following audio is a song by Mozart. Respond with a list of instruments you hear in the song.
  
  Rules:
  Use the "instruments_list_tool" to return a list of tasks.`,
        },
      ],
    }),
  });

  expect(response.instruments).toBeTruthy();
  expect(response.instruments.length).toBeGreaterThan(0);
});

test.skip("Gemini can use tools with video", async () => {
  const videoBase64 = fileToBase64(videoPath);

  const tool = z.object({
    tasks: z.array(z.string()).describe("A list of tasks."),
  });

  const model = new ChatGoogle({
    model: "gemini-1.5-pro-preview-0409",
    temperature: 0,
  }).withStructuredOutput(tool, {
    name: "tasks_list_tool",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("video"),
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    video: new HumanMessage({
      content: [
        {
          type: "media",
          mimeType: videoMimeType,
          data: videoBase64,
        },
        {
          type: "text",
          text: `The following video is an overview of how to build datasets in LangSmith.
  Given the following video, come up with three tasks I should do to further improve my knowledge around using datasets in LangSmith.
  Only reference features that were outlined or described in the video.
  
  Rules:
  Use the "tasks_list_tool" to return a list of tasks.
  Your tasks should be tailored for an engineer who is looking to improve their knowledge around using datasets and evaluations, specifically with LangSmith.`,
        },
      ],
    }),
  });

  expect(response.tasks).toBeTruthy();
  expect(response.tasks.length).toBeGreaterThanOrEqual(3);
});
