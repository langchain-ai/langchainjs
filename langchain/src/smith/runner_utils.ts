import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Runnable, RunnableLambda } from "@langchain/core/runnables";
import { RunCollectorCallbackHandler } from "@langchain/core/tracers/run_collector";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { Client, Example, Feedback, Run } from "langsmith";
import { RunEvaluator } from "langsmith/evaluation";
import { KVMap, ValueType } from "langsmith/schemas";
import { RunnableConfig } from "../schema/runnable/config.js";
import { randomName } from "./name_generation.js";

/**
 * Represents the result of an evaluation.
 */
export type EvaluationResult = {
  /**
   * The key associated with the evaluation result.
   */
  key: string;
  /**
   * The score of the evaluation result.
   */
  score?: number | boolean;
  /**
   * The value of the evaluation result.
   */
  value?: ValueType;
  /**
   * A comment associated with the evaluation result.
   */
  comment?: string;
  /**
   * A correction record associated with the evaluation result.
   */
  correction?: Record<string, any>;
  /**
   * Information about the evaluator.
   */
  evaluator_info?: Record<string, any>;
  /**
   * The source run ID of the evaluation result.
   */
  source_run_id?: string;
  /**
   * The target run ID of the evaluation result.
   */
  target_run_id?: string;
};

export type CoercableRunEvaluator =
  | (({
      run,
      example,
    }: {
      run: Run;
      example?: Example;
    }) => Promise<EvaluationResult>)
  | (({ run, example }: { run: Run; example?: Example }) => EvaluationResult);

export type ChainOrFactory =
  | Runnable
  | (() => Runnable)
  | ((obj: any) => any)
  | (() => (obj: any) => any);
export type RunEvalConfig = {
  customEvaluators?: (RunEvaluator | CoercableRunEvaluator)[];
};

class LoadedEvalConfig {
  constructor(public evaluators: (RunEvaluator | DynamicRunEvaluator)[]) {}

  static fromRunEvalConfig(config: RunEvalConfig): LoadedEvalConfig {
    const evaluators = config?.customEvaluators?.map((evaluator) => {
      if (typeof evaluator === "function") {
        return new DynamicRunEvaluator(evaluator);
      } else {
        return evaluator;
      }
    });
    return new LoadedEvalConfig(evaluators ?? []);
  }
}

export type RunOnDatasetParams = {
  evaluation?: RunEvalConfig;
  projectMetadata?: Record<string, any>;
  projectName?: string;
  client?: Client;
  maxConcurrency?: number;
};

const createWrappedModel = async (modelOrFactory: ChainOrFactory) => {
  if (modelOrFactory instanceof Runnable) {
    return () => modelOrFactory;
  }
  if (typeof modelOrFactory === "function") {
    try {
      // If it works with no arguments, assume it's a factory
      let res = (modelOrFactory as () => Runnable)();
      if (res instanceof Promise) {
        res = await res;
      }
      return modelOrFactory as () => Runnable;
    } catch (err) {
      // Otherwise, it's a custom UDF, and we'll wrap
      // in a lambda
      const wrappedModel = new RunnableLambda({ func: modelOrFactory });
      return () => wrappedModel;
    }
  }
  throw new Error("Invalid modelOrFactory");
};

const loadExamples = async ({
  datasetName,
  client,
  projectName,
}: {
  datasetName: string;
  client: Client;
  projectName: string;
  maxConcurrency: number;
}) => {
  const exampleIterator = client.listExamples({ datasetName });
  const configs: RunnableConfig[] = [];
  const runCollectors = [];
  const examples = [];
  for await (const example of exampleIterator) {
    let runCollector = new RunCollectorCallbackHandler({
      exampleId: example.id,
    });
    configs.push({
      callbacks: [
        new LangChainTracer({ exampleId: example.id, projectName }),
        runCollector,
      ],
    });
    examples.push(example);
    runCollectors.push(runCollector);
  }
  return {
    configs,
    examples,
    runCollectors,
  };
};

class DynamicRunEvaluator implements RunEvaluator {
  evaluator: RunnableLambda<
    {
      run: Run;
      example?: Example;
    },
    EvaluationResult
  >;
  constructor(evaluator: CoercableRunEvaluator) {
    this.evaluator = new RunnableLambda({ func: evaluator });
  }
  async evaluateRun(run: Run, example?: Example): Promise<EvaluationResult> {
    return await this.evaluator.invoke({ run, example });
  }
}

const runEvaluation = async ({
  evaluation,
  runs,
  examples,
  client,
}: {
  evaluation: LoadedEvalConfig;
  runs: Run[];
  examples: Example[];
  client: Client;
}) => {
  // TODO: Parallelize
  const evaluators = evaluation.evaluators;
  const results: Record<string, Feedback[]> = {};
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const example = examples[i];
    const result = await Promise.all(
      evaluators.map((evaluator) =>
        client.evaluateRun(run, evaluator, { referenceExample: example })
      )
    );
    results[run.id] = result;
  }
  return results;
};

export const runOnDataset = async (
  chainOrFactory: ChainOrFactory,
  datasetName: string,
  {
    evaluation,
    projectName,
    projectMetadata,
    client,
    maxConcurrency,
  }: RunOnDatasetParams
) => {
  const wrappedModel = await createWrappedModel(chainOrFactory);
  client = client ?? new Client();
  projectName = projectName ?? randomName();
  const datasetId = (await client.readDataset({ datasetName })).id;
  maxConcurrency = maxConcurrency ?? 5;
  const { configs, examples, runCollectors } = await loadExamples({
    datasetName,
    client,
    projectName,
    maxConcurrency,
  });
  // If it's a language model and ALL example inputs have a single value,
  // then we can be friendly and flatten the inputs to a list of strings.
  const isLanguageModel = chainOrFactory instanceof BaseLanguageModel;
  let runInputs: (string | KVMap)[] = [];
  if (
    isLanguageModel &&
    examples.every(({ inputs }) => Object.keys(inputs).length === 1)
  ) {
    runInputs = examples.map(({ inputs }) => Object.values(inputs)[0]);
  } else runInputs = examples.map(({ inputs }) => inputs);
  const loadedEvalConfig = LoadedEvalConfig.fromRunEvalConfig(evaluation ?? {});

  await client.createProject({
    projectName: projectName,
    referenceDatasetId: datasetId,
    projectExtra: { metadata: { ...projectMetadata } },
  });
  const wrappedRunnable: Runnable = new RunnableLambda({
    func: wrappedModel,
  });
  await wrappedRunnable.batch(runInputs, configs, {
    maxConcurrency,
  });
  const runs: Run[] = [];
  const evalConfigs = [];
  for (let i = 0; i < examples.length; i++) {
    runs.push(runCollectors[i].tracedRuns[0]);
    evalConfigs.push({ callbacks: [new RunCollectorCallbackHandler()] });
  }
  let evalResults: Record<string, Feedback[]> = {};
  if (evaluation) {
    evalResults = await runEvaluation({
      evaluation: loadedEvalConfig,
      runs: runs,
      examples: examples,
      client,
    });
  }
  // TODO: Align format with python
  return {
    projectName,
    evalResults,
  };
};
