import { expect, test } from "@jest/globals";
import { GoogleVertexAI } from "../googlevertexai/index.js";

describe("Vertex AI", () => {
  test("Test Google Vertex", async () => {
    const model = new GoogleVertexAI({ maxOutputTokens: 50 });
    const res = await model.invoke("1 + 1 = ");
    // console.log({ res });
  });

  test("Test Google Vertex generation", async () => {
    const model = new GoogleVertexAI({ maxOutputTokens: 50 });
    const res = await model.generate(["1 + 1 = "]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("Test Google Vertex generation", async () => {
    const model = new GoogleVertexAI({ maxOutputTokens: 50 });
    const res = await model.generate(["Print hello world."]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("Test Google Vertex generation", async () => {
    const model = new GoogleVertexAI({ maxOutputTokens: 50 });
    const res = await model.generate([
      `Translate "I love programming" into Korean.`,
    ]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("Test Google Vertex Codey gecko model", async () => {
    const model = new GoogleVertexAI({ model: "code-gecko" });
    expect(model.model).toEqual("code-gecko");
    expect(model.temperature).toEqual(0.2);
    expect(model.maxOutputTokens).toEqual(64);

    const res = await model.invoke("for( let co = 0");
    // console.log(res);
  });

  test("Test Google Vertex Codey bison model", async () => {
    const model = new GoogleVertexAI({
      model: "code-bison",
      maxOutputTokens: 2048,
    });
    expect(model.model).toEqual("code-bison");

    const res = await model.invoke("Count to 10 in JavaScript.");
    // console.log(res);
  });

  test("Test Google Vertex bison-32k model", async () => {
    const model = new GoogleVertexAI({
      model: "text-bison-32k",
      maxOutputTokens: 50,
    });
    const res = await model.invoke("1 + 1 = ");
    // console.log({ res });
  });

  test("streaming text", async () => {
    const model = new GoogleVertexAI({
      model: "text-bison",
      maxOutputTokens: 2048,
    });

    const stream = await model.stream(
      "What is the answer to life, the universe, and everything. Be Verbose."
    );
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
      // console.log("chunk", chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[chunks.length - 1]).toEqual("");
  });
});
