import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { BaseLLM } from "../../llms/base.js";
import { GenerativeAgentMemory } from "./generative_agent_memory.js";
import { ChainValues } from "../../schema/index.js";

export type GenerativeAgentConfig = {
  name: string;
  age?: number;
  traits: string;
  status: string;
  verbose?: boolean;
  summaryRefreshSeconds?: number;
  // dailySummaries?: string[];
};

export class GenerativeAgent {
  // a character with memory and innate characterisitics
  name: string; // the character's name

  age?: number; // the optional age of the character

  traits: string; // permanent traits to ascribe to the character

  status: string; // the traits of the character you wish not to change

  memory: GenerativeAgentMemory;

  llm: BaseLLM; // the underlying language model

  verbose: boolean; // false

  private summary: string; // stateful self-summary generated via reflection on the character's memory.

  private summaryRefreshSeconds = 3600;

  private lastRefreshed: Date; // the last time the character's summary was regenerated

  // TODO: Add support for daily summaries
  // private dailySummaries: string[] = []; // summary of the events in the plan that the agent took.

  constructor(
    llm: BaseLLM,
    memory: GenerativeAgentMemory,
    config: GenerativeAgentConfig
  ) {
    this.llm = llm;
    this.memory = memory;
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
  parseList(text: string): string[] {
    // parse a newline-seperated string into a list of strings
    const lines: string[] = text.trim().split("\n");
    const result: string[] = lines.map((line: string) =>
      line.replace(/^\s*\d+\.\s*/, "").trim()
    );
    return result;
  }

  chain(prompt: PromptTemplate): LLMChain {
    const chain = new LLMChain({
      llm: this.llm,
      prompt,
      verbose: this.verbose,
      outputKey: "output", // new
      memory: this.memory,
    });
    return chain;
  }

  async getEntityFromObservations(observation: string): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "What is the observed entity in the following observation? {observation}" +
        "\nEntity="
    );

    const result = await this.chain(prompt).call({
      observation,
    });

    return result.output;
  }

  async getEntityAction(
    observation: string,
    entityName: string
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "What is the {entity} doing in the following observation? {observation}" +
        "\nThe {entity} is"
    );

    const result = await this.chain(prompt).call({
      entity: entityName,
      observation,
    });
    const trimmedResult = result.output.trim();
    return trimmedResult;
  }

  async summarizeRelatedMemories(observation: string): Promise<string> {
    // summarize memories that are most relevant to an observation
    const prompt = PromptTemplate.fromTemplate(
      `
{q1}?
Context from memory:
{relevant_memories}
Relevant context:`
    );
    const entityName = await this.getEntityFromObservations(observation);
    const entityAction = await this.getEntityAction(observation, entityName);
    const q1 = `What is the relationship between ${this.name} and ${entityName}`;
    const q2 = `${entityName} is ${entityAction}`;
    const response = await this.chain(prompt).call({
      q1,
      queries: [q1, q2],
    });

    return response.output.trim(); // added output
  }

  private async _generateReaction(
    observation: string,
    suffix: string,
    now?: Date
  ): Promise<string> {
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

    const agentSummaryDescription = await this.getSummary(); // now = now in param
    const relevantMemoriesStr = await this.summarizeRelatedMemories(
      observation
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

    chainInputs[this.memory.getRelevantMemoriesKey()] = relevantMemoriesStr;

    const consumedTokens = await this.llm.getNumTokens(
      await prompt.format({ ...chainInputs })
    );

    chainInputs[this.memory.getMostRecentMemoriesTokenKey()] = consumedTokens;
    const response = await this.chain(prompt).call(chainInputs);
    return response.output.trim();
  }

  private _cleanResponse(text: string | undefined): string {
    if (text === undefined) {
      return "";
    }
    const regex = new RegExp(`^${this.name} `);
    return text.replace(regex, "").trim();
  }

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

    const fullResult = await this._generateReaction(
      observation,
      callToActionTemplate,
      now
    );
    const result = fullResult.trim().split("\n")[0];
    await this.memory.saveContext(
      {},
      {
        [this.memory.getAddMemoryKey()]: `${this.name} observed ${observation} and reacted by ${result}`,
        [this.memory.getCurrentTimeKey()]: now,
      }
    );

    if (result.includes("REACT:")) {
      const reaction = this._cleanResponse(result.split("SAY:").pop());
      return [false, `${this.name} ${reaction}`];
    }
    if (result.includes("SAY:")) {
      const saidValue = this._cleanResponse(result.split("SAY:").pop());
      return [true, `${this.name} said ${saidValue}`];
    }

    return [false, result];
  }

  async generateDialogueResponse(
    observation: string,
    now?: Date
  ): Promise<[boolean, string]> {
    const callToActionTemplate = `What would ${this.name} say? To end the conversation, write: GOODBYE: "what to say". Otherwise to continue the conversation, write: SAY: "what to say next"\n\n`;
    const fullResult = await this._generateReaction(
      observation,
      callToActionTemplate,
      now
    );
    const result = fullResult.trim().split("\n")[0] ?? "";

    if (result.includes("GOODBYE:")) {
      const farewell = this._cleanResponse(
        result.split("GOODBYE:").pop() ?? ""
      );
      await this.memory.saveContext(
        {},
        {
          [this.memory
            .addMemoryKey]: `${this.name} observed ${observation} and said ${farewell}`,
          [this.memory.getCurrentTimeKey()]: now,
        }
      );
      return [false, `${this.name} said ${farewell}`];
    }

    if (result.includes("SAY:")) {
      const responseText = this._cleanResponse(
        result.split("SAY:").pop() ?? ""
      );
      await this.memory.saveContext(
        {},
        {
          [this.memory
            .addMemoryKey]: `${this.name} observed ${observation} and said ${responseText}`,
          [this.memory.getCurrentTimeKey()]: now,
        }
      );
      return [true, `${this.name} said ${responseText}`];
    }

    return [false, result];
  }

  // Agent stateful' summary methods
  // Each dialog or response prompt includes a header
  // summarizing the agent's self-description. This is
  // updated periodically through probing it's memories
  async getSummary(
    config: {
      now?: Date;
      forceRefresh?: boolean;
    } = {}
  ): Promise<string> {
    const { now = new Date(), forceRefresh = false } = config;

    const sinceRefresh = Math.floor(
      (now.getTime() - this.lastRefreshed.getTime()) / 1000
    );

    if (
      !this.summary ||
      sinceRefresh >= this.summaryRefreshSeconds ||
      forceRefresh
    ) {
      this.summary = await this.computeAgentSummary();
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

  async computeAgentSummary(): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "How would you summarize {name}'s core characteristics given the following statements:\n" +
        "----------" +
        "{relevant_memories}" +
        "----------" +
        "Do not embellish." +
        "\n\nSummary: "
    );
    // the agent seeks to think about their core characterisitics
    const result = await this.chain(prompt).call({
      name: this.name,
      queries: [`${this.name}'s core characteristics`],
    });
    return result.output.trim();
  }

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
}
