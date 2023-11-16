import { BaseOutputParser } from "../../schema/output_parser.js";
import { Plan } from "./base.js";

import { PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE } from "./prompt.js";

/**
 * Specific implementation of the `BaseOutputParser` class designed to
 * parse the output text into a `Plan` object.
 */
export class PlanOutputParser extends BaseOutputParser<Plan> {
  lc_namespace = ["langchain", "experimental", "plan_and_execute"];

  /**
   * Parses the output text into a `Plan` object. The steps are extracted by
   * splitting the text on newline followed by a number and a period,
   * indicating the start of a new step. The `<END_OF_PLAN>` tag is then
   * removed from each step.
   * @param text The output text to be parsed.
   * @returns A `Plan` object consisting of a series of steps.
   */
  async parse(text: string): Promise<Plan> {
    return {
      steps: text
        .split(/\n\d+\.\s?/)
        .slice(1)
        .map((step) => ({ text: step.replace(`<END_OF_PLAN>`, "") })),
    };
  }

  /**
   * Returns a string that represents the format instructions for the plan.
   * This is defined by the `PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE`
   * constant.
   * @returns A string representing the format instructions for the plan.
   */
  getFormatInstructions(): string {
    return PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE;
  }
}
