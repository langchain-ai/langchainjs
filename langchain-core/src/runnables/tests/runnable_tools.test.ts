import { z } from "zod";
// DynamicStructuredTool MUST be imported from here and not from tools.js.
// The `instanceof` check will fail it it's imported from tools.js due to the re-export.
import { DynamicStructuredTool, RunnableLambda } from "../base.js";
import { zodToJsonSchema } from "zod-to-json-schema";

test("Runnable asTool works", async () => {
  const schema = z.object({
    foo: z.string(),
  });
  const runnable = RunnableLambda.from<z.infer<typeof schema>, string>(
    (input, config) => {
      return `${input.foo}${config?.configurable.foo}`;
    }
  );
  const tool = runnable.asTool({
    schema,
  });

  expect(tool).toBeInstanceOf(DynamicStructuredTool);
  expect(tool.schema).toBe(schema);
  expect(tool.description).toBe(
    `Takes ${JSON.stringify(zodToJsonSchema(schema), null, 2)}`
  );
  expect(tool.name).toBe(runnable.getName());
});

test("Runnable asTool works with all populated fields", async () => {
  const schema = z.object({
    foo: z.string(),
  });
  const runnable = RunnableLambda.from<z.infer<typeof schema>, string>(
    (input, config) => {
      return `${input.foo}${config?.configurable.foo}`;
    }
  );
  const tool = runnable.asTool({
    schema,
    name: "test",
    description: "test",
  });

  expect(tool).toBeInstanceOf(DynamicStructuredTool);
  expect(tool.schema).toBe(schema);
  expect(tool.description).toBe("test");
  expect(tool.name).toBe("test");
});

test("Runnable asTool can invoke", async () => {
  const schema = z.object({
    foo: z.string(),
  });
  const runnable = RunnableLambda.from<z.infer<typeof schema>, string>(
    (input, config) => {
      return `${input.foo}${config?.configurable.foo}`;
    }
  );
  const tool = runnable.asTool({
    schema,
  });

  const toolResponse = await tool.invoke(
    {
      foo: "bar",
    },
    {
      configurable: {
        foo: "bar",
      },
    }
  );

  expect(toolResponse).toBe("barbar");
});

test("Runnable asTool with string schema", async () => {
  const schema = z.string();
  const runnable = RunnableLambda.from<z.infer<typeof schema>, string>(
    (input, config) => {
      return `${input}${config?.configurable.foo}`;
    }
  );
  const tool = runnable.asTool({
    schema,
  });

  const toolResponse = await tool.invoke("bar", {
    configurable: {
      foo: "bar",
    },
  });

  expect(toolResponse).toBe("barbar");
});
