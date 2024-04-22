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

const lanceLsEvalsVideo = "lance_ls_eval_video.mp4";
const lanceInBase64 = fileToBase64(lanceLsEvalsVideo);

const tool = z.object({
  tasks: z.array(z.string()).describe("A list of tasks."),
});

const model = new ChatVertexAI({
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
        mimeType: "video/mp4",
        data: lanceInBase64,
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

console.log("response", response);
/*
response {
  tasks: [
    'Explore the LangSmith SDK documentation for in-depth understanding of dataset creation, manipulation, and versioning functionalities.',
    'Experiment with different dataset types like Key-Value, Chat, and LLM to understand their structures and use cases.',
    'Try uploading a CSV file containing question-answer pairs to LangSmith and create a new dataset from it.'
  ]
}
*/
