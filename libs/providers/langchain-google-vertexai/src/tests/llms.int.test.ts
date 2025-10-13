import { describe, expect, test } from "vitest";
import {
  AIMessage,
  BaseMessage,
  HumanMessageChunk,
  MessageContentComplex,
} from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { VertexAI } from "../llms.js";

const imgData = {
  blueSquare:
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=",
};

const modelName = "gemini-2.0-flash";

describe("VertexAI LLM", () => {
  test("platform", async () => {
    const model = new VertexAI({
      modelName,
    });
    expect(model.platform).toEqual("gcp");
  });

  test("call", async () => {
    const model = new VertexAI({
      modelName,
    });
    const res = await model.invoke("1 + 1 = ");
    if (res.length === 1) {
      expect(res).toBe("2");
    } else {
      expect(res.length).toBeGreaterThan(0);
      // console.log("call result:", res);
    }
  });

  test("generate", async () => {
    const model = new VertexAI({
      model: modelName,
    });
    const res = await model.generate(["Print hello world."]);
    expect(res).toHaveProperty("generations");
    expect(res.generations.length).toBeGreaterThan(0);
    expect(res.generations[0].length).toBeGreaterThan(0);
    expect(res.generations[0][0]).toHaveProperty("text");
    // console.log("generate result:", JSON.stringify(res, null, 2));
  });

  test("stream", async () => {
    const model = new VertexAI({
      modelName,
    });
    const stream = await model.stream(
      "What is the answer to live, the universe, and everything? Be verbose."
    );
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("predictMessage image", async () => {
    const model = new VertexAI({
      model: modelName,
    });
    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${imgData.blueSquare}`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];
    const res = await model.predictMessages(messages);
    expect(Array.isArray(res.content)).toEqual(true);
    expect(res.content[0]).toHaveProperty("text");
    // console.log("res", res);
  });

  test("invoke image", async () => {
    const model = new VertexAI({
      modelName,
    });
    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${imgData.blueSquare}`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];
    const input = new ChatPromptValue(messages);
    const res = await model.invoke(input);
    expect(res).toBeDefined();
    expect(res.length).toBeGreaterThan(0);
    // console.log("res", res);
  });
});
