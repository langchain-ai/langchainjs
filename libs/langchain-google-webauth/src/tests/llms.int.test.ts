import { test } from "@jest/globals";
import { GoogleLLM } from "../llms.js";

describe("Google APIKey LLM", () => {
  test("platform", async () => {
    const model = new GoogleLLM();
    expect(model.platform).toEqual("gai");
  });

  test("call", async () => {
    const model = new GoogleLLM();
    const res = await model.call("1 + 1 = ");
    if (res.length === 1) {
      expect(res).toBe("2");
    } else {
      expect(res.length).toBeGreaterThan(0);
      console.log("call result:", res);
    }
  });
});

describe("Google WebAuth LLM", () => {
  test("platform", async () => {
    const model = new GoogleLLM();
    expect(model.platform).toEqual("gcp");
  });

  test("call", async () => {
    const model = new GoogleLLM();
    const res = await model.call("1 + 1 = ");
    if (res.length === 1) {
      expect(res).toBe("2");
    } else {
      expect(res.length).toBeGreaterThan(0);
      console.log("call result:", res);
    }
  });
});

describe("Google WebAuth gai LLM", () => {
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
    const res = await model.call("1 + 1 = ");
    if (res.length === 1) {
      expect(res).toBe("2");
    } else {
      expect(res.length).toBeGreaterThan(0);
      console.log("call result:", res);
    }
  });
});
