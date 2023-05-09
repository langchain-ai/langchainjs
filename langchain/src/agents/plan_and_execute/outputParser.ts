import { BaseOutputParser } from "../../schema/output_parser.js";
import { Plan } from "./base.js";

import { FORMAT_INSTRUCTIONS } from "./prompt.js";

// export const FINAL_ANSWER_ACTION = "Final Answer:";
export class PlanOutputParser extends BaseOutputParser<Plan> {
  constructor() {
    super();
  }

  async parse(text: string): Promise<Plan> {
    return {
      steps: text.split(/\n\d+\.\s?/).slice(1).map((step) => ({text: step}))
    };
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }
}
