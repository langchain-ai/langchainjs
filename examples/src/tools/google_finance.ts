import { SERPGoogleFinanceAPITool } from "@langchain/community/tools/google_finance";
import { OpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const tools = [
    new SERPGoogleFinanceAPITool({ apiKey: process.env.SERPAPI_API_KEY }),
  ];

  const financeAgent = createReactAgent({
    llm: model,
    tools: tools,
  });

  const inputs = {
    messages: [{ role: "user", content: "what is the price of GOOG:NASDAQ?" }],
  };

  const stream = await financeAgent.stream(inputs, { streamMode: "values" });

  for await (const { messages } of stream) {
    console.log(messages);
  }
}
