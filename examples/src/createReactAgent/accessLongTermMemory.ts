/**
 * Access Long Term Memory in Message Generation
 *
 * This capability allows the agent to retrieve and incorporate information from
 * persistent memory stores (like vector databases) when generating responses,
 * enabling recall of past interactions and learned information.
 *
 * Why this is important:
 * - Knowledge Persistence: Retains and recalls important information across sessions, creating a sense of continuity and learning
 * - Contextual Enrichment: Enhances responses with relevant historical context and previously discussed topics
 * - Personalized Experience: Builds long-term understanding of user preferences, needs, and interaction patterns
 *
 * Example Scenario:
 * You're building a personal assistant for a busy executive. When they mention "the Johnson project",
 * the agent retrieves previous conversations about Johnson project details, timelines, and stakeholders
 * from its long-term memory, allowing it to provide context-aware responses without the user having to repeat information.
 */

import {
  VectorStoreRetrieverMemory,
  MemoryVectorStore,
  SystemMessage,
  HumanMessage,
  createReactAgent,
  tool,
} from "langchain";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4" });
const embeddings = new OpenAIEmbeddings();

const memory = new VectorStoreRetrieverMemory({
  vectorStoreRetriever: new MemoryVectorStore(embeddings).asRetriever(1),
  memoryKey: "history",
});

await memory.saveContext(
  {
    question: "What is the weather?",
  },
  {
    text: "The weather is sunny",
  }
);

const getWeather = tool(
  async () => {
    return "The weather is sunny";
  },
  { name: "get_weather", description: "Get the weather" }
);

const agent = createReactAgent({
  llm,
  tools: [getWeather],
  prompt: async (state) => {
    /**
     * Access long-term memory for relevant context
     */
    const memoryData = await memory.loadMemoryVariables({
      prompt: state.messages[state.messages.length - 1].content,
    });

    return [
      new SystemMessage(
        `Relevant memories: ${memoryData.history}\nRespond accordingly.`
      ),
    ];
  },
});

/**
 * Example Usage
 */
const result = await agent.invoke({
  messages: [new HumanMessage("What is the weather?")],
});

console.log(result);
