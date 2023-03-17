import {
  Tool,
  ChatConversationalAgent2,
  AgentExecutor,
} from "langchain/agents";
import { CallbackManager } from "langchain/callbacks";
import { ChatOpenAI } from "langchain/chat_models";
import { LLMResult } from "langchain/schema";
import { SerpAPI, Calculator } from "langchain/tools";

export const run = async () => {
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMStart(_llm: { name: string }, prompts: string[]) {
      console.log(JSON.stringify(prompts, null, 2));
    },
    async handleLLMEnd(output: LLMResult) {
      for (const generation of output.generations) {
        for (const gen of generation) {
          console.log(gen.text);
        }
      }
    },
  });

  const model = new ChatOpenAI({
    temperature: 0,
    callbackManager,
  });

  const tools: Tool[] = [new SerpAPI(), new Calculator()];

  const executor = AgentExecutor.fromAgentAndTools({
    agent: ChatConversationalAgent2.fromLLMAndTools(model, tools),
    tools,
    returnIntermediateSteps: true,
  });

  const input = `Who is Olivia Wilde's boyfriend and what is his current age raised to the 0.23 power?`;
  const res = await executor.call({
    input,
    chat_history: [],
  });

  console.log(`Got output ${res.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(res.intermediateSteps, null, 2)}`
  );
};
