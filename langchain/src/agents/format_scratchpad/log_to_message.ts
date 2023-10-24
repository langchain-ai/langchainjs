import { renderTemplate } from "../../prompts/template.js";
import {
  AIMessage,
  AgentStep,
  BaseMessage,
  HumanMessage,
} from "../../schema/index.js";

export function formatLogToMessage(
  intermediateSteps: AgentStep[],
  templateToolResponse = "{observation}"
): BaseMessage[] {
  const thoughts: BaseMessage[] = [];
  const templateToolResponseWithoutBrackets = templateToolResponse.replace(
    /{|}/g,
    ""
  );
  for (const step of intermediateSteps) {
    thoughts.push(new AIMessage(step.action.log));
    thoughts.push(
      new HumanMessage(
        renderTemplate(templateToolResponse, "f-string", {
          [templateToolResponseWithoutBrackets]: step.observation,
        })
      )
    );
  }
  return thoughts;
}
