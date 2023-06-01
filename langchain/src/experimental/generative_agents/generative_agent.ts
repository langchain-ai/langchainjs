import { PromptTemplate , LLMChain } from "../../index.js";
import { BaseLLM } from "../../llms/base.js";
import { GenerativeAgentMemory } from "./generative_agent_memory.js";

// might need to use the class-validator library
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

  private summaryRefreshSeconds: number; // 3600

  private lastRefreshed: Date; // the last time the character's summary was regenerated

  private dailySummaries: string[]; // summary of the events in the plan that the agent took.

  // class Config went here in python docs

  constructor(
    name: string,
    age: number,
    traits: string,
    status: string,
    memory: GenerativeAgentMemory,
    llm: BaseLLM,
    dailySummaries: string[] = [],
    verbose = false,
    summaryRefreshSeconds = 3600
  ) {
    this.name = name;
    this.age = age;
    this.traits = traits;
    this.status = status;
    this.memory = memory;
    this.llm = llm;
    this.verbose = verbose;
    this.summary = "";
    this.summaryRefreshSeconds = summaryRefreshSeconds;
    this.lastRefreshed = new Date();
    this.dailySummaries = dailySummaries;
  }

  // getter
  get getMemory(): GenerativeAgentMemory {
    return this.memory;
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

  chain(this: GenerativeAgent, prompt: PromptTemplate): LLMChain {
    const chain = new LLMChain({
      llm: this.llm,
      prompt,
      verbose: this.verbose,
      outputKey: "output", // new
      // memory:this.memory,
    });
    return chain;
  }

  async getEntityFromObservations(
    this: GenerativeAgent,
    observation: string
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "What is the {entity} doing in the following observation? {observation}" +
        "\nThe {entity} is"
    );

    const result = await this.chain(prompt).call({
      // might need to change to call()
      observation,
      entity: "entity", // fix
    });

    return result.output;
  }

  async getEntityAction(
    this: GenerativeAgent,
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
    const trimmedResult = result.output.trim(); // added output
    return trimmedResult;
  }

  async summarizeRelatedMemories(
    this: GenerativeAgent,
    observation: string
  ): Promise<string> {
    // summarize memories that are most relevant to an observation
    const prompt = PromptTemplate.fromTemplate(
      `
            {q1}?
            Relevant context: 
            `
    );
    const entityName = await this.getEntityFromObservations(observation);
    const entiryAction = this.getEntityAction(observation, entityName);
    const q1 = `What is the relationship between ${this.name} and ${entityName}`;
    const q2 = `${entityName} is ${entiryAction}`;
    // const relevantMemoriesKey = this.memory.getRelevantMemoriesKey;
    const response = await this.chain(prompt).call({
      q1,
      queries: [q1, q2],
      // relevantMemories: this.memory[relevantMemoriesKey],
    });
    console.log(response);

    return response.output.trim(); // added output
  }

  private async _generateReaction(
    this: GenerativeAgent,
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
        // + "\n{relevantMemories}"
        `\nMost recent observations: {most_recent_memories}` +
        `\nObservation: {observation}` +
        `\n\n${ 
        suffix}`
    );

    const agentSummaryDescription = await this.getSummary(); // now = now in param
    const relevantMemoriesStr = await this.summarizeRelatedMemories(
      observation
    );
    const current_time_str = (now || new Date()).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });

    // log the value of relevantMemoriesStr
    console.log("the value of relevantMemoriesStr", relevantMemoriesStr);

    const kwargs: Record<string, any> = {
      agent_summary_description: agentSummaryDescription,
      current_time: current_time_str,
      relevantMemories: relevantMemoriesStr,
      agent_name: this.name,
      observation,
      agent_status: this.status,
      most_recent_memories: "",
    };

    const consumedTokens = await this.llm.getNumTokens(
      await prompt.format({ ...kwargs }) // add most recent memories here
    );

    kwargs[this.memory.mostRecentMemoriesToken] = consumedTokens;
    const response = await this.chain(prompt).call({ ...kwargs }); // might need to change to call()
    return response.output.trim();
  }

  private _cleanResponse(text: string | undefined): string {
    if (text === undefined) {
      return "";
      console.log("text param passed to _cleanResponse is undefined");
    }
    const regex = new RegExp(`^${this.name} `);
    return text.replace(regex, "").trim();
  }

  async generateReaction(
    this: GenerativeAgent,
    observation: string,
    now?: Date
  ): Promise<[boolean, string]> {
    // react to a given observation
    const callToActionTemplate: string =
      `Should {agent_name} react to the observation, and if so,` +
      ` what would be an appropriate reaction? Respond in one line.` +
      ` If the action is to engage in dialogue, write:\nSAY: "what to say"` +
      ` \notherwise, write:\nREACT: {agent_name}'s reaction (if anything).` +
      ` \nEither do nothing, react, or say something but not both.\n\n`;

    const fullResult = await this._generateReaction(
      observation,
      callToActionTemplate,
      (now)
    );
    const result = fullResult.trim().split("\n")[0];
    // AAA
    await this.memory.saveContext(
      {},
      {
        [this.memory
          .addMemoryKey]: `${this.name} observed ${observation} and reacted by ${result}`,
        [this.memory.NowKey]: now,
      }
    );

    if (result.includes("REACT:")) {
      console.log("result in generateReaction", result);
      const reaction = this._cleanResponse(result.split("SAY:").pop());
      return [false, `${this.name} ${reaction}`];
    }
    if (result.includes("SAY:")) {
      console.log("result in generateReaction", result);
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
          [this.memory.NowKey]: now,
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
          [this.memory.NowKey]: now,
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
    this: GenerativeAgent,
    now?: Date,
    forceRefresh = false,
  ): Promise<string> {
    // return a descriptive summary of the agent
    const currentTime = new Date();
    // const sinceRefresh = (currentTime.getTime() - this.lastRefreshed.getTime()) / 1000;
    const sinceRefresh = Math.floor(
      (currentTime.getTime() - this.lastRefreshed.getTime()) / 1000
    );

    if (
      !this.summary ||
      sinceRefresh >= this.summaryRefreshSeconds ||
      forceRefresh
    ) {
      this.summary = await this.computeAgentSummary(); // TODO: write this function
      this.lastRefreshed = currentTime;
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

  async computeAgentSummary(this: GenerativeAgent): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      "How would you summarize {name}'s core characteristics given the" +
        " following statements:\n" +
        "{relevantMemories}" +
        "Do not embellish." +
        "\n\nSummary: "
    );
    // the agent seeks to think about their core characterisitics
    const result = await this.chain(prompt).call({
      name: this.name,
      relevantMemories: this.memory.relevantMemoriesKey,
      queries: [`${this.name}'s core characteristics`],
    });
    return result.output.trim();
  }

  getFullHeader(
    this: GenerativeAgent,
    now?: Date,
    forceRefresh = false,
  ): string {
    // return a full header of the agent's status, summary, and current time.
    const currentTime = now || new Date();
    const summary = this.getSummary(currentTime, true);
    const currentTimeString = currentTime.toLocaleString("en-US", {
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
