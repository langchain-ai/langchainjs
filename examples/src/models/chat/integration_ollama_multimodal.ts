import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { HumanMessage } from "@langchain/core/messages";
import * as fs from "node:fs/promises";

const imageData = await fs.readFile("./hotdog.jpg");
const chat = new ChatOllama({
  model: "llava",
  baseUrl: "http://127.0.0.1:11434",
});
const res = await chat.invoke([
  new HumanMessage({
    content: [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/jpeg;base64,${imageData.toString("base64")}`,
      },
    ],
  }),
]);
console.log(res);

/*
  AIMessage {
    content: ' The image shows a hot dog with ketchup on it, placed on top of a bun. It appears to be a close-up view, possibly taken in a kitchen setting or at an outdoor event.',
    name: undefined,
    additional_kwargs: {}
  }
*/
