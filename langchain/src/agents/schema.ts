import {
  ChatPromptTemplate,
  ChatPromptTemplateInput,
} from "../prompts/chat.js";
import { AgentStep, InputValues } from "../schema/index.js";

export class AgentScratchPadChatPromptTemplate extends ChatPromptTemplate {
  constructor(input: Exclude<ChatPromptTemplateInput, "validateTemplate">) {
    super({ ...input, validateTemplate: false });
  }

  private _constructAgentScratchpad(intermediateSteps: AgentStep[]): string {
    if (intermediateSteps.length === 0) {
      return "";
    }

    const thoughts = intermediateSteps.reduce(
      (acc, { action, observation }) =>
        `${acc}${action.log}\nObservation: ${observation}\nThought: `,
      ""
    );

    return `This was your previous work (but I haven't seen any of it! I only see what you return as final answer):\n${thoughts}`;
  }

  async mergePartialAndUserVariables(
    userVariables: InputValues
  ): Promise<InputValues> {
    const { intermediate_steps, ...otherVariables } =
      await super.mergePartialAndUserVariables(userVariables);

    const agent_scratchpad = this._constructAgentScratchpad(
      intermediate_steps as AgentStep[]
    );

    const newVariables = { agent_scratchpad, ...otherVariables };

    return newVariables;
  }
}
