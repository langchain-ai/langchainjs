import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { ObjectTool, FINISH_NAME } from "./schema.js";

export class PromptGenerator {
  constraints: string[];

  commands: ObjectTool[];

  resources: string[];

  performance_evaluation: string[];

  response_format: object;

  constructor() {
    this.constraints = [];
    this.commands = [];
    this.resources = [];
    this.performance_evaluation = [];
    this.response_format = {
      thoughts: {
        text: "thought",
        reasoning: "reasoning",
        plan: "- short bulleted\n- list that conveys\n- long-term plan",
        criticism: "constructive self-criticism",
        speak: "thoughts summary to say to user",
      },
      command: { name: "command name", args: { "arg name": "value" } },
    };
  }

  add_constraint(constraint: string): void {
    this.constraints.push(constraint);
  }

  add_tool(tool: ObjectTool): void {
    this.commands.push(tool);
  }

  _generate_command_string(tool: ObjectTool): string {
    let output = `"${tool.name}": ${tool.description}`;
    output += `, args json schema: ${JSON.stringify(
      (zodToJsonSchema(tool.schema) as JsonSchema7ObjectType).properties
    )}`;
    return output;
  }

  add_resource(resource: string): void {
    this.resources.push(resource);
  }

  add_performance_evaluation(evaluation: string): void {
    this.performance_evaluation.push(evaluation);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _generate_numbered_list(items: any[], item_type = "list"): string {
    if (item_type === "command") {
      const command_strings = items.map(
        (item, i) => `${i + 1}. ${this._generate_command_string(item)}`
      );
      const finish_description =
        "use this to signal that you have finished all your objectives";
      const finish_args =
        '"response": "final response to let people know you have finished your objectives"';
      const finish_string = `${
        items.length + 1
      }. ${FINISH_NAME}: ${finish_description}, args: ${finish_args}`;
      return command_strings.concat([finish_string]).join("\n");
    }

    return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }

  generate_prompt_string(): string {
    const formatted_response_format = JSON.stringify(
      this.response_format,
      null,
      4
    );
    const prompt_string =
      `Constraints:\n${this._generate_numbered_list(this.constraints)}\n\n` +
      `Commands:\n${this._generate_numbered_list(
        this.commands,
        "command"
      )}\n\n` +
      `Resources:\n${this._generate_numbered_list(this.resources)}\n\n` +
      `Performance Evaluation:\n${this._generate_numbered_list(
        this.performance_evaluation
      )}\n\n` +
      `You should only respond in JSON format as described below ` +
      `\nResponse Format: \n${formatted_response_format} ` +
      `\nEnsure the response can be parsed by Python json.loads`;

    return prompt_string;
  }
}

export function getPrompt(tools: ObjectTool[]): string {
  const prompt_generator = new PromptGenerator();

  prompt_generator.add_constraint(
    "~4000 word limit for short term memory. " +
      "Your short term memory is short, " +
      "so immediately save important information to files."
  );
  prompt_generator.add_constraint(
    "If you are unsure how you previously did something " +
      "or want to recall past events, " +
      "thinking about similar events will help you remember."
  );
  prompt_generator.add_constraint("No user assistance");
  prompt_generator.add_constraint(
    'Exclusively use the commands listed in double quotes e.g. "command name"'
  );

  for (const tool of tools) {
    prompt_generator.add_tool(tool);
  }

  prompt_generator.add_resource(
    "Internet access for searches and information gathering."
  );
  prompt_generator.add_resource("Long Term memory management.");
  prompt_generator.add_resource(
    "GPT-3.5 powered Agents for delegation of simple tasks."
  );
  prompt_generator.add_resource("File output.");

  prompt_generator.add_performance_evaluation(
    "Continuously review and analyze your actions " +
      "to ensure you are performing to the best of your abilities."
  );
  prompt_generator.add_performance_evaluation(
    "Constructively self-criticize your big-picture behavior constantly."
  );
  prompt_generator.add_performance_evaluation(
    "Reflect on past decisions and strategies to refine your approach."
  );
  prompt_generator.add_performance_evaluation(
    "Every command has a cost, so be smart and efficient. " +
      "Aim to complete tasks in the least number of steps."
  );

  const prompt_string = prompt_generator.generate_prompt_string();

  return prompt_string;
}
