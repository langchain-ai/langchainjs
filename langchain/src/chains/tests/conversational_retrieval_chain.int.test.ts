import { expect, test } from "@jest/globals";
import { OpenAI, OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { ConversationalRetrievalQAChain } from "../conversational_retrieval_chain.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

test("Test ConversationalRetrievalQAChain from LLM", async () => {
  const model = new OpenAI({ model: "gpt-3.5-turbo-instruct" });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever()
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ question: "foo", chat_history: "bar" });
  // console.log({ res });
});

test("Test ConversationalRetrievalQAChain from LLM with flag option to return source", async () => {
  const model = new OpenAI({ model: "gpt-3.5-turbo-instruct" });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      returnSourceDocuments: true,
    }
  );
  const res = await chain.call({ question: "foo", chat_history: "bar" });

  expect(res).toEqual(
    expect.objectContaining({
      text: expect.any(String),
      sourceDocuments: expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            id: expect.any(Number),
          }),
          pageContent: expect.any(String),
        }),
      ]),
    })
  );
});

test("Test ConversationalRetrievalQAChain from LLM with flag option to return source and memory set", async () => {
  const model = new OpenAI({ model: "gpt-3.5-turbo-instruct" });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      returnSourceDocuments: true,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        inputKey: "question",
        outputKey: "text",
      }),
    }
  );
  const res = await chain.call({ question: "foo", chat_history: "bar" });

  expect(res).toEqual(
    expect.objectContaining({
      text: expect.any(String),
      sourceDocuments: expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            id: expect.any(Number),
          }),
          pageContent: expect.any(String),
        }),
      ]),
    })
  );
});

test("Test ConversationalRetrievalQAChain from LLM with override default prompts", async () => {
  const model = new OpenAI({
    model: "gpt-3.5-turbo-instruct",
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const qa_template = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say "Sorry I dont know, I am learning from Aliens", don't try to make up an answer.
  {context}

  Question: {question}
  Helpful Answer:`;

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      qaTemplate: qa_template,
    }
  );
  const res = await chain.call({
    question: "What is better programming Language Python or Javascript ",
    chat_history: "bar",
  });
  expect(res.text).toContain("I am learning from Aliens");
  // console.log({ res });
});

test("Test ConversationalRetrievalQAChain from LLM with a chat model", async () => {
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const qa_template = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say "Sorry I dont know, I am learning from Aliens", don't try to make up an answer.
  {context}

  Question: {question}
  Helpful Answer:`;

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      qaChainOptions: {
        type: "stuff",
        prompt: PromptTemplate.fromTemplate(qa_template),
      },
    }
  );
  const res = await chain.call({
    question: "What is better programming Language Python or Javascript ",
    chat_history: "bar",
  });
  expect(res.text).toContain("I am learning from Aliens");
  // console.log({ res });
});

test("Test ConversationalRetrievalQAChain from LLM with a map reduce chain", async () => {
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      qaChainOptions: {
        type: "map_reduce",
      },
    }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    question: "What is better programming Language Python or Javascript ",
    chat_history: "bar",
  });

  // console.log({ res });
});

test("Test ConversationalRetrievalQAChain from LLM without memory", async () => {
  const model = new OpenAI({
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria are made of lipids",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever()
  );
  const question = "What is the powerhouse of the cell?";
  const res = await chain.call({
    question,
    chat_history: "",
  });

  // console.log({ res });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    question: "What are they made out of?",
    chat_history: question + res.text,
  });

  // console.log({ res2 });
});

test("Test ConversationalRetrievalQAChain from LLM with a chat model without memory", async () => {
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria are made of lipids",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever()
  );
  const question = "What is the powerhouse of the cell?";
  const res = await chain.call({
    question,
    chat_history: "",
  });

  // console.log({ res });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    question: "What are they made out of?",
    chat_history: question + res.text,
  });

  // console.log({ res2 });
});

test("Test ConversationalRetrievalQAChain from LLM with memory", async () => {
  const model = new OpenAI({
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria are made of lipids",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      memory: new BufferMemory({
        memoryKey: "chat_history",
      }),
    }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    question: "What is the powerhouse of the cell?",
  });

  // console.log({ res });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    question: "What are they made out of?",
  });

  // console.log({ res2 });
});

test("Test ConversationalRetrievalQAChain from LLM with a chat model and memory", async () => {
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria are made of lipids",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      memory: new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true,
      }),
    }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    question: "What is the powerhouse of the cell?",
  });

  // console.log({ res });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    question: "What are they made out of?",
  });

  // console.log({ res2 });
});

test("Test ConversationalRetrievalQAChain from LLM with deprecated history syntax", async () => {
  const model = new OpenAI({
    temperature: 0,
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria are made of lipids",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever()
  );
  const question = "What is the powerhouse of the cell?";
  const res = await chain.call({
    question,
    chat_history: [],
  });

  // console.log({ res });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    question: "What are they made out of?",
    chat_history: [[question, res.text]],
  });

  // console.log({ res2 });
});
