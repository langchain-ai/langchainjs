import { expect, test } from "vitest";
import {
  getModelBehavior,
  translateModelParams,
} from "../utils/model_behavior.js";

test("router names do not select model-family policies", () => {
  for (const model of [
    "dynamic/gemma-llama-mistral",
    "cloudflare/auto",
    "unknown",
  ]) {
    expect(getModelBehavior(model)).toMatchObject({
      structuredJson: false,
      embedToolCalls: false,
      reasoning: false,
      unsupportedParams: [],
    });
  }
});

test("GLM 5 policies take precedence over the legacy GLM restrictions", () => {
  const params = { max_tokens: 50, repetition_penalty: 1.2, top_k: 20 };
  expect(translateModelParams("glm-4.7-flash", params)).toEqual({ top_k: 20 });
  for (const model of ["glm-5.2", "GLM-5.3-FLASH"])
    expect(translateModelParams(model, params)).toEqual(params);
  expect(params.max_tokens).toBe(50);
});

test("native schemas are unwrapped and Mistral uses guided_json", () => {
  const schema = { type: "object", properties: { answer: { type: "string" } } };
  const params = {
    response_format: {
      type: "json_schema",
      json_schema: { name: "answer", schema },
    },
    tool_choice: "required",
  };
  expect(translateModelParams("gpt-oss", params)).toEqual({
    response_format: { type: "json_schema", json_schema: schema },
    tool_choice: "required",
  });
  expect(translateModelParams("mistral", params)).toEqual({
    guided_json: schema,
  });
  expect(
    translateModelParams("mistral", {
      response_format: { type: "json_object" },
    })
  ).toEqual({ guided_json: {} });
  expect(params.response_format.json_schema).toEqual({
    name: "answer",
    schema,
  });
});
