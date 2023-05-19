import { BaseOutputParser } from "../../schema/output_parser.js";
import { Plan } from "./base.js";

import { PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE } from "./prompt.js";

export class PlanOutputParser extends BaseOutputParser<Plan> {
  constructor() {
    super();
  }

  async parse(text: string): Promise<Plan> {
    return {
      steps: text
        .split(/\n\d+\.\s?/)
        .slice(1)
        .map((step) => ({ text: step.replace(`<END_OF_PLAN>`, "") })),
    };
  }

  getFormatInstructions(): string {
    return PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE;
  }
}
