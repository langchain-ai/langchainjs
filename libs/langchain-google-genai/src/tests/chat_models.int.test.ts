import { test } from "@jest/globals";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

test("Test Google AI", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const res = await model.invoke("what is 1 + 1?");
  console.log({ res });
  expect(res).toBeTruthy();
});

test("Test Google AI generation", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const res = await model.generate([
    [["human", `Translate "I love programming" into Korean.`]],
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test("Test Google AI generation with a stop sequence", async () => {
  const model = new ChatGoogleGenerativeAI({
    stopSequences: ["two", "2"],
  });
  const res = await model.invoke([
    ["human", `What are the first three positive whole numbers?`],
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
  expect(res.additional_kwargs.finishReason).toBe("STOP");
  expect(res.content).not.toContain("2");
  expect(res.content).not.toContain("two");
});

test("Test Google AI generation with a system message", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const res = await model.generate([
    [
      ["system", `You are an amazing translator.`],
      ["human", `Translate "I love programming" into Korean.`],
    ],
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test("Test Google AI multimodal generation", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imageData = (
    await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"))
  ).toString("base64");
  const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-pro-vision",
  });
  const res = await model.invoke([
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "Describe the following image:",
        },
        {
          type: "image_url",
          image_url: `data:image/png;base64,${imageData}`,
        },
      ],
    }),
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});
