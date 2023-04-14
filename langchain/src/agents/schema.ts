import { ChatPromptTemplate } from "../prompts/chat.js";
import { AgentAction, InputValues } from "../schema/index.js";

type IntermediateStep = [AgentAction, string];

export class AgentScratchPadChatPromptTemplate extends ChatPromptTemplate {
  private _constructAgentScratchpad(
    intermediateSteps: IntermediateStep[]
  ): string {
    if (intermediateSteps.length === 0) {
      return "";
    }

    const thoughts = intermediateSteps.reduce(
      (acc, [action, observation]) =>
        `${acc}${action.log}\nObservation: ${observation}\nThought: `,
      ""
    );

    return (
      `This was your previous work ` +
      `(but I haven't seen any of it! I only see what ` +
      `you return as final answer):\n${thoughts}`
    );
  }

  async mergePartialAndUserVariables(
    userVariables: InputValues
  ): Promise<InputValues> {
    const { intermediate_steps, ...otherVariables } = userVariables;

    const agent_scratchpad = this._constructAgentScratchpad(
      intermediate_steps as IntermediateStep[]
    );

    return { agent_scratchpad, ...otherVariables };
  }
}
