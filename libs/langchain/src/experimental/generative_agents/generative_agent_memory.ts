import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { ChainValues } from "@langchain/core/utils/types";
import { BaseMemory, InputValues, OutputValues } from "@langchain/core/memory";
import {
  CallbackManagerForChainRun,
  Callbacks,
} from "@langchain/core/callbacks/manager";
import { TimeWeightedVectorStoreRetriever } from "../../retrievers/time_weighted.js";
import { BaseChain } from "../../chains/base.js";
import { LLMChain } from "../../chains/llm_chain.js";

export type GenerativeAgentMemoryConfig = {
  reflectionThreshold?: number;
  importanceWeight?: number;
  verbose?: boolean;
  maxTokensLimit?: number;
};

/**
 * Class that manages the memory of a generative agent in LangChain. It
 * extends the `BaseChain` class and has methods for adding observations
 * or memories to the agent's memory, scoring the importance of a memory,
 * reflecting on recent events to add synthesized memories, and generating
 * insights on a topic of reflection based on pertinent memories.
 */
class GenerativeAgentMemoryChain extends BaseChain {
  static lc_name() {
    return "GenerativeAgentMemoryChain";
  }

  reflecting = false;

  reflectionThreshold?: number;

  importanceWeight = 0.15;

  memoryRetriever: TimeWeightedVectorStoreRetriever;

  llm: BaseLanguageModelInterface;

  verbose = false;

  private aggregateImportance = 0.0;

  constructor(
    llm: BaseLanguageModelInterface,
    memoryRetriever: TimeWeightedVectorStoreRetriever,
    config: Omit<GenerativeAgentMemoryConfig, "maxTokensLimit">
  ) {
    super();
    this.llm = llm;
    this.memoryRetriever = memoryRetriever;
    this.reflectionThreshold = config.reflectionThreshold;
    this.importanceWeight = config.importanceWeight ?? this.importanceWeight;
    this.verbose = config.verbose ?? this.verbose;
  }

  _chainType(): string {
    return "generative_agent_memory";
  }

  get inputKeys(): string[] {
    return ["memory_content", "now", "memory_metadata"];
  }

  get outputKeys(): string[] {
    return ["output"];
  }

  /**
   * Method that creates a new LLMChain with the given prompt.
   * @param prompt The PromptTemplate to use for the new LLMChain.
   * @returns A new LLMChain instance.
   */
  chain(prompt: PromptTemplate): LLMChain {
    const chain = new LLMChain({
      llm: this.llm,
      prompt,
      verbose: this.verbose,
      outputKey: "output",
    });
    return chain;
  }

  async _call(values: ChainValues, runManager?: CallbackManagerForChainRun) {
    const { memory_content: memoryContent, now } = values;
    // add an observation or memory to the agent's memory
    const importanceScore = await this.scoreMemoryImportance(
      memoryContent,
      runManager
    );
    this.aggregateImportance += importanceScore;
    const document = new Document({
      pageContent: memoryContent,
      metadata: {
        importance: importanceScore,
        ...values.memory_metadata,
      },
    });
    await this.memoryRetriever.addDocuments([document]);
    // after an agent has processed a certain amount of memories (as measured by aggregate importance),
    // it is time to pause and reflect on recent events to add more synthesized memories to the agent's
    // memory stream.
    if (
      this.reflectionThreshold !== undefined &&
      this.aggregateImportance > this.reflectionThreshold &&
      !this.reflecting
    ) {
      console.log("Reflecting on current memories...");
      this.reflecting = true;
      await this.pauseToReflect(now, runManager);
      this.aggregateImportance = 0.0;
      this.reflecting = false;
    }
    return { output: importanceScore };
  }

  /**
   * Method that pauses the agent to reflect on recent events and generate
   * new insights.
   * @param now The current date.
   * @param runManager The CallbackManagerForChainRun to use for the reflection.
   * @returns An array of new insights as strings.
   */
  async pauseToReflect(
    now?: Date,
    runManager?: CallbackManagerForChainRun
  ): Promise<string[]> {
    if (this.verbose) {
      console.log("Pausing to reflect...");
    }
    const newInsights: string[] = [];
    const topics = await this.getTopicsOfReflection(50, runManager);
    for (const topic of topics) {
      const insights = await this.getInsightsOnTopic(topic, now, runManager);
      for (const insight of insights) {
        // add memory
        await this.call(
          {
            memory_content: insight,
            now,
            memory_metadata: {
              source: "reflection_insight",
            },
          },
          runManager?.getChild("reflection_insight_memory")
        );
      }
      newInsights.push(...insights);
    }
    return newInsights;
  }

  /**
   * Method that scores the importance of a given memory.
   * @param memoryContent The content of the memory to score.
   * @param runManager The CallbackManagerForChainRun to use for scoring.
   * @returns The importance score of the memory as a number.
   */
  async scoreMemoryImportance(
    memoryContent: string,
    runManager?: CallbackManagerForChainRun
  ): Promise<number> {
    // score the absolute importance of a given memory
    const prompt = PromptTemplate.fromTemplate(
      "On the scale of 1 to 10, where 1 is purely mundane" +
        " (e.g., brushing teeth, making bed) and 10 is" +
        " extremely poignant (e.g., a break up, college" +
        " acceptance), rate the likely poignancy of the" +
        " following piece of memory. Respond with a single integer." +
        "\nMemory: {memory_content}" +
        "\nRating: "
    );
    const score = await this.chain(prompt).run(
      memoryContent,
      runManager?.getChild("determine_importance")
    );

    const strippedScore = score.trim();

    if (this.verbose) {
      console.log("Importance score:", strippedScore);
    }
    const match = strippedScore.match(/^\D*(\d+)/);
    if (match) {
      const capturedNumber = parseFloat(match[1]);
      const result = (capturedNumber / 10) * this.importanceWeight;
      return result;
    } else {
      return 0.0;
    }
  }

  /**
   * Method that retrieves the topics of reflection based on the last K
   * memories.
   * @param lastK The number of most recent memories to consider for generating topics.
   * @param runManager The CallbackManagerForChainRun to use for retrieving topics.
   * @returns An array of topics of reflection as strings.
   */
  async getTopicsOfReflection(
    lastK: number,
    runManager?: CallbackManagerForChainRun
  ): Promise<string[]> {
    const prompt = PromptTemplate.fromTemplate(
      "{observations}\n\n" +
        "Given only the information above, what are the 3 most salient" +
        " high-level questions we can answer about the subjects in" +
        " the statements? Provide each question on a new line.\n\n"
    );

    const observations = this.memoryRetriever.getMemoryStream().slice(-lastK);
    const observationStr = observations
      .map((o: { pageContent: string }) => o.pageContent)
      .join("\n");
    const result = await this.chain(prompt).run(
      observationStr,
      runManager?.getChild("reflection_topics")
    );
    return GenerativeAgentMemoryChain.parseList(result);
  }

  /**
   * Method that generates insights on a given topic of reflection based on
   * pertinent memories.
   * @param topic The topic of reflection.
   * @param now The current date.
   * @param runManager The CallbackManagerForChainRun to use for generating insights.
   * @returns An array of insights as strings.
   */
  async getInsightsOnTopic(
    topic: string,
    now?: Date,
    runManager?: CallbackManagerForChainRun
  ): Promise<string[]> {
    // generate insights on a topic of reflection, based on pertinent memories
    const prompt = PromptTemplate.fromTemplate(
      "Statements about {topic}\n" +
        "{related_statements}\n\n" +
        "What 5 high-level insights can you infer from the above statements?" +
        " (example format: insight (because of 1, 5, 3))"
    );

    const relatedMemories = await this.fetchMemories(topic, now, runManager);
    const relatedStatements: string = relatedMemories
      .map((memory, index) => `${index + 1}. ${memory.pageContent}`)
      .join("\n");
    const result = await this.chain(prompt).call(
      {
        topic,
        related_statements: relatedStatements,
      },
      runManager?.getChild("reflection_insights")
    );
    return GenerativeAgentMemoryChain.parseList(result.output); // added output
  }

  /**
   * Method that parses a newline-separated string into a list of strings.
   * @param text The newline-separated string to parse.
   * @returns An array of strings.
   */
  static parseList(text: string): string[] {
    // parse a newine seperates string into a list of strings
    return text.split("\n").map((s) => s.trim());
  }

  // TODO: Mock "now" to simulate different times
  /**
   * Method that fetches memories related to a given observation.
   * @param observation The observation to fetch memories for.
   * @param _now The current date.
   * @param runManager The CallbackManagerForChainRun to use for fetching memories.
   * @returns An array of Document instances representing the fetched memories.
   */
  async fetchMemories(
    observation: string,
    _now?: Date,
    runManager?: CallbackManagerForChainRun
  ): Promise<Document[]> {
    return this.memoryRetriever.getRelevantDocuments(
      observation,
      runManager?.getChild("memory_retriever")
    );
  }
}

/**
 * Class that manages the memory of a generative agent in LangChain. It
 * extends the `BaseMemory` class and has methods for adding a memory,
 * formatting memories, getting memories until a token limit is reached,
 * loading memory variables, saving the context of a model run to memory,
 * and clearing memory contents.
 * @example
 * ```typescript
 * const createNewMemoryRetriever = async () => {
 *   const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
 *   const retriever = new TimeWeightedVectorStoreRetriever({
 *     vectorStore,
 *     otherScoreKeys: ["importance"],
 *     k: 15,
 *   });
 *   return retriever;
 * };
 * const tommiesMemory = new GenerativeAgentMemory(
 *   llm,
 *   await createNewMemoryRetriever(),
 *   { reflectionThreshold: 8 },
 * );
 * const summary = await tommiesMemory.getSummary();
 * ```
 */
export class GenerativeAgentMemory extends BaseMemory {
  llm: BaseLanguageModelInterface;

  memoryRetriever: TimeWeightedVectorStoreRetriever;

  verbose: boolean;

  reflectionThreshold?: number;

  private maxTokensLimit = 1200;

  queriesKey = "queries";

  mostRecentMemoriesTokenKey = "recent_memories_token";

  addMemoryKey = "addMemory";

  relevantMemoriesKey = "relevant_memories";

  relevantMemoriesSimpleKey = "relevant_memories_simple";

  mostRecentMemoriesKey = "most_recent_memories";

  nowKey = "now";

  memoryChain: GenerativeAgentMemoryChain;

  constructor(
    llm: BaseLanguageModelInterface,
    memoryRetriever: TimeWeightedVectorStoreRetriever,
    config?: GenerativeAgentMemoryConfig
  ) {
    super();
    this.llm = llm;
    this.memoryRetriever = memoryRetriever;
    this.verbose = config?.verbose ?? this.verbose;
    this.reflectionThreshold =
      config?.reflectionThreshold ?? this.reflectionThreshold;
    this.maxTokensLimit = config?.maxTokensLimit ?? this.maxTokensLimit;
    this.memoryChain = new GenerativeAgentMemoryChain(llm, memoryRetriever, {
      reflectionThreshold: config?.reflectionThreshold,
      importanceWeight: config?.importanceWeight,
    });
  }

  /**
   * Method that returns the key for relevant memories.
   * @returns The key for relevant memories as a string.
   */
  getRelevantMemoriesKey(): string {
    return this.relevantMemoriesKey;
  }

  /**
   * Method that returns the key for the most recent memories token.
   * @returns The key for the most recent memories token as a string.
   */
  getMostRecentMemoriesTokenKey(): string {
    return this.mostRecentMemoriesTokenKey;
  }

  /**
   * Method that returns the key for adding a memory.
   * @returns The key for adding a memory as a string.
   */
  getAddMemoryKey(): string {
    return this.addMemoryKey;
  }

  /**
   * Method that returns the key for the current time.
   * @returns The key for the current time as a string.
   */
  getCurrentTimeKey(): string {
    return this.nowKey;
  }

  get memoryKeys(): string[] {
    // Return an array of memory keys
    return [this.relevantMemoriesKey, this.mostRecentMemoriesKey];
  }

  /**
   * Method that adds a memory to the agent's memory.
   * @param memoryContent The content of the memory to add.
   * @param now The current date.
   * @param metadata The metadata for the memory.
   * @param callbacks The Callbacks to use for adding the memory.
   * @returns The result of the memory addition.
   */
  async addMemory(
    memoryContent: string,
    now?: Date,
    metadata?: Record<string, unknown>,
    callbacks?: Callbacks
  ) {
    return this.memoryChain.call(
      { memory_content: memoryContent, now, memory_metadata: metadata },
      callbacks
    );
  }

  /**
   * Method that formats the given relevant memories in detail.
   * @param relevantMemories The relevant memories to format.
   * @returns The formatted memories as a string.
   */
  formatMemoriesDetail(relevantMemories: Document[]): string {
    if (!relevantMemories.length) {
      return "No relevant information.";
    }
    const contentStrings = new Set();
    const content = [];
    for (const memory of relevantMemories) {
      if (memory.pageContent in contentStrings) {
        continue;
      }
      contentStrings.add(memory.pageContent);
      const createdTime = memory.metadata.created_at.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      content.push(`${createdTime}: ${memory.pageContent.trim()}`);
    }
    const joinedContent = content.map((mem) => `${mem}`).join("\n");
    return joinedContent;
  }

  /**
   * Method that formats the given relevant memories in a simple manner.
   * @param relevantMemories The relevant memories to format.
   * @returns The formatted memories as a string.
   */
  formatMemoriesSimple(relevantMemories: Document[]): string {
    const joinedContent = relevantMemories
      .map((mem) => `${mem.pageContent}`)
      .join("; ");
    return joinedContent;
  }

  /**
   * Method that retrieves memories until a token limit is reached.
   * @param consumedTokens The number of tokens consumed so far.
   * @returns The memories as a string.
   */
  async getMemoriesUntilLimit(consumedTokens: number): Promise<string> {
    // reduce the number of tokens in the documents
    const result = [];
    for (const doc of this.memoryRetriever
      .getMemoryStream()
      .slice()
      .reverse()) {
      if (consumedTokens >= this.maxTokensLimit) {
        if (this.verbose) {
          console.log("Exceeding max tokens for LLM, filtering memories");
        }
        break;
      }
      // eslint-disable-next-line no-param-reassign
      consumedTokens += await this.llm.getNumTokens(doc.pageContent);
      if (consumedTokens < this.maxTokensLimit) {
        result.push(doc);
      }
    }
    return this.formatMemoriesSimple(result);
  }

  get memoryVariables(): string[] {
    // input keys this memory class will load dynamically
    return [];
  }

  /**
   * Method that loads memory variables based on the given inputs.
   * @param inputs The inputs to use for loading memory variables.
   * @returns An object containing the loaded memory variables.
   */
  async loadMemoryVariables(
    inputs: InputValues
  ): Promise<Record<string, string>> {
    const queries = inputs[this.queriesKey];
    const now = inputs[this.nowKey];
    if (queries !== undefined) {
      const relevantMemories = (
        await Promise.all(
          queries.map((query: string) =>
            this.memoryChain.fetchMemories(query, now)
          )
        )
      ).flat();
      return {
        [this.relevantMemoriesKey]: this.formatMemoriesDetail(relevantMemories),
        [this.relevantMemoriesSimpleKey]:
          this.formatMemoriesSimple(relevantMemories),
      };
    }
    const mostRecentMemoriesToken = inputs[this.mostRecentMemoriesTokenKey];
    if (mostRecentMemoriesToken !== undefined) {
      return {
        [this.mostRecentMemoriesKey]: await this.getMemoriesUntilLimit(
          mostRecentMemoriesToken
        ),
      };
    }
    return {};
  }

  /**
   * Method that saves the context of a model run to memory.
   * @param _inputs The inputs of the model run.
   * @param outputs The outputs of the model run.
   * @returns Nothing.
   */
  async saveContext(
    _inputs: InputValues,
    outputs: OutputValues
  ): Promise<void> {
    // save the context of this model run to memory
    const mem = outputs[this.addMemoryKey];
    const now = outputs[this.nowKey];
    if (mem) {
      await this.addMemory(mem, now, {});
    }
  }

  /**
   * Method that clears the memory contents.
   * @returns Nothing.
   */
  clear(): void {
    // TODO: clear memory contents
  }
}
