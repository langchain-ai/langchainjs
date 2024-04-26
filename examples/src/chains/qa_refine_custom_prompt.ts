import { loadQARefineChain } from "langchain/chains";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PromptTemplate } from "@langchain/core/prompts";

export const questionPromptTemplateString = `Context information is below.
---------------------
{context}
---------------------
Given the context information and no prior knowledge, answer the question: {question}`;

const questionPrompt = new PromptTemplate({
  inputVariables: ["context", "question"],
  template: questionPromptTemplateString,
});

const refinePromptTemplateString = `The original question is as follows: {question}
We have provided an existing answer: {existing_answer}
We have the opportunity to refine the existing answer
(only if needed) with some more context below.
------------
{context}
------------
Given the new context, refine the original answer to better answer the question.
You must provide a response, either original answer or refined answer.`;

const refinePrompt = new PromptTemplate({
  inputVariables: ["question", "existing_answer", "context"],
  template: refinePromptTemplateString,
});

// Create the models and chain
const embeddings = new OpenAIEmbeddings();
const model = new OpenAI({ temperature: 0 });
const chain = loadQARefineChain(model, {
  questionPrompt,
  refinePrompt,
});

// Load the documents and create the vector store
const loader = new TextLoader("./state_of_the_union.txt");
const docs = await loader.loadAndSplit();
const store = await MemoryVectorStore.fromDocuments(docs, embeddings);

// Select the relevant documents
const question = "What did the president say about Justice Breyer";
const relevantDocs = await store.similaritySearch(question);

// Call the chain
const res = await chain.invoke({
  input_documents: relevantDocs,
  question,
});

console.log(res);
/*
{
  output_text: '\n' +
    '\n' +
    "The president said that Justice Stephen Breyer has dedicated his life to serve this country and thanked him for his service. He also mentioned that Judge Ketanji Brown Jackson will continue Justice Breyer's legacy of excellence, and that the constitutional right affirmed in Roe v. Wade—standing precedent for half a century—is under attack as never before. He emphasized the importance of protecting access to health care, preserving a woman's right to choose, and advancing maternal health care in America. He also expressed his support for the LGBTQ+ community, and his commitment to protecting their rights, including offering a Unity Agenda for the Nation to beat the opioid epidemic, increase funding for prevention, treatment, harm reduction, and recovery, and strengthen the Violence Against Women Act."
}
*/
