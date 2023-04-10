import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { CallbackManager } from "langchain/callbacks";
import { LLMResult } from "langchain/schema";
import { SerpAPI, Calculator, WebBrowser } from "langchain/tools";

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

  const model = new OpenAI({ temperature: 0, callbackManager });
  const tools = [new SerpAPI(), new Calculator(), new WebBrowser(model)];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `Whats the word of the day on https://www.merriam-webster.com/word-of-the-day?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
