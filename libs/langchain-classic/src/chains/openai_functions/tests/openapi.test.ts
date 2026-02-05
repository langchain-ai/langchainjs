import { test, expect } from "vitest";

import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import {
  type JsonSchema7StringType,
  type JsonSchema7NumberType,
  type JsonSchema7ObjectType,
  type JsonSchema7ArrayType,
  type JsonSchema7Type,
} from "@langchain/core/utils/json_schema";
import { OpenAPISpec } from "../../../util/openapi.js";
import { convertOpenAPISchemaToJSONSchema } from "../openapi.js";

test("Test convert OpenAPI params to JSON Schema", async () => {
  const spec = new OpenAPISpec({
    openapi: "3.1.0",
    info: {
      title: "A fake spec for testing",
      version: "0.0.1",
    },
    paths: {
      "/widgets": {
        post: {
          operationId: "createWidget",
          description: "Create a widget",
          parameters: [
            {
              name: "stringParam",
              in: "query",
              schema: {
                type: "string",
              },
            },
            {
              name: "objectParam",
              in: "query",
              schema: {
                type: "object",
                properties: {
                  foo: {
                    type: "string",
                  },
                  bar: {
                    type: "number",
                  },
                },
              },
            },
            {
              name: "objectParamWithRequiredFields",
              in: "query",
              schema: {
                type: "object",
                required: ["fooRequired"],
                properties: {
                  fooRequired: {
                    type: "string",
                  },
                },
              },
            },
            {
              name: "stringArrayParam",
              in: "query",
              schema: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            {
              name: "refParam",
              in: "query",
              schema: {
                $ref: "#/components/schemas/RefObject",
              },
            },
            {
              name: "refArrayParam",
              in: "query",
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/RefObject" },
              },
            },
            {
              name: "nestedObjectInArrayParam",
              in: "query",
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    baz: {
                      type: "number",
                    },
                  },
                },
              },
            },
            {
              name: "nestedArrayInObjectParam",
              in: "query",
              schema: {
                type: "object",
                properties: {
                  qux: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
            },
            {
              name: "inceptionParam",
              in: "query",
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nestedArray: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          nestedObject: {
                            type: "object",
                            properties: {
                              inception: {
                                type: "number",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              name: "anyOfParam",
              in: "query",
              schema: {
                anyOf: [
                  { $ref: "#/components/schemas/RefObject" },
                  { type: "number" },
                ],
              },
            },
            {
              name: "anyOfArrayParam",
              in: "query",
              schema: {
                type: "array",
                items: {
                  anyOf: [
                    { $ref: "#/components/schemas/RefObject" },
                    { type: "string" },
                  ],
                },
              },
            },
            {
              name: "allOfParam",
              in: "query",
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/RefObject" },
                  {
                    type: "object",
                    properties: {
                      baz: {
                        type: "string",
                      },
                    },
                  },
                ],
              },
            },
            {
              name: "allOfArrayParam",
              in: "query",
              schema: {
                type: "array",
                items: {
                  allOf: [
                    {
                      type: "object",
                      properties: {
                        foo: {
                          type: "number",
                        },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        bar: {
                          type: "string",
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              name: "oneOfParam",
              in: "query",
              schema: {
                oneOf: [
                  { type: "string" },
                  { type: "number" },
                  { $ref: "#/components/schemas/RefObject" },
                ],
              },
            },
            {
              name: "oneOfArrayParam",
              in: "query",
              schema: {
                type: "array",
                items: {
                  oneOf: [
                    {
                      type: "string",
                    },
                    {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },
                  ],
                },
              },
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    properties: {
                      success: {
                        type: "boolean",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        RefObject: {
          type: "object",
          properties: {
            foo: {
              type: "string",
            },
            bar: {
              type: "number",
            },
          },
        },
      },
    },
  });

  const createWidget = spec.getOperation(
    "/widgets",
    OpenAPIV3.HttpMethods.POST
  );
  expect(createWidget).not.toBeUndefined();
  if (!createWidget) {
    throw new Error(`Operation not found`);
  }

  function getParamSchema(
    operation: OpenAPIV3_1.OperationObject,
    paramName: string
  ) {
    const param = spec
      .getParametersForOperation(operation)
      .find((param) => param.name === paramName);
    if (!param) {
      throw new Error(`Param not found`);
    }
    if (!param.schema) {
      throw new Error(`Param schema not found`);
    }
    return spec.getSchema(param.schema);
  }

  type TypeMap = {
    string: JsonSchema7StringType;
    number: JsonSchema7NumberType;
    object: JsonSchema7ObjectType;
    array: JsonSchema7ArrayType;
  };

  function expectType<T extends keyof TypeMap>(
    type: T,
    schema: JsonSchema7Type | undefined
  ): TypeMap[T] {
    if (!schema || !("type" in schema)) {
      throw new Error(`Schema has no type`);
    }
    if (schema.type !== type) {
      throw new Error(`Unexpected type: ${schema.type}`);
    }
    return schema as TypeMap[T];
  }

  function expectComposition(
    compositionType: "anyOf" | "allOf" | "oneOf",
    schema: JsonSchema7Type | undefined
  ): {
    [compositionType]: JsonSchema7Type[];
  } {
    if (
      !schema ||
      Object.keys(schema).length !== 1 ||
      !(compositionType in schema)
    ) {
      throw new Error(`Schema has no ${compositionType}`);
    }

    return schema as {
      [compositionType]: JsonSchema7Type[];
    };
  }

  const stringParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "stringParam"),
    spec
  );
  expectType("string", stringParamSchema);

  const objectParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "objectParam"),
    spec
  );
  const typedObjectParamSchema = expectType("object", objectParamSchema);
  expectType("string", typedObjectParamSchema.properties.foo);
  expectType("number", typedObjectParamSchema.properties.bar);

  const objectParamWithRequiredFieldSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "objectParamWithRequiredFields"),
    spec
  ) as JsonSchema7ObjectType;
  expect(objectParamWithRequiredFieldSchema.required).toContain("fooRequired");

  const stringArrayParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "stringArrayParam"),
    spec
  );
  const typedStringArrayParamSchema = expectType(
    "array",
    stringArrayParamSchema
  );
  expect(typedStringArrayParamSchema.items).not.toBeUndefined();
  expectType("string", typedStringArrayParamSchema.items);

  const refParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "refParam"),
    spec
  );
  const typedRefParamSchema = expectType("object", refParamSchema);
  expectType("string", typedRefParamSchema.properties.foo);
  expectType("number", typedRefParamSchema.properties.bar);

  const refArrayParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "refArrayParam"),
    spec
  );
  const typedRefArrayParamSchema = expectType("array", refArrayParamSchema);
  const typedRefArrayParamSchemaItems = expectType(
    "object",
    typedRefArrayParamSchema.items
  );
  expectType("string", typedRefArrayParamSchemaItems.properties.foo);
  expectType("number", typedRefArrayParamSchemaItems.properties.bar);

  const nestedObjectInArrayParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "nestedObjectInArrayParam"),
    spec
  );
  expectType(
    "number",
    expectType(
      "object",
      expectType("array", nestedObjectInArrayParamSchema).items
    ).properties.baz
  );

  const nestedArrayInObjectParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "nestedArrayInObjectParam"),
    spec
  );
  expectType(
    "string",
    expectType(
      "array",
      expectType("object", nestedArrayInObjectParamSchema).properties.qux
    ).items
  );

  const inceptionParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "inceptionParam"),
    spec
  );
  expectType(
    "number",
    expectType(
      "object",
      expectType(
        "object",
        expectType(
          "array",
          expectType("object", expectType("array", inceptionParamSchema).items)
            .properties.nestedArray
        ).items
      ).properties.nestedObject
    ).properties.inception
  );

  const anyOfParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "anyOfParam"),
    spec
  );
  const typedAnyOfParamSchema = expectComposition("anyOf", anyOfParamSchema);
  const typedAnyOfParamSchemaItem1 = expectType(
    "object",
    typedAnyOfParamSchema.anyOf[0]
  );
  expectType("string", typedAnyOfParamSchemaItem1.properties.foo);
  expectType("number", typedAnyOfParamSchemaItem1.properties.bar);
  expectType("number", typedAnyOfParamSchema.anyOf[1]);

  const anyOfArrayParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "anyOfArrayParam"),
    spec
  );
  const typedAnyOfArrayParamSchema = expectType("array", anyOfArrayParamSchema);
  const typedAnyOfArrayParamSchemaItems = expectComposition(
    "anyOf",
    typedAnyOfArrayParamSchema.items
  );
  const typedAnyOfArrayParamSchemaItem1 = expectType(
    "object",
    typedAnyOfArrayParamSchemaItems.anyOf[0]
  );
  expectType("string", typedAnyOfArrayParamSchemaItem1.properties.foo);
  expectType("number", typedAnyOfArrayParamSchemaItem1.properties.bar);
  expectType("string", typedAnyOfArrayParamSchemaItems.anyOf[1]);

  const allOfParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "allOfParam"),
    spec
  );
  const typedAllOfParamSchema = expectComposition("allOf", allOfParamSchema);
  const typedAllOfParamSchemaItem1 = expectType(
    "object",
    typedAllOfParamSchema.allOf[0]
  );
  expectType("string", typedAllOfParamSchemaItem1.properties.foo);
  expectType("number", typedAllOfParamSchemaItem1.properties.bar);
  const typedAllOfParamSchemaItem2 = expectType(
    "object",
    typedAllOfParamSchema.allOf[1]
  );
  expectType("string", typedAllOfParamSchemaItem2.properties.baz);

  const oneOfParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "oneOfParam"),
    spec
  );
  const typedOneOfParamSchema = expectComposition("oneOf", oneOfParamSchema);
  expectType("string", typedOneOfParamSchema.oneOf[0]);
  expectType("number", typedOneOfParamSchema.oneOf[1]);
  const typedOneOfParamSchemaItem3 = expectType(
    "object",
    typedOneOfParamSchema.oneOf[2]
  );
  expectType("string", typedOneOfParamSchemaItem3.properties.foo);
  expectType("number", typedOneOfParamSchemaItem3.properties.bar);

  const allOfArrayParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "allOfArrayParam"),
    spec
  );
  const typedAllOfArrayParamSchema = expectType("array", allOfArrayParamSchema);
  const typedAllOfArrayParamSchemaItems = expectComposition(
    "allOf",
    typedAllOfArrayParamSchema.items
  );
  const typedAllOfArrayParamSchemaItem1 = expectType(
    "object",
    typedAllOfArrayParamSchemaItems.allOf[0]
  );
  expectType("number", typedAllOfArrayParamSchemaItem1.properties.foo);
  const typedAllOfArrayParamSchemaItem2 = expectType(
    "object",
    typedAllOfArrayParamSchemaItems.allOf[1]
  );
  expectType("string", typedAllOfArrayParamSchemaItem2.properties.bar);

  const oneOfArrayParamSchema = convertOpenAPISchemaToJSONSchema(
    getParamSchema(createWidget, "oneOfArrayParam"),
    spec
  );
  const typedOneOfArrayParamSchema = expectType("array", oneOfArrayParamSchema);
  const typedOneOfArrayParamSchemaItems = expectComposition(
    "oneOf",
    typedOneOfArrayParamSchema.items
  );
  expectType("string", typedOneOfArrayParamSchemaItems.oneOf[0]);
  const typedOneOfArrayParamSchemaItem2 = expectType(
    "array",
    typedOneOfArrayParamSchemaItems.oneOf[1]
  );
  expectType("string", typedOneOfArrayParamSchemaItem2.items);
});

test("Parent required should not include child due to child's internal required", async () => {
  const spec = new OpenAPISpec({
    openapi: "3.1.0",
    info: { title: "Spec for required propagation test", version: "0.0.1" },
    paths: {},
  });

  const parentSchema: OpenAPIV3_1.SchemaObject = {
    type: "object",
    required: ["a"],
    properties: {
      a: { type: "string" },
      b: {
        type: "object",
        required: ["y"],
        properties: {
          x: { type: "string" },
          y: { type: "number" },
        },
      },
    },
  };

  const jsonSchema = convertOpenAPISchemaToJSONSchema(
    parentSchema,
    spec
  ) as JsonSchema7ObjectType;

  // Parent should only require 'a'
  expect(jsonSchema.type).toBe("object");
  expect(jsonSchema.required).toEqual(["a"]);

  // Child 'b' should keep its own required ['y']
  const bSchema = jsonSchema.properties.b as JsonSchema7ObjectType;
  expect(bSchema.type).toBe("object");
  expect(bSchema.required).toEqual(["y"]);
});
