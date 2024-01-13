import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { mapStoredMessagesToChatMessages } from "@langchain/core/messages";
import { Runnable, RunnableLambda } from "@langchain/core/runnables";
import { RunCollectorCallbackHandler } from "@langchain/core/tracers/run_collector";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { Client, Example, Feedback, Run } from "langsmith";
import { RunEvaluator } from "langsmith/evaluation";
import { DataType, ValueType } from "langsmith/schemas";
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
  correction?: Record<string, unknown>;
  /**
   * Information about the evaluator.
   */
  evaluator_info?: Record<string, unknown>;
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
  | ((obj: unknown) => unknown)
  | ((obj: unknown) => Promise<unknown>)
  | (() => (obj: unknown) => unknown)
  | (() => (obj: unknown) => Promise<unknown>);
export type RunEvalConfig = {
  customEvaluators?: (RunEvaluator | CoercableRunEvaluator)[];
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
  projectMetadata?: Record<string, unknown>;
  projectName?: string;
  client?: Client;
  maxConcurrency?: number;
};

const createWrappedModel = async (modelOrFactory: ChainOrFactory) => {
  if (Runnable.isRunnable(modelOrFactory)) {
    return () => modelOrFactory;
  }
  if (typeof modelOrFactory === "function") {
    try {
      // If it works with no arguments, assume it's a factory
      let res = (modelOrFactory as () => Runnable)();
      if (
        res &&
        typeof (res as unknown as Promise<Runnable>).then === "function"
      ) {
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
    const runCollector = new RunCollectorCallbackHandler({
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
  // TODO: Parallelize and/or put in callbacks
  const { evaluators } = evaluation;
  const results: Record<
    string,
    { run_id: string; execution_time?: number; feedback: Feedback[] }
  > = {};
  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];
    const example = examples[i];
    const result = await Promise.all(
      evaluators.map((evaluator) =>
        client.evaluateRun(run, evaluator, {
          referenceExample: example,
          loadChildRuns: false,
        })
      )
    );
    results[example.id] = {
      execution_time:
        run?.end_time && run.start_time
          ? run.end_time - run.start_time
          : undefined,
      feedback: result,
      run_id: run.id,
    };
  }
  return results;
};

export type EvalResults = {
  projectName: string;
  results: {
    [key: string]: {
      execution_time?: number;
      run_id: string;
      feedback: Feedback[];
    };
  };
};

const getExamplesinputs = (
  examples: Example[],
  chainOrFactory: ChainOrFactory,
  dataType?: DataType
) => {
  if (dataType === "chat") {
    // For some batty reason, we store the chat dataset differently.
    // Stored  like { type: "system", data: { content: inputs.input } },
    // But we need to create AIMesage, SystemMessage, etc.
    return examples.map(({ inputs }) =>
      mapStoredMessagesToChatMessages(inputs.input)
    );
  }
  // If it's a language model and ALL example inputs have a single value,
  // then we can be friendly and flatten the inputs to a list of strings.
  const isLanguageModel =
    typeof chainOrFactory === "object" &&
    typeof (chainOrFactory as BaseLanguageModel)._llmType === "function";
  if (
    isLanguageModel &&
    examples.every(({ inputs }) => Object.keys(inputs).length === 1)
  ) {
    return examples.map(({ inputs }) => Object.values(inputs)[0]);
  }
  return examples.map(({ inputs }) => inputs);
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
  const testClient = client ?? new Client();
  const testProjectName = projectName ?? randomName();
  const dataset = await testClient.readDataset({ datasetName });
  const datasetId = dataset.id;
  const testConcurrency = maxConcurrency ?? 5;
  const { configs, examples, runCollectors } = await loadExamples({
    datasetName,
    client: testClient,
    projectName: testProjectName,
    maxConcurrency: testConcurrency,
  });

  const loadedEvalConfig = LoadedEvalConfig.fromRunEvalConfig(evaluation ?? {});

  await testClient.createProject({
    projectName: testProjectName,
    referenceDatasetId: datasetId,
    projectExtra: { metadata: { ...projectMetadata } },
  });
  const wrappedRunnable: Runnable = new RunnableLambda({
    func: wrappedModel,
  });
  const runInputs = getExamplesinputs(
    examples,
    chainOrFactory,
    dataset.data_type
  );
  await wrappedRunnable.invoke(runInputs[0]);
  await wrappedRunnable.batch(runInputs, configs, {
    maxConcurrency,
  });
  const runs: Run[] = [];
  const evalConfigs = [];
  for (let i = 0; i < examples.length; i += 1) {
    runs.push(runCollectors[i].tracedRuns[0]);
    evalConfigs.push({ callbacks: [new RunCollectorCallbackHandler()] });
  }
  let evalResults: Record<
    string,
    { run_id: string; execution_time?: number; feedback: Feedback[] }
  > = {};
  if (evaluation) {
    evalResults = await runEvaluation({
      evaluation: loadedEvalConfig,
      runs,
      examples,
      client: testClient,
    });
  }
  const results: EvalResults = {
    projectName: testProjectName,
    results: evalResults ?? {},
  };
  return results;
};
