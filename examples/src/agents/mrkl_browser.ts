import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutor } from "langchain/agents";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { WebBrowser } from "langchain/tools/webbrowser";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const embeddings = new OpenAIEmbeddings();
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    new WebBrowser({ model, embeddings }),
  ];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `What is the word of the day on merriam webster. What is the top result on google for that word`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${JSON.stringify(result, null, 2)}`);
};
