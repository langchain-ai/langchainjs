import { AgentActionOutputParser } from "../types.js";
import { AGENT_ACTION_FORMAT_INSTRUCTIONS, FORMAT_INSTRUCTIONS } from "./prompt.js";
import { OutputFixingParser } from "../../output_parsers/fix.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";
import { OutputParserException } from "../../schema/output_parser.js";

export class StructuredChatOutputParser extends AgentActionOutputParser {
  async parse(text: string): Promise<AgentAction | AgentFinish> {
    try {
      const regex = /```(?:json)?(.*)(```)/gs;
      const actionMatch = regex.exec(text);
      if (actionMatch === null) {
        throw new OutputParserException(`Could not parse an action. The agent action must be within a markdown code block, and "action" must be a provided tool or "Final Answer"`);
      }
      const response = JSON.parse(actionMatch[1].trim());
      const { action, action_input } = response;

      if (action === "Final Answer") {
        return { returnValues: { output: action_input }, log: text };
      }
      return { tool: action, toolInput: action_input || {}, log: text };
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`
      );
    }
  }

  getFormatInstructions(): string {
    return AGENT_ACTION_FORMAT_INSTRUCTIONS;
  }
}

export interface StructuredChatOutputParserArgs {
  baseParser?: StructuredChatOutputParser;
  outputFixingParser?: OutputFixingParser<AgentAction | AgentFinish>;
}

export class StructuredChatOutputParserWithRetries extends AgentActionOutputParser {
  baseParser: StructuredChatOutputParser;

  outputFixingParser?: OutputFixingParser<AgentAction | AgentFinish>;

  constructor(fields?: StructuredChatOutputParserArgs) {
    super();
    this.baseParser = fields?.baseParser ?? new StructuredChatOutputParser();
    this.outputFixingParser = fields?.outputFixingParser;
  }

  async parse(text: string): Promise<AgentAction | AgentFinish> {
    if (this.outputFixingParser !== undefined) {
      return this.outputFixingParser.parse(text);
    }
    return this.baseParser.parse(text);
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }

  static fromLLM(
    llm: BaseLanguageModel,
    baseParser: StructuredChatOutputParser = new StructuredChatOutputParser()
  ): StructuredChatOutputParserWithRetries {
    const outputFixingParser = OutputFixingParser.fromLLM(llm, baseParser);
    return new StructuredChatOutputParserWithRetries({
      baseParser,
      outputFixingParser,
    });
  }
}
