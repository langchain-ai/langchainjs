import { test, expect } from "@jest/globals";
import { MultiPromptChain } from "../multi_prompt.js";
import { BaseLLM } from "../../../llms/base.js";
import { LLMResult } from "../../../schema/index.js";

let pickedPrompt: string;

class FakeLLM extends BaseLLM {
  _llmType(): string {
    return "fake";
  }

  async _generate(
    prompts: string[],
    _: this["ParsedCallOptions"]
  ): Promise<LLMResult> {
    function buildResponse(name: string) {
      return `\`\`\`\n{\n\t"destination": "${name}",\n\t"next_inputs": {\n\t\t"input": "<from ${name}>"\n\t}\n}\n\`\`\``;
    }
    const flatPrompt = prompts.join("\n");

    let response: string;
    if (flatPrompt.includes("prompt template")) {
      const splitted = flatPrompt.split(" ");
      response = `${splitted[splitted.length - 2]} ${
        splitted[splitted.length - 1]
      }`;
    } else {
      // randomly choose 1 out of three responses
      const random = Math.random();
      if (random < 0.33) {
        pickedPrompt = "prompt1";
      } else if (random < 0.66) {
        pickedPrompt = "prompt2";
      } else {
        pickedPrompt = "prompt3";
      }
      response = buildResponse(pickedPrompt);
    }

    return {
      generations: [
        [
          {
            text: response,
          },
        ],
      ],
    };
  }
}

test("Test MultiPromptChain", async () => {
  const llm = new FakeLLM({});
  const promptNames = ["prompt1", "prompt2", "prompt3"];
  const promptDescriptions = ["description1", "description2", "description3"];
  const promptTemplates = [
    "prompt template1 {input}",
    "prompt template2 {input}",
    "prompt template3 {input}",
  ];

  const multiPromptChain = MultiPromptChain.fromPrompts(
    llm,
    promptNames,
    promptDescriptions,
    promptTemplates
  );

  const { text: result } = await multiPromptChain.call({ input: "Test input" });

  expect(result).toEqual(`<from ${pickedPrompt}>`);
});
