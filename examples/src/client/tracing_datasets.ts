/* eslint-disable no-process-env */
import { ChatOpenAI } from "langchain/chat_models/openai";
import { LangChainPlusClient, Dataset } from "langchain/client";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

// LangChain wants to make developing and deploying safe, high-quality
// language model applications as easy as possible.
// To manage the complexity and challenges of working with LLMs,
// LangChain provides tracing and evaluation functionality.
// This notebook demonstrates how to run Chains,
// which are language model functions on traced datasets.
// Some common use cases for this approach include:
//    - Running an evaluation chain to grade previous runs.
//    - Comparing different chains, LLMs, and agents on traced datasets.
//    - Executing a stochastic chain multiple times over a dataset to generate metrics before deployment.
// Please note that this example assumes you have LangChain+ tracing running in the background.
// It is configured to work only with the V2 endpoints.

export const run = async () => {
  // Capture traces by setting the LANGCHAIN_TRACING_V2 environment variable
  process.env.LANGCHAIN_TRACING_V2 = "true";
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const inputs: string[] = [
    "How many people live in canada as of 2023?",
    "who is dua lipa's boyfriend? what is his age raised to the .43 power?",
    "what is dua lipa's boyfriend age raised to the .43 power?",
    "how far is it from paris to boston in miles",
    "what was the total number of points scored in the 2023 super bowl? what is that number raised to the .23 power?",
  ];
  for (const input of inputs) {
    const result = await executor.call({ input });
    console.log(`Got output ${result.output}`);
  }
  // Now you can navigate to the UI at http://localhost/sessions then:
  // 1. Select the default session from the list.
  // 2. Next to the fist example, click "+ to Dataset".
  // 3. Click "Create Dataset" and select a title like "calculator-example-dataset".
  // 4. Add the other examples to the dataset as well

  // So that you don't have to create the dataset manually, we will create it for you
  const client: LangChainPlusClient = await LangChainPlusClient.create(
    "http://localhost:8000"
  );
  const csvContent = `
input,output
How many people live in canada as of 2023?,"approximately 38,625,801"
who is dua lipa's boyfriend? what is his age raised to the .43 power?,her boyfriend is Romain Gravas. his age raised to the .43 power is approximately 4.9373857399466665
what is dua lipa's boyfriend age raised to the .43 power?,her boyfriend is Romain Gravas. his age raised to the .43 power is approximately 4.9373857399466665
how far is it from paris to boston in miles,"approximately 3,435 mi"
what was the total number of points scored in the 2023 super bowl? what is that number raised to the .23 power?,approximately 2.682651500990882
what was the total number of points scored in the 2023 super bowl raised to the .23 power?,approximately 2.682651500990882
how many more points were scored in the 2023 super bowl than in the 2022 super bowl?,30
what is 153 raised to .1312 power?,approximately 1.9347796717823205
who is kendall jenner's boyfriend? what is his height (in inches) raised to .13 power?,approximately 1.7589107138176394
what is 1213 divided by 4345?,approximately 0.2791714614499425
`;
  const blobData = new Blob([Buffer.from(csvContent)]);

  const datasetName = "mathy.csv";
  const description = "Silly Math Dataset";
  const inputKeys = ["input"];
  const outputKeys = ["output"];
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets();
  if (!datasets.map((d: Dataset) => d.name).includes(datasetName)) {
    await client.uploadCsv(
      blobData,
      datasetName,
      description,
      inputKeys,
      outputKeys
    );
  }

  // If using the traced dataset, you can update the datasetName to be
  // "calculator-example-dataset" or the custom name you chose.
  const results = await client.runOnDataset(datasetName, executor);
  console.log(results);
};
