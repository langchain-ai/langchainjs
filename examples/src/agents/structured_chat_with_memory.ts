import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { Calculator } from "langchain/tools/calculator";
import { MessagesPlaceholder } from "langchain/prompts";
import { BufferMemory } from "langchain/memory";

export const run = async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "structured-chat-zero-shot-react-description",
    verbose: true,
    memory: new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
    }),
    agentArgs: {
      inputVariables: ["input", "agent_scratchpad", "chat_history"],
      memoryPrompts: [new MessagesPlaceholder("chat_history")],
    },
  });

  const result = await executor.invoke({
    input: `what is 9 to the 2nd power?`,
  });

  console.log(result);

  /*
    {
      "output": "81"
    }
  */

  const result2 = await executor.invoke({
    input: `what is that number squared?`,
  });

  console.log(result2);

  /*
    {
      "output": "6561"
    }
  */
};
