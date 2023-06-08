/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { LangChainPlusClient } from "langchainplus-sdk";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";
import { OpenAI } from "../../llms/openai.js";
import { runOnDataset } from "../langchainplus.js";

test("Test LangChainPlus Client Run Chat Model Over Simple Dataset", async () => {
  const client: LangChainPlusClient = new LangChainPlusClient({});
  const datasetName = "chat-test";
  const description = "Asking a chat model test things";
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets({});
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    const newDataset = await client.createDataset(datasetName, { description });
    await client.createExample(
      {
        messages: [
          {
            text: "What is the airspeed velocity of an unladen swallow?",
            type: "human",
          },
        ],
      },
      {
        generations: [
          {
            text: "The average airspeed velocity of an unladen European Swallow is about 24 miles per hour or 39 kilometers per hour.",
          },
        ],
      },
      { datasetId: newDataset.id }
    );
  }
  const model = new ChatOpenAI({ temperature: 0 });

  const results = await runOnDataset(datasetName, model, { client });
  console.log(results);
  expect(Object.keys(results).length).toEqual(1);
});

test("Test LangChainPlus Client Run LLM Over Simple Dataset", async () => {
  const client: LangChainPlusClient = new LangChainPlusClient({});
  const datasetName = "llm-test";
  const description = "Asking a chat model test things";
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets({});
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    const newDataset = await client.createDataset(datasetName, { description });
    await client.createExample(
      {
        prompt: "Write LangChain backwards:",
      },
      {
        generations: [
          {
            text: "niarhCgnaL",
          },
        ],
      },
      { datasetId: newDataset.id }
    );
  }
  const model = new OpenAI({ temperature: 0 });
  const randomId = Math.random().toString(36).substring(7);
  const sessionName = `LangChainPlus Client Test ${randomId}`;
  const results = await runOnDataset(datasetName, model, {
    sessionName,
    client,
  });
  console.log(results);
  expect(Object.keys(results).length).toEqual(1);
  const sessions = await client.listSessions();
  expect(sessions.map((s) => s.name)).toContain(sessionName);
  const session = await client.readSession({ sessionName });
  expect(session.name).toBe(sessionName);
  const runs = await client.listRuns({ sessionName });
  expect(runs.length).toBeGreaterThan(0);
  const firstRun = runs[0];
  const run = await client.readRun(firstRun.id);
  expect(run.id).toBe(firstRun.id);
});

test("Test LangChainPlus Client Run Chain Over Simple Dataset", async () => {
  const client: LangChainPlusClient = new LangChainPlusClient({});
  const csvContent = `
input,output
what is 8 to the third power?,8 to the third power is 512
what is 1213 divided by 4345?,approximately 0.2791714614499425
`;
  const blobData = new Blob([Buffer.from(csvContent)]);

  const fileName = "simplemath.csv";
  const description = "Simple Math Dataset";
  const inputKeys = ["input"];
  const outputKeys = ["output"];
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets({});
  if (!datasets.map((d) => d.name).includes(fileName)) {
    await client.uploadCsv({
      csvFile: blobData,
      fileName,
      inputKeys,
      outputKeys,
      description,
    });
  }
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [new Calculator()];

  const executorFactory = async () =>
    await initializeAgentExecutorWithOptions(tools, model, {
      agentType: "chat-conversational-react-description",
      verbose: true,
    });
  console.log("Loaded agent.");

  const results = await runOnDataset(fileName, executorFactory, { client });
  console.log(results);
  expect(Object.keys(results).length).toEqual(2);
});

test("Test LangChainPlus Client Run Chain Over Dataset", async () => {
  const client: LangChainPlusClient = new LangChainPlusClient({});
  const csvContent = `
input,output
How many people live in canada as of 2023?,"approximately 38,625,801"
who is dua lipa's boyfriend? what is his age raised to the .43 power?,her boyfriend is Romain Gravas. his age raised to the .43 power is approximately 4.9373857399466665
how far is it from paris to boston in miles,"approximately 3,435 mi"
what was the tjtal number of points scored in the 2023 super bowl? what is that number raised to the .23 power?,approximately 2.682651500990882
`;
  const blobData = new Blob([Buffer.from(csvContent)]);

  const datasetName = "mathy.csv";
  const description = "Silly Math Dataset";
  const inputKeys = ["input"];
  const outputKeys = ["output"];
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets({});
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    await client.uploadCsv({
      csvFile: blobData,
      fileName: datasetName,
      inputKeys,
      outputKeys,
      description,
    });
  }
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executorFactory = async () =>
    await initializeAgentExecutorWithOptions(tools, model, {
      agentType: "chat-conversational-react-description",
      verbose: true,
    });
  console.log("Loaded agent.");

  const results = await runOnDataset(datasetName, executorFactory, { client });
  console.log(results);
  expect(Object.keys(results).length).toEqual(4);
});
