import { v4 as uuidv4, validate } from "uuid";
import { Run } from "langsmith/schemas";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { BaseLLM } from "../../language_models/llms.js";
import { StringOutputParser } from "../../output_parsers/string.js";
import type { LLMResult } from "../../outputs.js";
import { RunCollectorCallbackHandler } from "../../tracers/run_collector.js";

class FakeLLM extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_1";
  }

  async _generate(_prompts: string[]): Promise<LLMResult> {
    return {
      generations: [
        [
          {
            text: "Foo.",
          },
        ],
      ],
    };
  }
}

describe("RunCollectorCallbackHandler", () => {
  it("should persist the given run object and set the reference_example_id to the exampleId", async () => {
    // Create a chain that uses the dataset
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate("You are in a rap battle."),
      HumanMessagePromptTemplate.fromTemplate("Write the following {input}"),
    ]);
    const model = new FakeLLM({});
    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const exampleId = uuidv4();
    const collector = new RunCollectorCallbackHandler({ exampleId });

    await chain.invoke({ input: "foo" }, { callbacks: [collector] });

    expect(collector.tracedRuns.length).toBe(1);
    const tracedRun = collector.tracedRuns[0];
    expect(tracedRun.id).toBeDefined();
    if (tracedRun.id && validate(tracedRun.id)) {
      expect(validate(tracedRun.id)).toBe(true);
    }
    expect(tracedRun.reference_example_id).toBe(exampleId);
    expect((tracedRun as Run)?.child_runs?.length).toBe(3);
  });
});
