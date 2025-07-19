// Ephemeral, in-memory vector store for demo purposes
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate, FewShotPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";

const embeddings = new OpenAIEmbeddings();

const memoryVectorStore = new MemoryVectorStore(embeddings);

const examples = [
  {
    query: "healthy food",
    output: `lettuce`,
    food_type: "vegetable",
  },
  {
    query: "healthy food",
    output: `schnitzel`,
    food_type: "veal",
  },
  {
    query: "foo",
    output: `bar`,
    food_type: "baz",
  },
];

const exampleSelector = new SemanticSimilarityExampleSelector({
  vectorStore: memoryVectorStore,
  k: 2,
  // Only embed the "query" key of each example
  inputKeys: ["query"],
  // Filter type will depend on your specific vector store.
  // See the section of the docs for the specific vector store you are using.
  filter: (doc: Document) => doc.metadata.food_type === "vegetable",
});

for (const example of examples) {
  // Format and add an example to the underlying vector store
  await exampleSelector.addExample(example);
}

// Create a prompt template that will be used to format the examples.
const examplePrompt = PromptTemplate.fromTemplate(`<example>
  <user_input>
    {query}
  </user_input>
  <output>
    {output}
  </output>
</example>`);

// Create a FewShotPromptTemplate that will use the example selector.
const dynamicPrompt = new FewShotPromptTemplate({
  // We provide an ExampleSelector instead of examples.
  exampleSelector,
  examplePrompt,
  prefix: `Answer the user's question, using the below examples as reference:`,
  suffix: "User question:\n{query}",
  inputVariables: ["query"],
});

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const chain = dynamicPrompt.pipe(model);

const result = await chain.invoke({
  query: "What is exactly one type of healthy food?",
});
console.log(result);
/*
  AIMessage {
    content: 'One type of healthy food is lettuce.',
    additional_kwargs: { function_call: undefined }
  }
*/
