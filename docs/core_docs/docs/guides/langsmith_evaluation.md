# LangSmith Walkthrough

LangChain makes it easy to prototype LLM applications and Agents. However, delivering LLM applications to production can be deceptively difficult. You will have to iterate on your prompts, chains, and other components to build a high-quality product.

LangSmith makes it easy to debug, test, and continuously improve your LLM applications.

When might this come in handy? You may find it useful when you want to:

- Quickly debug a new chain, agent, or set of tools
- Create and manage datasets for fine-tuning, few-shot prompting, and evaluation
- Run regression tests on your application to confidently develop
- Capture production analytics for product insights and continuous improvements

## Prerequisites

**[Create a LangSmith account](https://smith.langchain.com/) and create an API key (see bottom left corner). Familiarize yourself with the platform by looking through the [docs](https://docs.smith.langchain.com/)**

Note LangSmith is in closed beta; we're in the process of rolling it out to more users. However, you can fill out the form on the website for expedited access.

Now, let's get started!

## Log runs to LangSmith

First, configure your environment variables to tell LangChain to log traces. This is done by setting the `LANGCHAIN_TRACING_V2` environment variable to true.
You can tell LangChain which project to log to by setting the `LANGCHAIN_PROJECT` environment variable (if this isn't set, runs will be logged to the `default` project). This will automatically create the project for you if it doesn't exist. You must also set the `LANGCHAIN_ENDPOINT` and `LANGCHAIN_API_KEY` environment variables.

For more information on other ways to set up tracing, please reference the [LangSmith documentation](https://docs.smith.langchain.com/docs/).

However, in this example, we will use environment variables.

```bash
npm install @langchain/core @langchain/openai langsmith uuid
```

```typescript
import { v4 as uuidv4 } from "uuid";
const unique_id = uuidv4().slice(0, 8);
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_PROJECT = `JS Tracing Walkthrough - ${unique_id}`;
process.env.LANGCHAIN_ENDPOINT = "https://api.smith.langchain.com";
process.env.LANGCHAIN_API_KEY = "<YOUR-API-KEY>"; // Replace with your API key

// For the chain in this tutorial
process.env.OPENAI_API_KEY = "<YOUR-OPENAI-API-KEY>";
// You can make an API key here: https://app.tavily.com/sign-in
process.env.TAVILY_API_KEY = "<YOUR-TAVILY-API-KEY>";
```

Create the langsmith client to interact with the API

```typescript
import { Client } from "langsmith";

const client = new Client();
```

Create a LangChain component and log runs to the platform. In this example, we will create a ReAct-style agent with access to a general search tool (DuckDuckGo). The agent's prompt can be viewed in the [Hub here](https://smith.langchain.com/hub/wfh/langsmith-agent-prompt).

```typescript
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { DocumentInterface } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableMap } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";

const retriever = new TavilySearchAPIRetriever({
  k: 10,
});
const formatDocs = (docs: DocumentInterface[]) =>
  docs.map((doc, i) => {
    const metadataAttributes = Object.keys(doc.metadata)
      .map((key) => `${key}="${doc.metadata[key]}"`)
      .join(" ");
    return `<Document id="${i}" ${metadataAttributes}>\n${doc.pageContent}\n</Document>\n`;
  });

const llm = new ChatOpenAI({});
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are an AI assistant. Answer user questions as best as you are able." +
      " Use the following search results if applicable.\n" +
      " {docs}",
  ],
  ["human", "{input}"],
]);

const getString = (input: { input: string }) => input.input;
const selectInput = new RunnableLambda({
  func: getString,
});

const chain = RunnableMap.from({
  input: selectInput,
  docs: selectInput.pipe(retriever).pipe(formatDocs),
})
  .pipe(prompt)
  .pipe(llm)
  .pipe(new StringOutputParser());
```

This setup lets you run the chain on multiple inputs concurrently, reducing latency. The runs are logged to LangSmith in the background.

```typescript
const inputs = [
  "What is LangChain?",
  "What's LangSmith?",
  "When was Llama-v2 released?",
  "What is the langsmith cookbook?",
  "When did langchain first announce the hub?",
];

const inputList = inputs.map((input) => ({ input }));
const results = await chain.batch(inputList)
);
console.log(results.slice(0, 2));
```

```out
[
  'LangChain is a framework that allows developers to build applications powered by Large Language Models (LLMs). It provides a set of modules and tools to integrate LLMs with external data sources, customize prompts, and create advanced language model systems. LangChain enables users to create context-aware applications and leverage the power of natural language processing (NLP). It offers features such as customizable prompts, flexible components, and model integration for data augmented generation. LangChain has integrations with various LLM providers and external data sources, making it a comprehensive solution for developing NLP applications.',
  'LangSmith is a platform developed by LangChain that provides tools for debugging, testing, evaluating, and monitoring Language Learning Models (LLMs) and intelligent agents. It helps developers move from prototyping to production by offering features such as trace logging, performance metrics, evaluation tools, and dataset management. LangSmith seamlessly integrates with LangChain, an open-source framework for building LLM applications. The platform allows developers to create and manage prompts, collaborate with teams, collect feedback, and monitor the performance of their LLM applications.'
]
```

After setting up your environment, your agent traces should appear in the Projects section on the LangSmith app. Congratulations!

If the agent is not effectively using the tools, evaluate it to establish a baseline.

## Evaluate the Chain

LangSmith allows you to test and evaluate your LLM applications. Follow these steps to benchmark your agent:

### 1. Create a LangSmith dataset

Use the LangSmith client to create a dataset with input questions and corresponding labels.

For more information on datasets, including how to create them from CSVs or other files or how to create them in the platform, please refer to the [LangSmith documentation](https://docs.smith.langchain.com/).

```typescript
const outputs = [
  "LangChain is an open-source framework for building applications using large language models. It is also the name of the company building LangSmith.",
  "LangSmith is a unified platform for debugging, testing, and monitoring language model applications and agents powered by LangChain",
  "July 18, 2023",
  "The langsmith cookbook is a github repository containing detailed examples of how to use LangSmith to debug, evaluate, and monitor large language model-powered applications.",
  "September 5, 2023",
];
const datasetName = `lcjs-qa-${unique_id}`;
const dataset = await client.createDataset(datasetName);

await Promise.all(
  inputs.map(async (input, i) => {
    await client.createExample(
      { input },
      { output: outputs[i] },
      {
        datasetId: dataset.id,
      }
    );
  })
);
```

### 2. Configure evaluation

Manually comparing the results of chains in the UI is effective, but it can be time consuming.
It can be helpful to use automated metrics and AI-assisted feedback to evaluate your component's performance.

Below, we will create a custom run evaluator that logs a heuristic evaluation.

```typescript
import { RunEvalConfig } from "langchain/smith";
import { Run, Example } from "langsmith";

// An illustrative custom evaluator example
const notUnsure = (props: { run: Run; example?: Example }) => ({
  key: "not_unsure",
  score: !props.run?.outputs?.output.includes("not sure"),
});

const evaluation = new RunEvalConfig({
  // The 'evaluators' are loaded from LangChain's evaluation
  // library.
  evaluators: [
    new RunEvalConfig.LabeledCriteria({
      criteria: "correctness",
      feedbackKey: "correctness",
    }),
  ],
  // Custom evaluators can be user-defined RunEvaluator's
  // or compatible function
  customEvaluators: [notUnsure],
});
```

### 3. Run the Benchmark

Use the [runOnDataset](https://api.js.langchain.com/functions/langchain_smith.runOnDataset.html) function to evaluate your model. This will:

1. Fetch example rows from the specified dataset.
2. Run your chain, agent (or any custom function) on each example.
3. Apply evaluators to the resulting run traces and corresponding reference examples to generate automated feedback.

The results will be visible in the LangSmith app.

```typescript
import { runOnDataset } from "langchain/smith";

await runOnDataset(chain, datasetName, {
  evaluation,
});
```

```out
Predicting: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100.00% | 5/5
Completed
Running Evaluators: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100.00% | 5/5
```

### Review the test results

You can review the test results tracing UI below by clicking the URL in the output above or navigating to the "Testing & Datasets" page in LangSmith **"lcjs-qa-{unique_id}"** dataset.

This will show the new runs and the feedback logged from the selected evaluators. You can also explore a summary of the results in tabular format below.

## Conclusion

Congratulations! You have successfully traced and evaluated a chain using LangSmith!

This was a quick guide to get started, but there are many more ways to use LangSmith to speed up your developer flow and produce better results.

For more information on how you can get the most out of LangSmith, check out [LangSmith documentation](https://docs.smith.langchain.com/), and please reach out with questions, feature requests, or feedback at [support@langchain.dev](mailto:support@langchain.dev).
