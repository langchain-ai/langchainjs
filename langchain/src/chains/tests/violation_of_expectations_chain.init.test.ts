import { ChatOpenAI } from "../../chat_models/openai.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { AIMessage, HumanMessage } from "../../schema/index.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { ViolationOfExpectationsChain } from "../violation_of_expectations/violation_of_expectations_chain.js";

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

test("should respond with the proper schema", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Mitochondria are the powerhouse of the cell", "Foo is red"],
    [{ id: 2 }, { id: 1 }],
    new OpenAIEmbeddings()
  );
  const retriever = vectorStore.asRetriever();

  const llm = new ChatOpenAI({
    modelName: "gpt-4",
  });
  const chain = new ViolationOfExpectationsChain({
    llm,
    retriever,
  });

  const res = await chain.call({
    chat_history: dummyMessages,
  });

  console.log({
    res,
  });
});
