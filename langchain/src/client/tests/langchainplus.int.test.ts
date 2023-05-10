/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { LangChainPlusClient } from "../langchainplus.js";

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
