import fs from "node:fs/promises";
import url from "node:url";
import path from "node:path";

import { test } from "vitest";
import { HumanMessage } from "@langchain/core/messages";

import { ChatOpenAI } from "../index.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Test ChatOpenAI with a file", async () => {
  const imageData = await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"));
  const chat = new ChatOpenAI({
    model: "gpt-4o-mini",
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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log({ res });
});

test("Test ChatOpenAI with a URL", async () => {
  const chat = new ChatOpenAI({
    model: "gpt-4o-mini",
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
          url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
        },
      },
    ],
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log({ res });
});
