/* eslint-disable @typescript-eslint/no-non-null-assertion */

// Requires a vectorstore that supports maximal marginal relevance search
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { PromptTemplate, FewShotPromptTemplate } from "@langchain/core/prompts";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

/**
 * Pinecone allows you to partition the records in an index into namespaces.
 * Queries and other operations are then limited to one namespace,
 * so different requests can search different subsets of your index.
 * Read more about namespaces here: https://docs.pinecone.io/guides/indexes/use-namespaces
 *
 * NOTE: If you have namespace enabled in your Pinecone index, you must provide the namespace when creating the PineconeStore.
 */
const namespace = "pinecone";

const pineconeVectorstore = await PineconeStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  { pineconeIndex, namespace }
);

const pineconeMmrRetriever = pineconeVectorstore.asRetriever({
  searchType: "mmr",
  k: 2,
});

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
  vectorStoreRetriever: pineconeMmrRetriever,
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
    content: 'lettuce.',
    additional_kwargs: { function_call: undefined }
  }
*/
