import { test } from "@jest/globals";
import { GoogleLLM } from "../llms.js";

describe("GAuth LLM", () => {
  test("platform", async () => {
    const model = new GoogleLLM();
    expect(model.platform).toEqual("gcp");
  });

  test("call", async () => {
    const model = new GoogleLLM();
    try {
      const res = await model.call("1 + 1 = ");
      if (res.length === 1) {
        expect(res).toBe("2");
      } else {
        expect(res.length).toBeGreaterThan(0);
        console.log("call result:", res);
      }
    } catch (xx) {
      console.error(xx);
      throw xx;
    }
  });

  test("generate", async () => {
    const model = new GoogleLLM();
    const res = await model.generate(["Print hello world."]);
    expect(res).toHaveProperty("generations");
    expect(res.generations.length).toBeGreaterThan(0);
    expect(res.generations[0].length).toBeGreaterThan(0);
    expect(res.generations[0][0]).toHaveProperty("text");
    console.log("generate result:", JSON.stringify(res, null, 2));
  });

  test("stream", async () => {
    const model = new GoogleLLM();
    const stream = await model.stream(
      "What is the answer to live, the universe, and everything? Be verbose."
    );
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("GAuth LLM gai", () => {
  test("platform", async () => {
    const model = new GoogleLLM({
      platformType: "gai",
    });
    expect(model.platform).toEqual("gai");
  });

  test("call", async () => {
    const model = new GoogleLLM({
      platformType: "gai",
    });
    try {
      const res = await model.call("1 + 1 = ");
      if (res.length === 1) {
        expect(res).toBe("2");
      } else {
        expect(res.length).toBeGreaterThan(0);
        console.log("call result:", res);
      }
    } catch (xx) {
      console.error(xx);
      throw xx;
    }
  });

  test("generate", async () => {
    const model = new GoogleLLM({
      platformType: "gai",
    });
    const res = await model.generate(["Print hello world."]);
    expect(res).toHaveProperty("generations");
    expect(res.generations.length).toBeGreaterThan(0);
    expect(res.generations[0].length).toBeGreaterThan(0);
    expect(res.generations[0][0]).toHaveProperty("text");
    console.log("generate result:", JSON.stringify(res, null, 2));
  });

  test("stream", async () => {
    const model = new GoogleLLM({
      platformType: "gai",
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
});
