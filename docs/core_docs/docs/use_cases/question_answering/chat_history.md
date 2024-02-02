---
title: Add chat history
---

In many Q&A applications we want to allow the user to have a
back-and-forth conversation, meaning the application needs some sort of
“memory” of past questions and answers, and some logic for incorporating
those into its current thinking.

In this guide we focus on **adding logic for incorporating historical
messages, and NOT on chat history management.** Chat history management
is [covered here](/docs/expression_language/how_to/message_history).

We’ll work off of the Q&A app we built over the [LLM Powered Autonomous
Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) blog post
by Lilian Weng in the
[Quickstart](/docs/use_cases/question_answering/quickstart). We’ll need
to update two things about our existing app:

1.  **Prompt**: Update our prompt to support historical messages as an
    input.
2.  **Contextualizing questions**: Add a sub-chain that takes the latest
    user question and reformulates it in the context of the chat
    history. This is needed in case the latest question references some
    context from past messages. For example, if a user asks a follow-up
    question like “Can you elaborate on the second point?”, this cannot
    be understood without the context of the previous message. Therefore
    we can’t effectively perform retrieval with a question like this.

## Setup {#setup}

### Dependencies {#dependencies}

We’ll use an OpenAI chat model and embeddings and a Memory vector store
in this walkthrough, but everything shown here works with any
[ChatModel](/docs/modules/model_io/chat) or
[LLM](/docs/modules/model_io/llms),
[Embeddings](https://js.langchain.com/docs/modules/data_connection/text_embedding/),
and
[VectorStore](https://js.langchain.com/docs/modules/data_connection/vectorstores/)
or [Retriever](/docs/modules/data_connection/retrievers/).

We’ll use the following packages:

``` bash
npm install --save langchain @langchain/community @langchain/openai cheerio
```

We need to set environment variable `OPENAI_API_KEY`:

``` bash
export OPENAI_API_KEY=YOUR_KEY
```

### LangSmith {#langsmith}

Many of the applications you build with LangChain will contain multiple
steps with multiple invocations of LLM calls. As these applications get
more and more complex, it becomes crucial to be able to inspect what
exactly is going on inside your chain or agent. The best way to do this
is with [LangSmith](https://smith.langchain.com/).

Note that LangSmith is not needed, but it is helpful. If you do want to
use LangSmith, after you sign up at the link above, make sure to set
your environment variables to start logging traces:

``` bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=YOUR_KEY
```

``` typescript
import "cheerio";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory"
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { formatDocumentsAsString } from "langchain/util/document";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
```

``` text
[Module: null prototype] {
  contains: [Function: contains],
  default: [Function: initialize] {
    contains: [Function: contains],
    html: [Function: html],
    merge: [Function: merge],
    parseHTML: [Function: parseHTML],
    root: [Function: root],
    text: [Function: text],
    xml: [Function: xml],
    load: [Function: load],
    _root: Document {
      parent: null,
      prev: null,
      next: null,
      startIndex: null,
      endIndex: null,
      children: [],
      type: "root"
    },
    _options: { xml: false, decodeEntities: true },
    fn: Cheerio {}
  },
  html: [Function: html],
  load: [Function: load],
  merge: [Function: merge],
  parseHTML: [Function: parseHTML],
  root: [Function: root],
  text: [Function: text],
  xml: [Function: xml]
}
```

``` typescript
const loader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/"
);

const docs = await loader.load();

const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
const splits = await textSplitter.splitDocuments(docs);
const vectorStore = await MemoryVectorStore.fromDocuments(splits, new OpenAIEmbeddings());

// Retrieve and generate using the relevant snippets of the blog.
const retriever = vectorStore.asRetriever();
const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt");
const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

const ragChain = RunnableSequence.from([
  {
    context: retriever.pipe(formatDocumentsAsString),
    question: new RunnablePassthrough(),
  },
  prompt,
  llm,
  new StringOutputParser()
]);
```

``` typescript
await ragChain.invoke("What is Task Decomposition?");
```

``` text
"Task decomposition is a technique used to break down complex tasks into smaller and simpler steps. I"... 208 more characters
```

## Contextualizing the question {#contextualizing-the-question}

First we’ll need to define a sub-chain that takes historical messages
and the latest user question, and reformulates the question if it makes
reference to any information in the historical information.

We’ll use a prompt that includes a `MessagesPlaceholder` variable under
the name “chatHistory”. This allows us to pass in a list of Messages to
the prompt using the “chatHistory” input key, and these messages will be
inserted after the system message and before the human message
containing the latest question.

``` typescript
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const contextualizeQSystemPrompt = `Given a chat history and the latest user question
which might reference context in the chat history, formulate a standalone question
which can be understood without the chat history. Do NOT answer the question,
just reformulate it if needed and otherwise return it as is.`;

const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
  ["system", contextualizeQSystemPrompt],
  new MessagesPlaceholder("chatHistory"),
  ["human", "{question}"]
]);
const contextualizeQChain = contextualizeQPrompt.pipe(llm).pipe(new StringOutputParser());
```

Using this chain we can ask follow-up questions that reference past
messages and have them reformulated into standalone questions:

``` typescript
import { AIMessage, HumanMessage } from "@langchain/core/messages";

await contextualizeQChain.invoke({
  chatHistory: [
    new HumanMessage("What does LLM stand for?"),
    new AIMessage("Large language model") 
  ],
  question: "What is meant by large",
})
```

``` text
'What is the definition of "large" in the context of a language model?'
```

## Chain with chat history {#chain-with-chat-history}

And now we can build our full QA chain.

Notice we add some routing functionality to only run the “condense
question chain” when our chat history isn’t empty. Here we’re taking
advantage of the fact that if a function in an LCEL chain returns
another chain, that chain will itself be invoked.

``` typescript
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";

const qaSystemPrompt = `You are an assistant for question-answering tasks.
Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know.
Use three sentences maximum and keep the answer concise.

{context}`

const qaPrompt = ChatPromptTemplate.fromMessages([
  ["system", qaSystemPrompt],
  new MessagesPlaceholder("chatHistory"),
  ["human", "{question}"]
]);

const contextualizedQuestion = (input: Record<string, unknown>) => {
  if ("chatHistory" in input) {
    return contextualizeQChain;
  }
  return input.question;
};

const ragChain = RunnableSequence.from([
  RunnablePassthrough.assign({
    context: (input: Record<string, unknown>) => {
      if ("chatHistory" in input) {
        const chain = contextualizedQuestion(input);
        return chain.pipe(retriever).pipe(formatDocumentsAsString);
      }
      return "";
    },
  }),
  qaPrompt,
  llm
])
```

``` typescript
let chatHistory = [];

const question = "What is task decomposition?";
const aiMsg = await ragChain.invoke({ question, chatHistory });
console.log(aiMsg)
chatHistory = chatHistory.concat(aiMsg);

const secondQuestion = "What are common ways of doing it?";
await ragChain.invoke({ question: secondQuestion, chatHistory });
```

``` text
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: "Task decomposition is a technique used to break down complex tasks into smaller and more manageable "... 278 more characters,
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  },
  lc_namespace: [ "langchain_core", "messages" ],
  content: "Task decomposition is a technique used to break down complex tasks into smaller and more manageable "... 278 more characters,
  name: undefined,
  additional_kwargs: { function_call: undefined, tool_calls: undefined }
}
```

``` text
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: "Common ways of task decomposition include using prompting techniques like Chain of Thought (CoT) or "... 332 more characters,
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  },
  lc_namespace: [ "langchain_core", "messages" ],
  content: "Common ways of task decomposition include using prompting techniques like Chain of Thought (CoT) or "... 332 more characters,
  name: undefined,
  additional_kwargs: { function_call: undefined, tool_calls: undefined }
}
```

See the first [LastSmith trace
here](https://smith.langchain.com/public/527981c6-5018-4b68-a11a-ebcde77843e7/r)
and the [second trace
here](https://smith.langchain.com/public/7b97994a-ab9f-4bf3-a2e4-abb609e5610a/r)

Here we’ve gone over how to add application logic for incorporating
historical outputs, but we’re still manually updating the chat history
and inserting it into each input. In a real Q&A application we’ll want
some way of persisting chat history and some way of automatically
inserting and updating it.

For this we can use:

-   [BaseChatMessageHistory](/docs/modules/memory/chat_messages/): Store
    chat history.
-   [RunnableWithMessageHistory](/docs/expression_language/how_to/message_history):
    Wrapper for an LCEL chain and a `BaseChatMessageHistory` that
    handles injecting chat history into inputs and updating it after
    each invocation.

For a detailed walkthrough of how to use these classes together to
create a stateful conversational chain, head to the [How to add message
history (memory)](/docs/expression_language/how_to/message_history) LCEL
page.

