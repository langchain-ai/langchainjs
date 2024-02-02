---
title: Streaming
---

Often in Q&A applications it’s important to show users the sources that
were used to generate the answer. The simplest way to do this is for the
chain to return the Documents that were retrieved in each generation.

We’ll work off of the Q&A app with sources we built over the [LLM
Powered Autonomous
Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) blog post
by Lilian Weng in the [Returning
sources](/docs/use_cases/question_answering/sources) guide.

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

## Chain with sources {#chain-with-sources}

Here is Q&A app with sources we built over the [LLM Powered Autonomous
Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) blog post
by Lilian Weng in the [Returning
sources](/docs/use_cases/question_answering/sources) guide:

``` typescript
import "cheerio";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory"
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { formatDocumentsAsString } from "langchain/util/document";
import { RunnableSequence, RunnablePassthrough, RunnableMap } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
```

``` text
[WARNING]: Importing from "langchain/document" is deprecated.

Instead, please import from "@langchain/core/documents".

This will be mandatory after the next "langchain" minor version bump to 0.2.
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

const ragChainFromDocs = RunnableSequence.from([
  RunnablePassthrough.assign({ context: (input) => formatDocumentsAsString(input.context) }),
  prompt,
  llm,
  new StringOutputParser()
]);

let ragChainWithSource = new RunnableMap({ steps: { context: retriever, question: new RunnablePassthrough() }})
ragChainWithSource = ragChainWithSource.assign({ answer: ragChainFromDocs });

await ragChainWithSource.invoke("What is Task Decomposition")
```

``` text
{
  question: "What is Task Decomposition",
  context: [
    Document {
      pageContent: "Fig. 1. Overview of a LLM-powered autonomous agent system.\n" +
        "Component One: Planning#\n" +
        "A complicated ta"... 898 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    },
    Document {
      pageContent: 'Task decomposition can be done (1) by LLM with simple prompting like "Steps for XYZ.\\n1.", "What are'... 887 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    },
    Document {
      pageContent: "Agent System Overview\n" +
        "                \n" +
        "                    Component One: Planning\n" +
        "                 "... 850 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    },
    Document {
      pageContent: "Resources:\n" +
        "1. Internet access for searches and information gathering.\n" +
        "2. Long Term memory management"... 456 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    }
  ],
  answer: "Task decomposition is a technique used to break down complex tasks into smaller and simpler steps. I"... 256 more characters
}
```

## Streaming final outputs {#streaming-final-outputs}

With LCEL it’s easy to stream final outputs:

``` typescript
for await (const chunk of await ragChainWithSource.stream("What is task decomposition?")) {
  console.log(chunk)
}
```

``` text
{ question: "What is task decomposition?" }
{
  context: [
    Document {
      pageContent: "Fig. 1. Overview of a LLM-powered autonomous agent system.\n" +
        "Component One: Planning#\n" +
        "A complicated ta"... 898 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    },
    Document {
      pageContent: 'Task decomposition can be done (1) by LLM with simple prompting like "Steps for XYZ.\\n1.", "What are'... 887 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    },
    Document {
      pageContent: "Agent System Overview\n" +
        "                \n" +
        "                    Component One: Planning\n" +
        "                 "... 850 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    },
    Document {
      pageContent: "(3) Task execution: Expert models execute on the specific tasks and log results.\n" +
        "Instruction:\n" +
        "\n" +
        "With "... 539 more characters,
      metadata: {
        source: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        loc: { lines: [Object] }
      }
    }
  ]
}
{ answer: "" }
{ answer: "Task" }
{ answer: " decomposition" }
{ answer: " is" }
{ answer: " a" }
{ answer: " technique" }
{ answer: " used" }
{ answer: " to" }
{ answer: " break" }
{ answer: " down" }
{ answer: " complex" }
{ answer: " tasks" }
{ answer: " into" }
{ answer: " smaller" }
{ answer: " and" }
{ answer: " simpler" }
{ answer: " steps" }
{ answer: "." }
{ answer: " It" }
{ answer: " can" }
{ answer: " be" }
{ answer: " done" }
{ answer: " through" }
{ answer: " various" }
{ answer: " methods" }
{ answer: " such" }
{ answer: " as" }
{ answer: " using" }
{ answer: " prompting" }
{ answer: " techniques" }
{ answer: "," }
{ answer: " task" }
{ answer: "-specific" }
{ answer: " instructions" }
{ answer: "," }
{ answer: " or" }
{ answer: " human" }
{ answer: " inputs" }
{ answer: "." }
{ answer: " Another" }
{ answer: " approach" }
{ answer: " involves" }
{ answer: " outsourcing" }
{ answer: " the" }
{ answer: " planning" }
{ answer: " step" }
{ answer: " to" }
{ answer: " an" }
{ answer: " external" }
{ answer: " classical" }
{ answer: " planner" }
{ answer: "." }
{ answer: "" }
```

We can add some logic to compile our stream as it’s being returned:

``` typescript
const output = {};
let currentKey: string | null = null;

for await (const chunk of await ragChainWithSource.stream("What is task decomposition?")) {
  for (const key of Object.keys(chunk)) {
    if (output[key] === undefined) {
      output[key] = chunk[key];
    } else {
      output[key] += chunk[key];
    }

    if (key !== currentKey) {
      console.log(`\n\n${key}: ${JSON.stringify(chunk[key])}`);
    } else {
      console.log(chunk[key]);
    }
    currentKey = key;
  }
}
```

``` text


question: "What is task decomposition?"


context: [{"pageContent":"Fig. 1. Overview of a LLM-powered autonomous agent system.\nComponent One: Planning#\nA complicated task usually involves many steps. An agent needs to know what they are and plan ahead.\nTask Decomposition#\nChain of thought (CoT; Wei et al. 2022) has become a standard prompting technique for enhancing model performance on complex tasks. The model is instructed to “think step by step” to utilize more test-time computation to decompose hard tasks into smaller and simpler steps. CoT transforms big tasks into multiple manageable tasks and shed lights into an interpretation of the model’s thinking process.\nTree of Thoughts (Yao et al. 2023) extends CoT by exploring multiple reasoning possibilities at each step. It first decomposes the problem into multiple thought steps and generates multiple thoughts per step, creating a tree structure. The search process can be BFS (breadth-first search) or DFS (depth-first search) with each state evaluated by a classifier (via a prompt) or majority vote.","metadata":{"source":"https://lilianweng.github.io/posts/2023-06-23-agent/","loc":{"lines":{"from":176,"to":181}}}},{"pageContent":"Task decomposition can be done (1) by LLM with simple prompting like \"Steps for XYZ.\\n1.\", \"What are the subgoals for achieving XYZ?\", (2) by using task-specific instructions; e.g. \"Write a story outline.\" for writing a novel, or (3) with human inputs.\nAnother quite distinct approach, LLM+P (Liu et al. 2023), involves relying on an external classical planner to do long-horizon planning. This approach utilizes the Planning Domain Definition Language (PDDL) as an intermediate interface to describe the planning problem. In this process, LLM (1) translates the problem into “Problem PDDL”, then (2) requests a classical planner to generate a PDDL plan based on an existing “Domain PDDL”, and finally (3) translates the PDDL plan back into natural language. Essentially, the planning step is outsourced to an external tool, assuming the availability of domain-specific PDDL and a suitable planner which is common in certain robotic setups but not in many other domains.\nSelf-Reflection#","metadata":{"source":"https://lilianweng.github.io/posts/2023-06-23-agent/","loc":{"lines":{"from":182,"to":184}}}},{"pageContent":"Agent System Overview\n                \n                    Component One: Planning\n                        \n                \n                    Task Decomposition\n                \n                    Self-Reflection\n                \n                \n                    Component Two: Memory\n                        \n                \n                    Types of Memory\n                \n                    Maximum Inner Product Search (MIPS)\n                \n                \n                    Component Three: Tool Use\n                \n                    Case Studies\n                        \n                \n                    Scientific Discovery Agent\n                \n                    Generative Agents Simulation\n                \n                    Proof-of-Concept Examples\n                \n                \n                    Challenges\n                \n                    Citation\n                \n                    References","metadata":{"source":"https://lilianweng.github.io/posts/2023-06-23-agent/","loc":{"lines":{"from":112,"to":146}}}},{"pageContent":"(3) Task execution: Expert models execute on the specific tasks and log results.\nInstruction:\n\nWith the input and the inference results, the AI assistant needs to describe the process and results. The previous stages can be formed as - User Input: {{ User Input }}, Task Planning: {{ Tasks }}, Model Selection: {{ Model Assignment }}, Task Execution: {{ Predictions }}. You must first answer the user's request in a straightforward manner. Then describe the task process and show your analysis and model inference results to the user in the first person. If inference results contain a file path, must tell the user the complete file path.","metadata":{"source":"https://lilianweng.github.io/posts/2023-06-23-agent/","loc":{"lines":{"from":277,"to":280}}}}]


answer: ""
Task
 decomposition
 is
 a
 technique
 used
 to
 break
 down
 complex
 tasks
 into
 smaller
 and
 simpler
 steps
.
 It
 can
 be
 done
 through
 various
 methods
 such
 as
 using
 prompting
 techniques
,
 task
-specific
 instructions
,
 or
 human
 inputs
.
 Another
 approach
 involves
 outsourcing
 the
 planning
 step
 to
 an
 external
 classical
 planner
.
```

``` text
"answer"
```

## Streaming intermediate steps {#streaming-intermediate-steps}

Suppose we want to stream not only the final outputs of the chain, but
also some intermediate steps. As an example let’s take our [Chat
history](/docs/use_cases/question_answering/chat_history) chain. Here we
reformulate the user question before passing it to the retriever. This
reformulated question is not returned as part of the final output. We
could modify our chain to return the new question, but for demonstration
purposes we’ll leave it as is.

``` typescript
import { StringOutputParser } from "@langchain/core/output_parsers";
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
const contextualizeQChain = contextualizeQPrompt.pipe(llm).pipe(new StringOutputParser()).withConfig({ tags: ["contextualizeQChain"] });

const qaSystemPrompt = `You are an assistant for question-answering tasks.
Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know.
Use three sentences maximum and keep the answer concise.

{context}`;
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

To stream intermediate steps we’ll use the `streamLog` method. This is a
method that yields JSONPatch ops that when applied in the same order as
received build up the RunState:

``` typescript
import { type LogEntry } from "@langchain/core/tracers/log_stream";

interface RunState {
    /**
     * ID of the run.
     */ 
    id: string;
    /**
     * List of output chunks streamed by Runnable.stream()
     */ 
    streamed_output: any[];
    /**
     * Final output of the run, usually the result of aggregating (`+`) streamed_output.
     * Only available after the run has finished successfully.
     */ 
    final_output?: any;
    /**
     * Map of run names to sub-runs. If filters were supplied, this list will
     * contain only the runs that matched the filters.
     */ 
    logs: Record<string, LogEntry>;
}
```

You can stream all steps (default) or include/exclude steps by name,
tags or metadata. In this case we’ll only stream intermediate steps that
are part of the `contextualizeQChain` and the final output. Notice that
when defining the `contextualizeQChain` we gave it a corresponding tag,
which we can now filter on.

We only show the first 20 chunks of the stream for readability:

``` typescript
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

let chatHistory: Array<BaseMessage> = [];

const question = "What is task decomposition?";
const aiMsg = await ragChain.invoke({ question, chatHistory });
chatHistory = chatHistory.concat([new HumanMessage(question), aiMsg]);
console.log(chatHistory);

const secondQuestion = "What are common ways of doing it?";
let count = 0;
const streamLog = await ragChain.streamLog(
  {
    question: secondQuestion,
    chatHistory
  },
  undefined,
  { includeTags: ["contextualizeQChain"] }
);
for await (const jsonPatchOp of streamLog) {
  console.log(jsonPatchOp);
  count++;
  if (count > 20) {
    break;
  }
}
```

``` text
[
  HumanMessage {
    lc_serializable: true,
    lc_kwargs: { content: "What is task decomposition?", additional_kwargs: {} },
    lc_namespace: [ "langchain_core", "messages" ],
    content: "What is task decomposition?",
    name: undefined,
    additional_kwargs: {}
  },
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
]
RunLogPatch {
  ops: [
    {
      op: "replace",
      path: "",
      value: {
        id: "3d7bf12c-b781-4e84-94c9-ac6d007794c9",
        streamed_output: [],
        final_output: undefined,
        logs: {}
      }
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/RunnableSequence",
      value: {
        id: "b57a711f-870b-4eec-a51d-79baa84b8b17",
        name: "RunnableSequence",
        type: "chain",
        tags: [ "seq:step:1", "contextualizeQChain" ],
        metadata: {},
        start_time: "2024-02-02T01:21:45.857Z",
        streamed_output: [],
        streamed_output_str: [],
        final_output: undefined,
        end_time: undefined
      }
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatPromptTemplate",
      value: {
        id: "4e1f38af-9b15-475d-b501-5413f7952e98",
        name: "ChatPromptTemplate",
        type: "prompt",
        tags: [ "seq:step:1", "contextualizeQChain" ],
        metadata: {},
        start_time: "2024-02-02T01:21:45.984Z",
        streamed_output: [],
        streamed_output_str: [],
        final_output: undefined,
        end_time: undefined
      }
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatPromptTemplate/final_output",
      value: ChatPromptValue {
        lc_serializable: true,
        lc_kwargs: { messages: [Array] },
        lc_namespace: [ "langchain_core", "prompt_values" ],
        messages: [
          [SystemMessage],
          [HumanMessage],
          [AIMessage],
          [HumanMessage]
        ]
      }
    },
    {
      op: "add",
      path: "/logs/ChatPromptTemplate/end_time",
      value: "2024-02-02T01:21:46.120Z"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI",
      value: {
        id: "a2c8340a-2436-483b-aa94-2c55538b681e",
        name: "ChatOpenAI",
        type: "llm",
        tags: [ "seq:step:2", "contextualizeQChain" ],
        metadata: {},
        start_time: "2024-02-02T01:21:46.240Z",
        streamed_output: [],
        streamed_output_str: [],
        final_output: undefined,
        end_time: undefined
      }
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser",
      value: {
        id: "969c393e-9af4-498a-8608-1519d42cf663",
        name: "StrOutputParser",
        type: "parser",
        tags: [ "seq:step:3", "contextualizeQChain" ],
        metadata: {},
        start_time: "2024-02-02T01:21:46.528Z",
        streamed_output: [],
        streamed_output_str: [],
        final_output: undefined,
        end_time: undefined
      }
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: ""
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: ""
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: "What"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: "What"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: " are"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: " are"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: " some"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: " some"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: " commonly"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: " commonly"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: " used"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: " used"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: " methods"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/ChatOpenAI/streamed_output_str/-",
      value: " methods"
    }
  ]
}
RunLogPatch {
  ops: [
    {
      op: "add",
      path: "/logs/StrOutputParser/streamed_output/-",
      value: " or"
    }
  ]
}
```

``` text
: 
```

If we wanted to get our retrieved docs, we could filter on name
“Retriever”:

``` typescript
let count = 0;
const streamLog = await ragChain.streamLog(
  {
    question: secondQuestion,
    chatHistory
  },
  undefined,
  { includeTags: ["Retriever"] }
);
for await (const jsonPatchOp of streamLog) {
  console.log(jsonPatchOp);
  count++;
  if (count > 20) {
    break;
  }
}
```

