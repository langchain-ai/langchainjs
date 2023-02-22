# Custom Tool

Although LangChain provides several tools out of the box, you may want define your own tools. You can easily do this with the `DynamicTool` class.

The `DynamicTool` class takes as input a name, a description, and a function. Importantly, the name and the description will be used by the language model to determine when to call this function and with what parameters! So make sure to set these to some values the language model can reason about. The function provided is what will actually be called.

See below for an example of defining and using `DynamicTool`s.

```typescript
import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { DynamicTool } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new DynamicTool({
      name: "FOO",
      description:
        "call this to get the value of foo. input should be an empty string.",
      func: () => "baz",
    }),
    new DynamicTool({
      name: "BAR",
      description:
        "call this to get the value of bar. input should be an empty string.",
      func: () => "baz1",
    }),
  ];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description"
  );

  console.log("Loaded agent.");

  const input = `What is the value of foo?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
```
