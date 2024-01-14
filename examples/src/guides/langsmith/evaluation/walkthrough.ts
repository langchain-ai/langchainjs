import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { DocumentInterface } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableMap } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { RunEvalConfig, runOnDataset } from "langchain/smith";
import { Client, Example, Run } from "langsmith";
import { v4 as uuidv4 } from "uuid";

// Step 0, define environment variables and some constants for this example.
process.env.LANGCHAIN_API_KEY = "YOUR_LANGCHAIN_API_KEY_HERE";

// The following are used in our example chain.
process.env.TAVILY_API_KEY = "YOUR_TAVILY_API_KEY_HERE";
process.env.OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE";
const uid = uuidv4();
const datasetName = `lcjs-eval-${uid}`;
const client = new Client({ apiKey: process.env.LANGCHAIN_API_KEY });

// Step 1: Create the dataset. You can do this in code, via CSV, or
// collect from usage trace.
const dataset = await client.createDataset(datasetName);
const inputs = [
  "What is LangChain?",
  "What's LangSmith?",
  "When was Llama-v2 released?",
  "What is the langsmith cookbook?",
  "When did langchain first announce the hub?",
];

const outputs = [
  "LangChain is an open-source framework for building applications using large language models. It is also the name of the company building LangSmith.",
  "LangSmith is a unified platform for debugging, testing, and monitoring language model applications and agents powered by LangChain",
  "July 18, 2023",
  "The langsmith cookbook is a github repository containing detailed examples of how to use LangSmith to debug, evaluate, and monitor large language model-powered applications.",
  "September 5, 2023",
];

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

// Step 2: Create the chain, agent, or other model to evaluate.
// In our case, we will use a simple LLM + Search engine.
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

// Example output
const exampleQuery = "What is the weather like in Kuala Lumpur today?";
const result = await chain.invoke({
  input: exampleQuery,
});
console.log(exampleQuery);
console.log(result);
/* Example Output:
 * The current weather in Kuala Lumpur is 86°F with passing clouds.
 * The temperature is expected to reach a high of 92°F and a low of 75°F.
 * The wind is coming from the west at 5 mph.
 */

// Step 3: Define the evaluation criteria.

const notUnsure = (props: { run: Run; example?: Example }) => ({
  key: "not_unsure",
  score: props.run?.outputs?.output !== "I'm not sure.",
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
  // Custom evaluators can be user-defined RunEvaluator
  // or compatible function
  customEvaluators: [notUnsure],
});

// Step 4: Run the evaluation.
await runOnDataset(chain, datasetName, {
  evaluation,
});

// Step 5: Review the results in LangSmith!
// See https://smith.langchain.com/ to review the results.
