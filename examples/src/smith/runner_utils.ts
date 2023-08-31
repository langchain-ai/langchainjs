import { Client } from "langsmith";
import { Dataset } from "langsmith/schemas";
import { v4 as uuidv4 } from "uuid";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  LangChainTracer,
  RunCollectorCallbackHandler,
} from "langchain/callbacks";
import { RunnableLambda } from "langchain/schema/runnable";
import { BaseMessageChunk } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";

const client = new Client();
const data = [
  ["a rap battle between Atticus Finch and Cicero", "Atticus Finch vs. Cicero"],
  ["a rap battle between Barbie and Oppenheimer", "Barbie vs. Oppenheimer"],
];

const datasetName = "Rap Battle Dataset";
let dataset: Dataset;
try {
  dataset = await client.createDataset(datasetName, {
    description: "Rap battle prompts.",
  });
  for (const [input, output] of data) {
    await client.createExample(
      { input },
      { output },
      { datasetId: dataset.id }
    );
  }
} catch (e) {
  try {
    dataset = await client.readDataset({ datasetName: datasetName });
    console.log(dataset);
  } catch (e) {
    throw e;
  }
}

// # Create a chain that uses the dataset
const prompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate("You are in a rap battle."),
  HumanMessagePromptTemplate.fromTemplate("Write the following {input}"),
]);
const model = new ChatOpenAI({ temperature: 0 });
const chain = prompt.pipe(model).pipe(new StringOutputParser());

// Generate predictions
const examples = client.listExamples({ datasetId: dataset.id });
const configs = [];
const runCollectors = [];
const inputs = [];
const references = [];
const projectName = `Test Project ${uuidv4()}`;
for await (const example of examples) {
  runCollectors.push(
    new RunCollectorCallbackHandler({ exampleId: example.id })
  );
  configs.push({
    callbacks: [
      new LangChainTracer({ exampleId: example.id, projectName }),
      runCollectors[runCollectors.length - 1],
    ],
  });
  inputs.push(example.inputs);
  references.push(example.outputs);
}

const predictions = await chain.batch(inputs, configs);

// Define an evaluator chain
const evalPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate("You are an impartial judge."),
  HumanMessagePromptTemplate.fromTemplate(
    "Respond with CORRECT or INCORRECT based on the following:" +
      "\n\nInput: {input}\n\nPrediction: {output}\n\n{reference}"
  ),
]);

// Create a parseScore function that conversts CORRECT and INCORRECT to 1 and 0
const parseScore = (val: BaseMessageChunk) => {
  if (val.content === "CORRECT") {
    return 1;
  } else if (val.content === "INCORRECT") {
    return 0;
  } else {
    return null;
  }
};

const evalChain = evalPrompt
  .pipe(new ChatOpenAI({ modelName: "gpt-4", temperature: 0 }))
  .pipe(new RunnableLambda({ func: parseScore }));

// Combine inputs, predictions, and references into a single batch
const batch = [];
const runIds = [];
const evalConfigs = [];
for (let i = 0; i < inputs.length; i++) {
  batch.push({
    input: inputs[i],
    output: predictions[i],
    reference: references[i],
  });
  console.log("target run ID", runCollectors[i].tracedRuns[0].id);
  runIds.push(runCollectors[i].tracedRuns[0].id);
  evalConfigs.push({ callbacks: [new RunCollectorCallbackHandler()] });
}

const feedback = await evalChain.batch(batch, evalConfigs);

for (let i = 0; i < feedback.length; i++) {
  console.log("source run ID", evalConfigs[i].callbacks[0].tracedRuns[0].id);
  let runId = runIds[i];
  if (runId !== undefined) {
    await client.createFeedback(runId, "correctness", {
      score: feedback[i],
      sourceRunId: evalConfigs[i].callbacks[0].tracedRuns[0].id,
    });
  }
}
