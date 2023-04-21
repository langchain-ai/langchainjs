import { z } from "zod";
import { OutputParserArgs } from "../../agents/agent.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BaseOutputParser } from "../../schema/index.js";
import {
  OutputFixingParser,
  StructuredOutputParser,
} from "../../output_parsers/index.js";
import { AgentActionOutputParser } from "../types.js";

export const FINAL_ANSWER_ACTION = "finished";
export class ChatConversationalAgentOutputParser extends AgentActionOutputParser {
  finishToolName: string;

  outputParser: BaseOutputParser;

  constructor(fields?: OutputParserArgs) {
    super();

    this.finishToolName = fields?.finishToolName || FINAL_ANSWER_ACTION;

    this.outputParser = OutputFixingParser.fromLLM(
      fields?.llm || new ChatOpenAI({ temperature: 0 }),
      StructuredOutputParser.fromZodSchema(
        z
          .object({
            thought: z
              .string()
              .describe(
                `You must think concisely whether the next tool should be ${this.finishToolName} and why`
              ),
            tool: z
              .string()
              .describe(
                `you MUST provide the name of a tool to use (${
                  fields?.toolStrings || ""
                })`
              ),
            input: z.string().describe("the valid input to the tool"),
          })
          .describe("This is not an array so I will only return one object")
      )
    );
  }

  async parse(text: string) {
    const action = (await this.outputParser.parse(text)) as {
      tool: string;
      input: string;
    };
    if (action.tool === this.finishToolName) {
      return {
        returnValues: { output: action.input },
        log: text,
      };
    }

    return {
      tool: action.tool,
      toolInput: action.input,
      log: text,
    };
  }

  getFormatInstructions(): string {
    return this.outputParser.getFormatInstructions();
  }
}
