import { test } from "@jest/globals";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { ChatOpenAI } from "../openai.js";
import { HumanMessage } from "../../schema/index.js";

test("Test ChatOpenAI with a file", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imageData = await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"));
  const chat = new ChatOpenAI({
    modelName: "gpt-4-vision-preview",
    maxTokens: 1024,
  });
  const message = new HumanMessage({
    content: [
      {
        type: "text",
        text: "What's in this image?",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imageData.toString("base64")}`,
        },
      },
    ],
  });
  const res = await chat.invoke([message]);
  console.log({ res });
});

test("Test ChatOpenAI with a URL", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-4-vision-preview",
    maxTokens: 1024,
  });
  const message = new HumanMessage({
    content: [
      {
        type: "text",
        text: "What does this image say?",
      },
      {
        type: "image_url",
        image_url:
          "https://www.freecodecamp.org/news/content/images/2023/05/Screenshot-2023-05-29-at-5.40.38-PM.png",
      },
    ],
  });
  const res = await chat.invoke([message]);
  console.log({ res });
});
