import { test } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BufferMemory } from "../../memory/index.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";

test("Run conversational agent with memory", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
    memory: new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input",
    }),
  });
  console.log("Loaded agent.");

  const input0 = `how is your day going?`;

  const result0 = await executor.call({ input: input0 });

  console.log(`Got output ${result0.output}`);

  const input1 = `what is 9 to the 2nd power?`;

  const result1 = await executor.call({ input: input1 });

  console.log(`Got output ${result1.output}`);

  const input2 = `whats is that result divided by 10?`;

  const result2 = await executor.call({ input: input2 });

  console.log(`Got output ${result2.output}`);
});
