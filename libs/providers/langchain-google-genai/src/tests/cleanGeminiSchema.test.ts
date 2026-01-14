import { cleanGeminiSchema } from "../cleanGeminiSchema";

describe("cleanGeminiSchema", () => {
  it("removes propertyNames from schema", () => {
    const schema = {
      type: "object",
      propertyNames: {
        pattern: "^[a-zA-Z]+$",
      },
      properties: {
        name: { type: "string" },
      },
    };

    const cleaned = cleanGeminiSchema(schema as any);

    expect(cleaned.propertyNames).toBeUndefined();
    expect(cleaned.properties).toBeDefined();
  });

  it("removes patternProperties from schema", () => {
    const schema = {
      type: "object",
      patternProperties: {
        "^S_": { type: "string" },
      },
      properties: {
        id: { type: "number" },
      },
    };

    const cleaned = cleanGeminiSchema(schema as any);

    expect(cleaned.patternProperties).toBeUndefined();
    expect(cleaned.properties).toBeDefined();
  });

  it("does not modify schema without unsupported fields", () => {
    const schema = {
      type: "object",
      properties: {
        age: { type: "number" },
      },
    };

    const cleaned = cleanGeminiSchema(schema as any);

    expect(cleaned).toEqual(schema);
  });
});
