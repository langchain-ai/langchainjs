// Ephemeral, in-memory vector store for demo purposes
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate, FewShotPromptTemplate } from "@langchain/core/prompts";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";

const embeddings = new OpenAIEmbeddings();

const memoryVectorStore = new MemoryVectorStore(embeddings);

const examples = [
  {
    query: "healthy food",
    output: `galbi`,
  },
  {
    query: "healthy food",
    output: `schnitzel`,
  },
  {
    query: "foo",
    output: `bar`,
  },
];

const exampleSelector = new SemanticSimilarityExampleSelector({
  vectorStore: memoryVectorStore,
  k: 2,
  // Only embed the "query" key of each example
  inputKeys: ["query"],
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
  suffix: "User question: {query}",
  inputVariables: ["query"],
});

const formattedValue = await dynamicPrompt.format({
  query: "What is a healthy food?",
});
console.log(formattedValue);

/*
Answer the user's question, using the below examples as reference:

<example>
  <user_input>
    healthy
  </user_input>
  <output>
    galbi
  </output>
</example>

<example>
  <user_input>
    healthy
  </user_input>
  <output>
    schnitzel
  </output>
</example>

User question: What is a healthy food?
*/

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const chain = dynamicPrompt.pipe(model);

const result = await chain.invoke({ query: "What is a healthy food?" });
console.log(result);
/*
  AIMessage {
    content: 'A healthy food can be galbi or schnitzel.',
    additional_kwargs: { function_call: undefined }
  }
*/
