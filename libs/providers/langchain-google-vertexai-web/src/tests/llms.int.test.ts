import { test } from "@jest/globals";
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

describe("Google APIKey LLM", () => {
  test("platform", async () => {
    const model = new VertexAI();
    expect(model.platform).toEqual("gcp");
  });

  test("invoke", async () => {
    const model = new VertexAI();
    const res = await model.invoke("If the time is 1:00, what time is it?");
    expect(res.length).toBeGreaterThan(0);
    expect(typeof res === "string").toBeTruthy();
  });

  test("stream", async () => {
    const model = new VertexAI();
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
      model: "gemini-1.5-flash",
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
    expect(res).toBeInstanceOf(AIMessage);
    expect(Array.isArray(res.content)).toEqual(true);
    expect(res.content[0]).toHaveProperty("text");
    // console.log("res", res);
  });

  test("invoke image", async () => {
    const model = new VertexAI({
      model: "gemini-pro-vision",
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
