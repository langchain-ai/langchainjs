import { SearchApi } from "langchain/tools";
import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
  });

  const tools = [
    new SearchApi(process.env.SEARCHAPI_API_KEY, {
      engine: "google_news",
    }),
  ];
  const prefix =
    "Answer the following questions as best you can. In your final answer, use a bulleted list markdown format. You have access to the following tools:";

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    agentArgs: {
      prefix,
    },
  });

  const res = await executor.call({
    input: "What's happening in Ukraine today?",
  });

  console.log(res.output);
}
