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
  // Get all input variables, if there is more than one, throw an error.
  const matches = [...templateToolResponse.matchAll(/{([^}]*)}/g)];
  const stringsInsideBrackets = matches.map((match) => match[1]);
  if (stringsInsideBrackets.length > 1) {
    throw new Error(
      `templateToolResponse must contain one input variable: ${templateToolResponse}`
    );
  }

  const thoughts: BaseMessage[] = [];

  for (const step of intermediateSteps) {
    thoughts.push(new AIMessage(step.action.log));
    thoughts.push(
      new HumanMessage(
        renderTemplate(templateToolResponse, "f-string", {
          [stringsInsideBrackets[0]]: step.observation,
        })
      )
    );
  }
  return thoughts;
}
