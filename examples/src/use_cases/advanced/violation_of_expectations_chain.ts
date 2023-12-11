import { ViolationOfExpectationsChain } from "langchain/experimental/chains/violation_of_expectations";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { AIMessage, HumanMessage } from "langchain/schema";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

// Short GPT generated conversation between a human and an AI.
const dummyMessages = [
  new HumanMessage(
    "I've been thinking about the importance of time with myself to discover my voice. I feel like 1-2 hours is never enough."
  ),
  new AIMessage(
    "The concept of 'adequate time' varies. Have you tried different formats of introspection, such as morning pages or long-form writing, to see if they make the process more efficient?"
  ),
  new HumanMessage(
    "I have tried journaling but never consistently. Sometimes it feels like writing doesn't capture everything."
  ),
  new AIMessage(
    "Writing has its limits. What about other mediums like digital art, or interactive journal apps with dynamic prompts that dig deeper? Even coding a personal project can be a form of self-discovery."
  ),
  new HumanMessage(
    "That's an interesting idea. I've never thought about coding as a form of self-discovery."
  ),
  new AIMessage(
    "Since you're comfortable with code, consider building a tool to log and analyze your emotional state, thoughts, or personal growth metrics. It merges skill with introspection, makes the data quantifiable."
  ),
  new HumanMessage(
    "The idea of quantifying emotions and personal growth is fascinating. But I wonder how much it can really capture the 'dark zone' within us."
  ),
  new AIMessage(
    "Good point. The 'dark zone' isn't fully quantifiable. But a tool could serve as a scaffold to explore those areas. It gives a structured approach to an unstructured problem."
  ),
  new HumanMessage(
    "You might be onto something. A structured approach could help unearth patterns or triggers I hadn't noticed."
  ),
  new AIMessage(
    "Exactly. It's about creating a framework to understand what can't easily be understood. Then you can allocate those 5+ hours more effectively, targeting areas that your data flags."
  ),
];

// Instantiate with an empty string to start, since we have no data yet.
const vectorStore = await HNSWLib.fromTexts(
  [" "],
  [{ id: 1 }],
  new OpenAIEmbeddings()
);
const retriever = vectorStore.asRetriever();

// Instantiate the LLM,
const llm = new ChatOpenAI({
  modelName: "gpt-4",
});

// And the chain.
const voeChain = ViolationOfExpectationsChain.fromLLM(llm, retriever);

// Requires an input key of "chat_history" with an array of messages.
const result = await voeChain.call({
  chat_history: dummyMessages,
});

console.log({
  result,
});

/**
 * Output:
{
  result: [
    'The user has experience with coding and has tried journaling before, but struggles with maintaining consistency and fully expressing their thoughts and feelings through writing.',
    'The user shows a thoughtful approach towards new concepts and is willing to engage with and contemplate novel ideas before making a decision. They also consider time effectiveness as a crucial factor in their decision-making process.',
    'The user is curious and open-minded about new concepts, but also values introspection and self-discovery in understanding emotions and personal growth.',
    'The user is open to new ideas and strategies, specifically those that involve a structured approach to identifying patterns or triggers.',
    'The user may not always respond or engage with prompts, indicating a need for varied and adaptable communication strategies.'
  ]
}
 */
