import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RunnableLambda, RunnableToolLike } from "../base.js";

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

  expect(tool).toBeInstanceOf(RunnableToolLike);
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

  expect(tool).toBeInstanceOf(RunnableToolLike);
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

test("asTool should type error with mismatched schema", async () => {
  // asTool infers the type of the Zod schema from the existing runnable's RunInput generic.
  // If the Zod schema does not match the RunInput, it should throw a type error.
  const schema = z.object({
    foo: z.string(),
  });
  const runnable = RunnableLambda.from<{ bar: string }, string>(
    (input, config) => {
      return `${input.bar}${config?.configurable.foo}`;
    }
  );
  runnable.asTool({
    // @ts-expect-error - Should error. If this does not give a type error, the generics/typing of `asTool` is broken.
    schema,
  });
});
