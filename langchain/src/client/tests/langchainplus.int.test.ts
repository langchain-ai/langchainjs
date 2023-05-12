/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { LangChainPlusClient } from "../langchainplus.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";
import { OpenAI } from "../../llms/openai.js";

test("Test LangChainPlus Client Dataset CRD", async () => {
  const client: LangChainPlusClient = await LangChainPlusClient.create(
    "http://localhost:8000"
  );

  const csvContent = `col1,col2\nval1,val2`;
  const blobData = new Blob([Buffer.from(csvContent)]);

  const description = "Test Dataset";
  const inputKeys = ["col1"];
  const outputKeys = ["col2"];

  const newDataset = await client.uploadCsv(
    blobData,
    "some_file.csv",
    description,
    inputKeys,
    outputKeys
  );
  expect(newDataset).toHaveProperty("id");
  expect(newDataset.description).toBe(description);

  const dataset = await client.readDataset(newDataset.id, undefined);
  const datasetId = dataset.id;
  const dataset2 = await client.readDataset(datasetId, undefined);
  expect(dataset.id).toBe(dataset2.id);

  const datasets = await client.listDatasets();
  expect(datasets.length).toBeGreaterThan(0);
  expect(datasets.map((d) => d.id)).toContain(datasetId);

  // Test Example CRD
  const example = await client.createExample(
    { col1: "addedExampleCol1" },
    { col2: "addedExampleCol2" },
    newDataset.id
  );
  const exampleValue = await client.readExample(example.id);
  expect(exampleValue.inputs.col1).toBe("addedExampleCol1");
  expect(exampleValue.outputs.col2).toBe("addedExampleCol2");

  const examples = await client.listExamples(newDataset.id);
  expect(examples.length).toBe(2);
  expect(examples.map((e) => e.id)).toContain(example.id);

  const deletedExample = await client.deleteExample(example.id);
  expect(deletedExample.id).toBe(example.id);
  const examples2 = await client.listExamples(newDataset.id);
  expect(examples2.length).toBe(1);

  const deleted = await client.deleteDataset(datasetId, undefined);
  expect(deleted.id).toBe(datasetId);
});

test("Test LangChainPlus Client Run Chat Model Over Simple Dataset", async () => {
  const client: LangChainPlusClient = await LangChainPlusClient.create(
    "http://localhost:8000"
  );
  const datasetName = "chat-test";
  const description = "Asking a chat model test things";
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets();
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    const newDataset = await client.createDataset(datasetName, description);
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
      newDataset.id
    );
  }
  const model = new ChatOpenAI({ temperature: 0 });

  const results = await client.runOnDataset(datasetName, model);
  console.log(results);
  expect(Object.keys(results).length).toEqual(1);
});

test("Test LangChainPlus Client Run LLM Over Simple Dataset", async () => {
  const client: LangChainPlusClient = await LangChainPlusClient.create(
    "http://localhost:8000"
  );
  const datasetName = "llm-test";
  const description = "Asking a chat model test things";
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets();
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    const newDataset = await client.createDataset(datasetName, description);
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
      newDataset.id
    );
  }
  const model = new OpenAI({ temperature: 0 });
  const results = await client.runOnDataset(datasetName, model);
  console.log(results);
  expect(Object.keys(results).length).toEqual(1);
});

test("Test LangChainPlus Client Run Chain Over Simple Dataset", async () => {
  const client: LangChainPlusClient = await LangChainPlusClient.create(
    "http://localhost:8000"
  );
  const csvContent = `
input,output
what is 8 to the third power?,8 to the third power is 512
what is 1213 divided by 4345?,approximately 0.2791714614499425
`;
  const blobData = new Blob([Buffer.from(csvContent)]);

  const datasetName = "simplemath.csv";
  const description = "Simple Math Dataset";
  const inputKeys = ["input"];
  const outputKeys = ["output"];
  // Check if dataset name exists in listDatasets
  const datasets = await client.listDatasets();
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    await client.uploadCsv(
      blobData,
      datasetName,
      description,
      inputKeys,
      outputKeys
    );
  }
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const results = await client.runOnDataset(datasetName, executor);
  console.log(results);
  expect(Object.keys(results).length).toEqual(2);
});

test("Test LangChainPlus Client Run Chain Over Dataset", async () => {
  const client: LangChainPlusClient = await LangChainPlusClient.create(
    "http://localhost:8000"
  );
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
  const datasets = await client.listDatasets();
  if (!datasets.map((d) => d.name).includes(datasetName)) {
    await client.uploadCsv(
      blobData,
      datasetName,
      description,
      inputKeys,
      outputKeys
    );
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

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const results = await client.runOnDataset(datasetName, executor);
  console.log(results);
  expect(Object.keys(results).length).toEqual(10);
});
