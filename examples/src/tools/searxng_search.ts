import { SearxngSearch } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor } from "langchain/agents";
import { BaseMessageChunk, AgentAction, AgentFinish } from "langchain/schema";
import { RunnableSequence } from "langchain/schema/runnable";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new ChatOpenAI({
  maxTokens: 1000,
  modelName: "gpt-4",
});

// `apiBase` will be automatically parsed from .env file, set "SEARXNG_API_BASE" in .env,
const tools = [
  new SearxngSearch({
    params: {
      format: "json", // Do not change this, format other than "json" is will throw error
      engines: "google",
    },
    // Custom Headers to support rapidAPI authentication Or any instance that requires custom headers
    headers: {},
  }),
];
const prefix = ChatPromptTemplate.fromMessages([
  [
    "ai",
    "Answer the following questions as best you can. In your final answer, use a bulleted list markdown format.",
  ],
  ["human", "{input}"],
]);
// Replace this with your actual output parser.
const customOutputParser = (
  input: BaseMessageChunk
): AgentAction | AgentFinish => ({
  log: "test",
  returnValues: {
    output: input,
  },
});
// Replace this placeholder agent with your actual implementation.
const agent = RunnableSequence.from([prefix, model, customOutputParser]);
const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
});
console.log("Loaded agent.");
const input = `What is Langchain? Describe in 50 words`;
console.log(`Executing with input "${input}"...`);
const result = await executor.invoke({ input });
console.log(result);
/**
 * Langchain is a framework for developing applications powered by language models, such as chatbots, Generative Question-Answering, summarization, and more. It provides a standard interface, integrations with other tools, and end-to-end chains for common applications. Langchain enables data-aware and powerful applications.
 */
