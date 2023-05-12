import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { WebBrowser } from 'langchain/tools/webbrowser';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const embeddings = new OpenAIEmbeddings();

const model = new OpenAI({ temperature: 0, modelName: "gpt-4" });
const tools = [
  new WebBrowser({ model, embeddings }),
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),

];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  verbose: true,
});

const input = `What is the wether like in Washington DC`;

const result = await executor.call({ input });
