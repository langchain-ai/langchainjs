import { renderTemplate } from "../../prompts/template.js";
import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

const FINAL_ANSWER_ACTION = "Final Answer:";
const FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE =
  "Parsing LLM output produced both a final answer and a parse-able action:";

/**
 * Parses ReAct-style LLM calls that have a single tool input.
 *
 * Expects output to be in one of two formats.
 *
 * If the output signals that an action should be taken,
 * should be in the below format. This will result in an AgentAction
 * being returned.
 *
 * ```
 * Thought: agent thought here
 * Action: search
 * Action Input: what is the temperature in SF?
 * ```
 *
 * If the output signals that a final answer should be given,
 * should be in the below format. This will result in an AgentFinish
 * being returned.
 *
 * ```
 * Thought: agent thought here
 * Final Answer: The temperature is 100 degrees
 * ```
 * @example
 * ```typescript
 *
 * const runnableAgent = RunnableSequence.from([
 *   ...rest of runnable
 *   new ReActSingleInputOutputParser({ toolNames: ["SerpAPI", "Calculator"] }),
 * ]);
 * const agent = AgentExecutor.fromAgentAndTools({
 *   agent: runnableAgent,
 *   tools: [new SerpAPI(), new Calculator()],
 * });
 * const result = await agent.invoke({
 *   input: "whats the weather in pomfret?",
 * });
 *
 * ```
 */
export class ReActSingleInputOutputParser extends AgentActionOutputParser {
  lc_namespace = ["langchain", "agents", "react"];

  private toolNames: string[];

  constructor(fields: { toolNames: string[] }) {
    super(...arguments);
    this.toolNames = fields.toolNames;
  }

  /**
   * Parses the given text into an AgentAction or AgentFinish object. If an
   * output fixing parser is defined, uses it to parse the text.
   * @param text Text to parse.
   * @returns Promise that resolves to an AgentAction or AgentFinish object.
   */
  async parse(text: string): Promise<AgentAction | AgentFinish> {
    const includesAnswer = text.includes(FINAL_ANSWER_ACTION);
    const regex =
      /Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/;
    const actionMatch = text.match(regex);
    if (actionMatch) {
      if (includesAnswer) {
        throw new Error(
          `${FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE}: ${text}`
        );
      }

      const action = actionMatch[1];
      const actionInput = actionMatch[2];
      const toolInput = actionInput.trim().replace(/"/g, "");

      return {
        tool: action,
        toolInput,
        log: text,
      };
    }

    if (includesAnswer) {
      const finalAnswerText = text.split(FINAL_ANSWER_ACTION)[1].trim();
      return {
        returnValues: {
          output: finalAnswerText,
        },
        log: text,
      };
    }

    throw new Error(`Could not parse LLM output: ${text}`);
  }

  /**
   * Returns the format instructions as a string. If the 'raw' option is
   * true, returns the raw FORMAT_INSTRUCTIONS.
   * @param options Options for getting the format instructions.
   * @returns Format instructions as a string.
   */
  getFormatInstructions(): string {
    return renderTemplate(FORMAT_INSTRUCTIONS, "f-string", {
      tool_names: this.toolNames.join(", "),
    });
  }
}
