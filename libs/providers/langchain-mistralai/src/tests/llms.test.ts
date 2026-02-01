import { test, expect, describe } from "vitest";
import { MistralAI } from "../llms.js";

test("Serialization", () => {
  const model = new MistralAI({
    apiKey: "foo",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","llms","mistralai","MistralAI"],"kwargs":{"mistral_api_key":{"lc":1,"type":"secret","id":["MISTRAL_API_KEY"]}}}`
  );
});

describe("useFim option", () => {
  test("useFim defaults to true for codestral-latest model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "codestral-latest",
    });
    expect(model.useFim).toBe(true);
  });

  test("useFim defaults to true for codestral-2405 model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "codestral-2405",
    });
    expect(model.useFim).toBe(true);
  });

  test("useFim defaults to true for default model (codestral-latest)", () => {
    const model = new MistralAI({
      apiKey: "foo",
    });
    expect(model.useFim).toBe(true);
  });

  test("useFim defaults to false for mistral-large-latest model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "mistral-large-latest",
    });
    expect(model.useFim).toBe(false);
  });

  test("useFim defaults to false for mistral-small-latest model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "mistral-small-latest",
    });
    expect(model.useFim).toBe(false);
  });

  test("useFim defaults to false for open-mistral-7b model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "open-mistral-7b",
    });
    expect(model.useFim).toBe(false);
  });

  test("useFim can be explicitly set to false for codestral model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "codestral-latest",
      useFim: false,
    });
    expect(model.useFim).toBe(false);
  });

  test("useFim can be explicitly set to true for non-codestral model", () => {
    const model = new MistralAI({
      apiKey: "foo",
      model: "mistral-large-latest",
      useFim: true,
    });
    expect(model.useFim).toBe(true);
  });
});
