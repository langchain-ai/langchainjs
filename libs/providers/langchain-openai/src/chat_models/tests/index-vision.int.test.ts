import fs from "node:fs/promises";
import url from "node:url";
import path from "node:path";

import { expect, test } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

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
  // @oxlint-disable-next-line/@typescript-eslint/ban-ts-comment
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
  // @oxlint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log({ res });
});

async function askAboutToolImage(
  useResponsesApi: boolean,
  responseMetadata: Record<string, unknown>
) {
  const imageData = await fs.readFile(
    path.join(__dirname, "../../tests/data/hotdog.jpg")
  );
  const model = new ChatOpenAI({
    model: "gpt-5.5",
    useResponsesApi,
    maxRetries: 0,
  }).bindTools([
    {
      type: "function",
      function: {
        name: "read_file",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
  ]);
  const res = await model.invoke([
    new SystemMessage(
      "Answer in one or two words. If you cannot see an image, answer 'unknown'."
    ),
    new HumanMessage("Read /food.jpg and tell me what food it shows."),
    new AIMessage({
      content: "",
      tool_calls: [
        { id: "call_1", name: "read_file", args: { path: "/food.jpg" } },
      ],
    }),
    new ToolMessage({
      tool_call_id: "call_1",
      content: [
        {
          type: "image",
          mimeType: "image/jpeg",
          data: imageData.toString("base64"),
        },
      ],
      response_metadata: responseMetadata,
    }),
  ]);
  expect(res.text.toLowerCase().replace(/[^a-z]/g, "")).toContain("hotdog");
}

test("model sees the image via Responses", async () => {
  await askAboutToolImage(true, {});
});

test("Chat Completions rejects images in tool messages", async () => {
  await expect(askAboutToolImage(false, {})).rejects.toThrow(
    /Chat Completions does not support images in tool messages/
  );
});

// TODO: Chat Completions v1 drops tool-result images; fixing it risks 400s on text-only OpenAI-compatible providers.
test.fails("model sees the image on the Chat Completions v1 path", async () => {
  await askAboutToolImage(false, { output_version: "v1" });
});

// TODO: Responses v1 turns ToolMessages into assistant messages; remove `.fails` once that is fixed.
test.fails("model sees the image on the Responses v1 path", async () => {
  await askAboutToolImage(true, { output_version: "v1" });
});
