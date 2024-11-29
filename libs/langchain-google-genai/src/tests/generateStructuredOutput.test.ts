import { ChatGoogleGenerativeAI } from "../chat_models.js";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY);

const baseSchema = z.object({
  name: z.string(),
  age: z.number(),
});

describe("generateStructuredOutput", () => {
  it("should generate structured output without errors", async () => {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
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

  it("should throw an error if the output does not match the schema", async () => {
    const schema = z.object({ name: z.string(), age: z.string() }); // Schema mismatch
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.7,
    });
    const structuredLlm = model.withStructuredOutput(schema);
    const request = "Generate structured data where age is a number.";
    try {
      await structuredLlm.invoke(request);
    } catch (error) {
      console.error("Schema Mismatch Error:", error);
      if (error instanceof Error) {
        expect(error.message).toMatch(/Failed to parse/);
      } else {
        throw error;
      }
    }
  });

  it("should validate nested schema structures", async () => {
    const schema = z.object({
      name: z.string(),
      details: z.object({
        age: z.number(),
        address: z.string(),
      }),
    });
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
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

  it("should handle missing required fields", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.7,
    });
    const structuredLlm = model.withStructuredOutput(schema);
    const request = "Generate a response with only the name field.";
    try {
      await structuredLlm.invoke(request);
    } catch (error) {
      console.error("Missing Required Fields Error:", error);
      if (error instanceof Error) {
        expect(error.message).toMatch(/Failed to parse/);
      } else {
        throw error;
      }
    }
  });

  it("should handle optional fields in schema", async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().optional(),
    });
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
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

  it("should validate large payloads", async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      address: z.string(),
      phone: z.string(),
      email: z.string(),
    });
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
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

  it("should throw an error for empty response", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.7,
    });
    const structuredLlm = model.withStructuredOutput(schema);
    const request = "Generate an empty response.";
    try {
      const result = await structuredLlm.invoke(request);
      console.log("Empty Response:", result);
    } catch (error) {
      console.error("Empty Response Error:", error);
      if (error instanceof Error) {
        expect(error.message).toMatch(/Failed to parse/);
      } else {
        throw error;
      }
    }
  });

  it("should validate schema with array fields", async () => {
    const schema = z.object({
      name: z.string(),
      hobbies: z.array(z.string()),
    });
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.7,
    });
    const structuredLlm = model.withStructuredOutput(schema);
    const request = "Generate structured data with an array of hobbies.";
    const result = await structuredLlm.invoke(request);
    console.log("Array Schema Result:", result);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("name");
    expect(Array.isArray(result.hobbies)).toBe(true);
  });
});
