import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatVertexAI } from "@langchain/google-vertexai";
import fs from "node:fs";

const model = new ChatVertexAI({
  model: "gemini-pro-vision",
  temperature: 0.7,
});

const image = fs.readFileSync("./hotdog.jpg").toString("base64");
const prompt = ChatPromptTemplate.fromMessages([
  [
    "human",
    [
      {
        type: "text",
        text: "Describe the following image.",
      },
      {
        type: "image_url",
        image_url: "data:image/png;base64,{image_base64}",
      },
    ],
  ],
]);

const response = await prompt.pipe(model).invoke({
  image_base64: image,
});

console.log(response.content);
/*
This is an image of a hot dog. The hot dog is on a white background. The hot dog is a grilled sausage in a bun.
*/
