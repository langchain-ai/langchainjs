import { BaseLanguageModel } from "../../base_language/index.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { BaseChain, ChainInputs } from "../../chains/base.js";
import { SerializedBaseChain } from "../../chains/serde.js";
import { Document } from "../../document.js";
import { ChainValues } from "../../schema/index.js";
import { Optional } from "../../types/type-utils.js";
import { VectorStore } from "../../vectorstores/base.js";
import { TaskCreationChain } from "./task_creation.js";
import { TaskExecutionChain } from "./task_execution.js";
import { TaskPrioritizationChain } from "./task_prioritization.js";

/**
 * Interface defining the structure of a task. A task has a `taskID` and a
 * `taskName`.
 */
export interface Task {
  taskID: string;
  taskName: string;
}

/**
 * Interface defining the structure of the inputs for the `BabyAGI` class.
 * It extends the `ChainInputs` interface, omitting the 'memory' and
 * 'callbackManager' properties, and adds properties specific to
 * `BabyAGI`.
 */
export interface BabyAGIInputs
  extends Omit<ChainInputs, "memory" | "callbackManager"> {
  creationChain: BaseChain;
  prioritizationChain: BaseChain;
  executionChain: BaseChain;
  vectorstore: VectorStore;
  maxIterations?: number;
}

/**
 * Class responsible for managing tasks, including their creation,
 * prioritization, and execution. It uses three chains for these
 * operations: `creationChain`, `prioritizationChain`, and
 * `executionChain`.
 * @example
 * ```typescript
 * const babyAGI = BabyAGI.fromLLM({
 *   llm: new OpenAI({ temperature: 0 }),
 *   vectorstore: new MemoryVectorStore(new OpenAIEmbeddings()),
 *   maxIterations: 3,
 * });
 *
 * const result = await babyAGI.call({
 *   objective: "Write a weather report for SF today",
 * });
 * ```
 */
export class BabyAGI extends BaseChain implements BabyAGIInputs {
  static lc_name() {
    return "BabyAGI";
  }

  taskList: Task[];

  creationChain: BaseChain;

  prioritizationChain: BaseChain;

  executionChain: BaseChain;

  taskIDCounter: number;

  vectorstore: VectorStore;

  maxIterations: number;

  constructor({
    creationChain,
    prioritizationChain,
    executionChain,
    vectorstore,
    maxIterations = 100,
    verbose,
    callbacks,
  }: BabyAGIInputs) {
    super(undefined, verbose, callbacks);
    this.taskList = [];
    this.creationChain = creationChain;
    this.prioritizationChain = prioritizationChain;
    this.executionChain = executionChain;
    this.taskIDCounter = 1;
    this.vectorstore = vectorstore;
    this.maxIterations = maxIterations;
  }

  _chainType() {
    return "BabyAGI" as const;
  }

  get inputKeys() {
    return ["objective", "firstTask"];
  }

  get outputKeys() {
    return [];
  }

  /**
   * Adds a task to the task list.
   * @param task The task to be added.
   * @returns Promise resolving to void.
   */
  async addTask(task: Task) {
    this.taskList.push(task);
  }

  /**
   * Prints the current task list to the console.
   * @returns void
   */
  printTaskList() {
    console.log("\x1b[95m\x1b[1m\n*****TASK LIST*****\n\x1b[0m\x1b[0m");
    for (const t of this.taskList) {
      console.log(`${t.taskID}: ${t.taskName}`);
    }
  }

  /**
   * Prints the next task to the console.
   * @param task The next task to be printed.
   * @returns void
   */
  printNextTask(task: Task) {
    console.log("\x1b[92m\x1b[1m\n*****NEXT TASK*****\n\x1b[0m\x1b[0m");
    console.log(`${task.taskID}: ${task.taskName}`);
  }

  /**
   * Prints the result of a task to the console.
   * @param result The result of the task.
   * @returns void
   */
  printTaskResult(result: string) {
    console.log("\x1b[93m\x1b[1m\n*****TASK RESULT*****\n\x1b[0m\x1b[0m");
    console.log(result.trim());
  }

  /**
   * Generates the next tasks based on the result of the previous task, the
   * task description, and the objective.
   * @param result The result of the previous task.
   * @param task_description The description of the task.
   * @param objective The objective of the task.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns Promise resolving to an array of tasks without taskID.
   */
  async getNextTasks(
    result: string,
    task_description: string,
    objective: string,
    runManager?: CallbackManagerForChainRun
  ): Promise<Optional<Task, "taskID">[]> {
    const taskNames = this.taskList.map((t) => t.taskName);
    const incomplete_tasks = taskNames.join(", ");
    const { [this.creationChain.outputKeys[0]]: text } =
      await this.creationChain.call(
        {
          result,
          task_description,
          incomplete_tasks,
          objective,
        },
        runManager?.getChild()
      );
    const newTasks = (text as string).split("\n");
    return newTasks
      .filter((taskName) => taskName.trim())
      .map((taskName) => ({ taskName }));
  }

  /**
   * Prioritizes the tasks based on the current task ID and the objective.
   * @param thisTaskID The ID of the current task.
   * @param objective The objective of the task.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns Promise resolving to an array of prioritized tasks.
   */
  async prioritizeTasks(
    thisTaskID: number,
    objective: string,
    runManager?: CallbackManagerForChainRun
  ) {
    const taskNames = this.taskList.map((t) => t.taskName);
    const nextTaskID = thisTaskID + 1;
    const { [this.prioritizationChain.outputKeys[0]]: text } =
      await this.prioritizationChain.call(
        {
          task_names: taskNames.join(", "),
          next_task_id: String(nextTaskID),
          objective,
        },
        runManager?.getChild()
      );
    const newTasks = (text as string).trim().split("\n");
    const prioritizedTaskList = [];
    for (const taskString of newTasks) {
      const taskParts = taskString.trim().split(".", 2);
      if (taskParts.length === 2) {
        const taskID = taskParts[0].trim();
        const taskName = taskParts[1].trim();
        prioritizedTaskList.push({ taskID, taskName });
      }
    }
    return prioritizedTaskList;
  }

  /**
   * Retrieves the top tasks that are most similar to the given query.
   * @param query The query to search for.
   * @param k The number of top tasks to retrieve.
   * @returns Promise resolving to an array of top tasks.
   */
  async getTopTasks(query: string, k = 5) {
    const results = await this.vectorstore.similaritySearch(query, k);
    if (!results) {
      return [];
    }
    return results.map((item) => String(item.metadata.task));
  }

  /**
   * Executes a task based on the objective and the task description.
   * @param objective The objective of the task.
   * @param task The task to be executed.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns Promise resolving to the result of the task execution as a string.
   */
  async executeTask(
    objective: string,
    task: string,
    runManager?: CallbackManagerForChainRun
  ) {
    const context = await this.getTopTasks(objective);
    const { [this.executionChain.outputKeys[0]]: text } =
      await this.executionChain.call(
        {
          objective,
          context: context.join("\n"),
          task,
        },
        runManager?.getChild()
      );
    return text as string;
  }

  async _call(
    { objective, firstTask = "Make a todo list" }: ChainValues,
    runManager?: CallbackManagerForChainRun
  ) {
    this.taskList = [];
    this.taskIDCounter = 1;
    await this.addTask({ taskID: "1", taskName: firstTask });

    let numIters = 0;
    while (numIters < this.maxIterations && this.taskList.length > 0) {
      this.printTaskList();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const task = this.taskList.shift()!;
      this.printNextTask(task);

      const result = await this.executeTask(
        objective,
        task.taskName,
        runManager
      );
      const thisTaskID = parseInt(task.taskID, 10);
      this.printTaskResult(result);

      await this.vectorstore.addDocuments([
        new Document({
          pageContent: result,
          metadata: { task: task.taskName },
        }),
      ]);

      const newTasks = await this.getNextTasks(
        result,
        task.taskName,
        objective,
        runManager
      );
      for (const newTask of newTasks) {
        this.taskIDCounter += 1;
        newTask.taskID = this.taskIDCounter.toFixed();
        await this.addTask(newTask as Task);
      }
      this.taskList = await this.prioritizeTasks(
        thisTaskID,
        objective,
        runManager
      );

      numIters += 1;
    }
    return {};
  }

  serialize(): SerializedBaseChain {
    throw new Error("Method not implemented.");
  }

  /**
   * Static method to create a new BabyAGI instance from a
   * BaseLanguageModel.
   * @param llm BaseLanguageModel instance used to generate a new BabyAGI instance.
   * @param vectorstore VectorStore instance used to store and retrieve vectors.
   * @param executionChain Optional BaseChain instance used to execute tasks.
   * @param verbose Optional boolean indicating whether to log verbose output.
   * @param callbacks Optional callbacks to be used during the execution of tasks.
   * @param rest Optional additional parameters.
   * @returns A new instance of BabyAGI.
   */
  static fromLLM({
    llm,
    vectorstore,
    executionChain,
    verbose,
    callbacks,
    ...rest
  }: Optional<
    BabyAGIInputs,
    "executionChain" | "creationChain" | "prioritizationChain"
  > & { llm: BaseLanguageModel }) {
    const creationChain = TaskCreationChain.fromLLM({
      llm,
      verbose,
      callbacks,
    });
    const prioritizationChain = TaskPrioritizationChain.fromLLM({
      llm,
      verbose,
      callbacks,
    });
    return new BabyAGI({
      creationChain,
      prioritizationChain,
      executionChain:
        executionChain ||
        TaskExecutionChain.fromLLM({ llm, verbose, callbacks }),
      vectorstore,
      verbose,
      callbacks,
      ...rest,
    });
  }
}
