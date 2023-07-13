import { SearxngSearch } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

export async function run() {
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

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "structured-chat-zero-shot-react-description",
    verbose: false,
  });

  console.log("Loaded agent.");

  const input = `What is Langchain? Describe in 50 words`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(result.output);
  /**
   * Langchain is a framework for developing applications powered by language models, such as chatbots, Generative Question-Answering, summarization, and more. It provides a standard interface, integrations with other tools, and end-to-end chains for common applications. Langchain enables data-aware and powerful applications.
   */
}
