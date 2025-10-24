import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";
import { z } from "zod";

function fileToBase64(filePath: string): string {
  return fs.readFileSync(filePath, "base64");
}

const mozartMp3File = "Mozart_Requiem_D_minor.mp3";
const mozartInBase64 = fileToBase64(mozartMp3File);

const tool = z.object({
  instruments: z
    .array(z.string())
    .describe("A list of instruments found in the audio."),
});

const model = new ChatVertexAI({
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
        mimeType: "audio/mp3",
        data: mozartInBase64,
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

console.log("response", response);
/*
response {
  instruments: [
    'violin',   'viola',
    'cello',    'double bass',
    'flute',    'oboe',
    'clarinet', 'bassoon',
    'horn',     'trumpet',
    'timpani'
  ]
}
*/
