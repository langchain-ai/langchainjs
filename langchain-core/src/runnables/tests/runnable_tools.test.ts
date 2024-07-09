import { z } from "zod";
import { RunnableLambda } from "../base.js";

test("Runnable asTool method works", async () => {
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
