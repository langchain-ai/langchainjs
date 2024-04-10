import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";

function fileToBase64(filePath: string): string {
  const fileData = fs.readFileSync(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

const lanceLsEvalsVideo = "lance_ls_eval_video.mp4";
const lanceInBase64 = fileToBase64(lanceLsEvalsVideo);

const model = new ChatVertexAI({
  model: "gemini-1.5-pro-preview-0409",
  temperature: 0,
});

const lancePrompt = `The following video is an overview of how to build datasets in LangSmith.
Given the following video, come up with three tasks I should do to further improve my knowledge around using datasets in LangSmith.

Rules:
Respond ONLY with an array of strings, with each string being a single task.
Do NOT include any additional content or text besides the array.`;

const prompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("video"),
]);

const chain = prompt.pipe(model);
const response = await chain.invoke({
  video: new HumanMessage({
    content: [
      {
        type: "media",
        mimeType: "video/mp4",
        data: lanceInBase64,
      },
      {
        type: "text",
        text: lancePrompt,
      },
    ],
  }),
});

console.log("response", response.content);
/*
response [
  "Explore the different dataset types available in LangSmith, such as key-value, chat, and LLM datasets, and understand their specific use cases and structures.",
  "Learn how to use the LangSmith SDK to create, edit, and manage datasets programmatically, allowing for automation and integration with other tools.",
  "Investigate the versioning capabilities of LangSmith datasets and understand how to track changes, revert to previous versions, and collaborate effectively on dataset development."
]
*/