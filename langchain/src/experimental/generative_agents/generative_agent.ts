import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { GenerativeAgentMemory } from "./generative_agent_memory.js";
import { ChainValues } from "../../schema/index.js";
import { BaseChain } from "../../chains/base.js";
import {
  CallbackManagerForChainRun,
  Callbacks,
} from "../../callbacks/manager.js";

/**
 * Configuration for the GenerativeAgent class. Defines the character's
 * name, optional age, permanent traits, status, verbosity, and summary
 * refresh seconds.
 */
export type GenerativeAgentConfig = {
  name: string;
  age?: number;
  traits: string;
  status: string;
  verbose?: boolean;
  summaryRefreshSeconds?: number;
  // dailySummaries?: string[];
};

/**
 * Implementation of a generative agent that can learn and form new memories over
 * time. It extends the BaseChain class, which is a generic
 * sequence of calls to components, including other chains.
 * @example
 * ```typescript
 * const tommie: GenerativeAgent = new GenerativeAgent(
 *   new OpenAI({ temperature: 0.9, maxTokens: 1500 }),
 *   new GenerativeAgentMemory(
 *     new ChatOpenAI(),
 *     new TimeWeightedVectorStoreRetriever({
 *       vectorStore: new MemoryVectorStore(new OpenAIEmbeddings()),
 *       otherScoreKeys: ["importance"],
 *       k: 15,
 *     }),
 *     { reflectionThreshold: 8 },
 *   ),
 *   {
 *     name: "Tommie",
 *     age: 25,
 *     traits: "anxious, likes design, talkative",
 *     status: "looking for a job",
 *   },
 * );
 *
 * await tommie.addMemory(
 *   "Tommie remembers his dog, Bruno, from when he was a kid",
 *   new Date(),
 * );
 * const summary = await tommie.getSummary({ forceRefresh: true });
 * const response = await tommie.generateDialogueResponse(
 *   "USER says Hello Tommie, how are you today?",
 * );
 * ```
 */
export class GenerativeAgent extends BaseChain {
  static lc_name() {
    return "GenerativeAgent";
  }

  // a character with memory and innate characterisitics
  name: string; // the character's name

  age?: number; // the optional age of the character

  traits: string; // permanent traits to ascribe to the character

  status: string; // the traits of the character you wish not to change

  longTermMemory: GenerativeAgentMemory;

  llm: BaseLanguageModel; // the underlying language model

  verbose: boolean; // false

  private summary: string; // stateful self-summary generated via reflection on the character's memory.

  private summaryRefreshSeconds = 3600;

  private lastRefreshed: Date; // the last time the character's summary was regenerated

  // TODO: Add support for daily summaries
  // private dailySummaries: string[] = []; // summary of the events in the plan that the agent took.

  _chainType(): string {
    return "generative_agent_executor";
  }

  get inputKeys(): string[] {
    return ["observation", "suffix", "now"];
  }

  get outputKeys(): string[] {
    return ["output", "continue_dialogue"];
  }

  constructor(
    llm: BaseLanguageModel,
    longTermMemory: GenerativeAgentMemory,
    config: GenerativeAgentConfig
  ) {
    super();
    this.llm = llm;
    this.longTermMemory = longTermMemory;
    this.name = config.name;
    this.age = config.age;
    this.traits = config.traits;
    this.status = config.status;
    this.verbose = config.verbose ?? this.verbose;
    this.summary = "";
    this.summaryRefreshSeconds =
      config.summaryRefreshSeconds ?? this.summaryRefreshSeconds;
    this.lastRefreshed = new Date();
    // this.dailySummaries = config.dailySummaries ?? this.dailySummaries;
  }

  // LLM methods
  /**
   * Parses a newline-separated string into a list of strings.
   * @param text The string to parse.
   * @returns An array of strings parsed from the input text.
   */
  parseList(text: string): string[] {
    // parse a newline-seperated string into a list of strings
    const lines: string[] = text.trim().split("\n");
    const result: string[] = lines.map((line: string) =>
      line.replace(/^\s*\d+\.\s*/, "").trim()
    );
    return result;
  }

  /**
   * Creates a new LLMChain with the given prompt and the agent's language
   * model, verbosity, output key, and memory.
   * @param prompt The prompt to use for the LLMChain.
   * @returns A new LLMChain instance.
   */
  chain(prompt: PromptTemplate): LLMChain {
    const chain = new LLMChain({
      llm: this.llm,
      prompt,
      verbose: this.verbose,
      outputKey: "output", // new
      memory: this.longTermMemory,
    });
    return chain;
  }

  /**
   * Extracts the observed entity from the given observation.
   * @param observation The observation to extract the entity from.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns The extracted entity as a string.
   */
  async getEntityFromObservations(
    observation: string,
    runManager?: CallbackManagerForChainRun
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "What is the observed entity in the following observation? {observation}" +
        "\nEntity="
    );

    const result = await this.chain(prompt).call(
      {
        observation,
      },
      runManager?.getChild("entity_extractor")
    );

    return result.output;
  }

  /**
   * Extracts the action of the given entity from the given observation.
   * @param observation The observation to extract the action from.
   * @param entityName The name of the entity to extract the action for.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns The extracted action as a string.
   */
  async getEntityAction(
    observation: string,
    entityName: string,
    runManager?: CallbackManagerForChainRun
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "What is the {entity} doing in the following observation? {observation}" +
        "\nThe {entity} is"
    );

    const result = await this.chain(prompt).call(
      {
        entity: entityName,
        observation,
      },
      runManager?.getChild("entity_action_extractor")
    );
    const trimmedResult = result.output.trim();
    return trimmedResult;
  }

  /**
   * Summarizes memories that are most relevant to an observation.
   * @param observation The observation to summarize related memories for.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns The summarized memories as a string.
   */
  async summarizeRelatedMemories(
    observation: string,
    runManager?: CallbackManagerForChainRun
  ): Promise<string> {
    // summarize memories that are most relevant to an observation
    const prompt = PromptTemplate.fromTemplate(
      `
{q1}?
Context from memory:
{relevant_memories}
Relevant context:`
    );
    const entityName = await this.getEntityFromObservations(
      observation,
      runManager
    );
    const entityAction = await this.getEntityAction(
      observation,
      entityName,
      runManager
    );
    const q1 = `What is the relationship between ${this.name} and ${entityName}`;
    const q2 = `${entityName} is ${entityAction}`;
    const response = await this.chain(prompt).call(
      {
        q1,
        queries: [q1, q2],
      },
      runManager?.getChild("entity_relationships")
    );

    return response.output.trim(); // added output
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const { observation, suffix, now } = values;
    // react to a given observation or dialogue act
    const prompt = PromptTemplate.fromTemplate(
      `{agent_summary_description}` +
        `\nIt is {current_time}.` +
        `\n{agent_name}'s status: {agent_status}` +
        `\nSummary of relevant context from {agent_name}'s memory:` +
        "\n{relevant_memories}" +
        `\nMost recent observations: {most_recent_memories}` +
        `\nObservation: {observation}` +
        `\n\n${suffix}`
    );

    const agentSummaryDescription = await this.getSummary({}, runManager); // now = now in param
    const relevantMemoriesStr = await this.summarizeRelatedMemories(
      observation,
      runManager
    );
    const currentTime = (now || new Date()).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    const chainInputs: ChainValues = {
      agent_summary_description: agentSummaryDescription,
      current_time: currentTime,
      agent_name: this.name,
      observation,
      agent_status: this.status,
      most_recent_memories: "",
    };

    chainInputs[this.longTermMemory.getRelevantMemoriesKey()] =
      relevantMemoriesStr;

    const consumedTokens = await this.llm.getNumTokens(
      await prompt.format({ ...chainInputs })
    );

    chainInputs[this.longTermMemory.getMostRecentMemoriesTokenKey()] =
      consumedTokens;
    const response = await this.chain(prompt).call(
      chainInputs,
      runManager?.getChild("reaction_from_summary")
    );

    const rawOutput = response.output;
    let output = rawOutput;
    let continue_dialogue = false;

    if (rawOutput.includes("REACT:")) {
      const reaction = this._cleanResponse(rawOutput.split("REACT:").pop());
      await this.addMemory(
        `${this.name} observed ${observation} and reacted by ${reaction}`,
        now,
        {},
        runManager?.getChild("memory")
      );
      output = `${reaction}`;
      continue_dialogue = false;
    } else if (rawOutput.includes("SAY:")) {
      const saidValue = this._cleanResponse(rawOutput.split("SAY:").pop());
      await this.addMemory(
        `${this.name} observed ${observation} and said ${saidValue}`,
        now,
        {},
        runManager?.getChild("memory")
      );
      output = `${this.name} said ${saidValue}`;
      continue_dialogue = true;
    } else if (rawOutput.includes("GOODBYE:")) {
      const farewell = this._cleanResponse(
        rawOutput.split("GOODBYE:").pop() ?? ""
      );
      await this.addMemory(
        `${this.name} observed ${observation} and said ${farewell}`,
        now,
        {},
        runManager?.getChild("memory")
      );
      output = `${this.name} said ${farewell}`;
      continue_dialogue = false;
    }

    return { output, continue_dialogue };
  }

  private _cleanResponse(text: string | undefined): string {
    if (text === undefined) {
      return "";
    }
    const regex = new RegExp(`^${this.name} `);
    return text.replace(regex, "").trim();
  }

  /**
   * Generates a reaction to the given observation.
   * @param observation The observation to generate a reaction for.
   * @param now Optional current date.
   * @returns A boolean indicating whether to continue the dialogue and the output string.
   */
  async generateReaction(
    observation: string,
    now?: Date
  ): Promise<[boolean, string]> {
    const callToActionTemplate: string =
      `Should {agent_name} react to the observation, and if so,` +
      ` what would be an appropriate reaction? Respond in one line.` +
      ` If the action is to engage in dialogue, write:\nSAY: "what to say"` +
      ` \notherwise, write:\nREACT: {agent_name}'s reaction (if anything).` +
      ` \nEither do nothing, react, or say something but not both.\n\n`;

    const { output, continue_dialogue } = await this.call({
      observation,
      suffix: callToActionTemplate,
      now,
    });
    return [continue_dialogue, output];
  }

  /**
   * Generates a dialogue response to the given observation.
   * @param observation The observation to generate a dialogue response for.
   * @param now Optional current date.
   * @returns A boolean indicating whether to continue the dialogue and the output string.
   */
  async generateDialogueResponse(
    observation: string,
    now?: Date
  ): Promise<[boolean, string]> {
    const callToActionTemplate = `What would ${this.name} say? To end the conversation, write: GOODBYE: "what to say". Otherwise to continue the conversation, write: SAY: "what to say next"\n\n`;
    const { output, continue_dialogue } = await this.call({
      observation,
      suffix: callToActionTemplate,
      now,
    });
    return [continue_dialogue, output];
  }

  // Agent stateful' summary methods
  // Each dialog or response prompt includes a header
  // summarizing the agent's self-description. This is
  // updated periodically through probing it's memories
  /**
   * Gets the agent's summary, which includes the agent's name, age, traits,
   * and a summary of the agent's core characteristics. The summary is
   * updated periodically through probing the agent's memories.
   * @param config Optional configuration object with current date and a boolean to force refresh.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns The agent's summary as a string.
   */
  async getSummary(
    config?: {
      now?: Date;
      forceRefresh?: boolean;
    },
    runManager?: CallbackManagerForChainRun
  ): Promise<string> {
    const { now = new Date(), forceRefresh = false } = config ?? {};

    const sinceRefresh = Math.floor(
      (now.getTime() - this.lastRefreshed.getTime()) / 1000
    );

    if (
      !this.summary ||
      sinceRefresh >= this.summaryRefreshSeconds ||
      forceRefresh
    ) {
      this.summary = await this.computeAgentSummary(runManager);
      this.lastRefreshed = now;
    }

    let age;
    if (this.age) {
      age = this.age;
    } else {
      age = "N/A";
    }

    return `Name: ${this.name} (age: ${age})
Innate traits: ${this.traits}
${this.summary}`;
  }

  /**
   * Computes the agent's summary by summarizing the agent's core
   * characteristics given the agent's relevant memories.
   * @param runManager Optional CallbackManagerForChainRun instance.
   * @returns The computed summary as a string.
   */
  async computeAgentSummary(
    runManager?: CallbackManagerForChainRun
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "How would you summarize {name}'s core characteristics given the following statements:\n" +
        "----------" +
        "{relevant_memories}" +
        "----------" +
        "Do not embellish." +
        "\n\nSummary: "
    );
    // the agent seeks to think about their core characterisitics
    const result = await this.chain(prompt).call(
      {
        name: this.name,
        queries: [`${this.name}'s core characteristics`],
      },
      runManager?.getChild("compute_agent_summary")
    );
    return result.output.trim();
  }

  /**
   * Returns a full header of the agent's status, summary, and current time.
   * @param config Optional configuration object with current date and a boolean to force refresh.
   * @returns The full header as a string.
   */
  getFullHeader(
    config: {
      now?: Date;
      forceRefresh?: boolean;
    } = {}
  ): string {
    const { now = new Date(), forceRefresh = false } = config;
    // return a full header of the agent's status, summary, and current time.
    const summary = this.getSummary({ now, forceRefresh });
    const currentTimeString = now.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    return `${summary}\nIt is ${currentTimeString}.\n${this.name}'s status: ${this.status}`;
  }

  /**
   * Adds a memory to the agent's long-term memory.
   * @param memoryContent The content of the memory to add.
   * @param now Optional current date.
   * @param metadata Optional metadata for the memory.
   * @param callbacks Optional Callbacks instance.
   * @returns The result of adding the memory to the agent's long-term memory.
   */
  async addMemory(
    memoryContent: string,
    now?: Date,
    metadata?: Record<string, unknown>,
    callbacks?: Callbacks
  ) {
    return this.longTermMemory.addMemory(
      memoryContent,
      now,
      metadata,
      callbacks
    );
  }
}
