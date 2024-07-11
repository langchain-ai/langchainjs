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

test("Create a runnable tool directly from RunnableToolLike", async () => {
  const schema = z.object({
    foo: z.string(),
  });
  const adderFunc = (_: z.infer<typeof schema>): Promise<boolean> => {
    return Promise.resolve(true);
  };
  const tool = new RunnableToolLike({
    schema,
    name: "test",
    description: "test",
    bound: RunnableLambda.from(adderFunc),
  });

  const result = await tool.invoke({ foo: "bar" });
  expect(result).toBe(true);
});

test("asTool can take a single string input", async () => {
  const firstRunnable = RunnableLambda.from<string, string>((input) => {
    return `${input}a`;
  });
  const secondRunnable = RunnableLambda.from<string, string>((input) => {
    return `${input}z`;
  });

  const runnable = firstRunnable.pipe(secondRunnable);
  const asTool = runnable.asTool({
    schema: z.string(),
  });

  const result = await asTool.invoke("b");
  expect(result).toBe("baz");
});
