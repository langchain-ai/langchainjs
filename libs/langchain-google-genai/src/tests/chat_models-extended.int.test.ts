/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

const baseSchema = z.object({
  name: z.string(),
  age: z.number(),
});

test("Google AI - Generate structured output without errors", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(baseSchema);
  const request = "Generate a structured response for a user.";
  const result = await structuredLlm.invoke(request);
  console.log("Valid Schema Result:", result);
  expect(result).toBeDefined();
  expect(result).toHaveProperty("name");
  expect(result).toHaveProperty("age");
});

test("Google AI - Validate nested schema structures", async () => {
  const schema = z.object({
    name: z.string(),
    details: z.object({
      age: z.number(),
      address: z.string(),
    }),
  });
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(schema);
  const request = "Generate structured data with nested schema.";
  const result = await structuredLlm.invoke(request);
  console.log("Nested Schema Result:", result);
  expect(result).toBeDefined();
  expect(result.details).toHaveProperty("age");
  expect(result.details).toHaveProperty("address");
});

test("Google AI - Handle optional fields in schema", async () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().optional(),
  });
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(schema);
  const request = "Generate structured data with optional fields.";
  const result = await structuredLlm.invoke(request);
  console.log("Optional Fields Result:", result);
  expect(result).toBeDefined();
  expect(result).toHaveProperty("name");
  expect(result).toHaveProperty("age");
  expect(result).toHaveProperty("email");
});

test("Google AI - Validate schema with large payloads", async () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
  });
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(schema);
  const request = "Generate structured data for a user with many fields.";
  const result = await structuredLlm.invoke(request);
  console.log("Large Payload Result:", result);
  expect(result).toBeDefined();
  expect(result).toHaveProperty("name");
  expect(result).toHaveProperty("age");
  expect(result).toHaveProperty("address");
  expect(result).toHaveProperty("phone");
  expect(result).toHaveProperty("email");
});

test("Google AI - Handle schema with deeply nested structures", async () => {
  const schema = z.object({
    user: z.object({
      id: z.string(),
      profile: z.object({
        details: z.object({
          name: z.string(),
          age: z.number(),
          preferences: z.object({
            favoriteColor: z.string(),
            hobbies: z.array(z.string()),
          }),
        }),
      }),
    }),
  });
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(schema);
  const request = "Generate a deeply nested user profile structure.";
  const result = await structuredLlm.invoke(request);
  console.log("Deeply Nested Schema Result:", result);
  expect(result).toBeDefined();
  expect(result.user.profile.details.preferences).toHaveProperty(
    "favoriteColor"
  );
  expect(Array.isArray(result.user.profile.details.preferences.hobbies)).toBe(
    true
  );
});

test("Google AI - Handle schema with enum fields", async () => {
  const schema = z.object({
    name: z.string(),
    role: z.enum(["admin", "editor", "viewer"]),
  });
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(schema);
  const request =
    "Generate structured data with a name and a role (admin, editor, or viewer).";
  const result = await structuredLlm.invoke(request);
  console.log("Enum Fields Result:", result);
  expect(result).toBeDefined();
  expect(result).toHaveProperty("name");
  expect(result).toHaveProperty("role");
  expect(["admin", "editor", "viewer"]).toContain(result.role);
});

test("Google AI - Handle JSON schema", async () => {
  const schema = {
    type: "object",
    additionalProperties: false,
    strict: true,
    properties: {
      reasoning: {
        type: "string",
        description:
          "A human-readable explanation of the score. You MUST end the reasoning with a sentence that says: Thus, the score should be: SCORE_YOU_ASSIGN.",
      },
      score: {
        type: "number",
        description:
          "A number that represents the degree to which the criteria in the prompt are met, from 0.0 to 1.0. 1.0 means the criteria are met perfectly. 0.0 means none of the criteria are met, 0.5 means exactly half of the criteria are met.",
      },
    },
    required: ["reasoning", "score"],
  };
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
  });
  const structuredLlm = model.withStructuredOutput(schema);
  const request = "Is the following correct?\nThe earth is flat.";
  const result = await structuredLlm.invoke(request);
  expect(result).toBeDefined();
  expect(result).toHaveProperty("reasoning");
  expect(result).toHaveProperty("score");
});
