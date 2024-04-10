import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";

function fileToBase64(filePath: string): string {
  const fileData = fs.readFileSync(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

const mozartMp3File = "Mozart_Requiem_D_minor.mp3";
const mozartInBase64 = fileToBase64(mozartMp3File);

const model = new ChatVertexAI({
  model: "gemini-1.5-pro-preview-0409",
  temperature: 0,
});

const mozartPrompt = `The following audio is a song by Mozart. Respond with a list of instruments you hear in the song.

Rules:
Respond ONLY with an array of strings, with each string being a single task.
Do NOT include any additional content or text besides the array.`;

const prompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("audio"),
]);

const chain = prompt.pipe(model);
const response = await chain.invoke({
  audio: new HumanMessage({
    content: [
      {
        type: "media",
        mimeType: "audio/mp3",
        data: mozartInBase64,
      },
      {
        type: "text",
        text: mozartPrompt,
      },
    ],
  }),
});

console.log("response", response.content);
/*
response [
 "violin",
 "viola",
 "cello",
 "double bass"
]
*/
