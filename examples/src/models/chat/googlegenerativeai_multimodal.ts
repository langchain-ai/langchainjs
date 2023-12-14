import fs from "fs";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

// Multi-modal
const vision = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro-vision",
  maxOutputTokens: 2048,
});
const image = fs.readFileSync("./hotdog.jpg").toString("base64");
const input2 = [
  new HumanMessage({
    content: [
      {
        type: "text",
        text: "Describe the following image.",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${image}`,
      },
    ],
  }),
];

const res2 = await vision.invoke(input2);

console.log(res2);

/*
  AIMessage {
    content: ' The image shows a hot dog in a bun. The hot dog is grilled and has a dark brown color. The bun is toasted and has a light brown color. The hot dog is in the center of the bun.',
    name: 'model',
    additional_kwargs: {}
  }
*/

// Multi-modal streaming
const res3 = await vision.stream(input2);

for await (const chunk of res3) {
  console.log(chunk);
}

/*
  AIMessageChunk {
    content: ' The image shows a hot dog in a bun. The hot dog is grilled and has grill marks on it. The bun is toasted and has a light golden',
    name: 'model',
    additional_kwargs: {}
  }
  AIMessageChunk {
    content: ' brown color. The hot dog is in the center of the bun.',
    name: 'model',
    additional_kwargs: {}
  }
*/
