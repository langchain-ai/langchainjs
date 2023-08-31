import { BaseLLM } from "../../llms/base.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { LLMResult } from "../../schema/index.js";
import { StringOutputParser } from "../../schema/output_parser.js";
import { RunCollectorCallbackHandler } from "../handlers/run_collector.js";
import { v4 as uuidv4, validate } from "uuid";

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
    const prompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate("You are in a rap battle."),
      HumanMessagePromptTemplate.fromTemplate("Write the following {input}"),
    ]);
    const model = new FakeLLM({});
    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const exampleId = uuidv4();
    const collector = new RunCollectorCallbackHandler({ exampleId });

    await chain.invoke({ input: "foo" }, { callbacks: [collector] });

    expect(collector.tracedRuns.length).toBe(1);
    expect(validate(collector.tracedRuns[0].id ?? "")).toBe(true);
    expect(collector.tracedRuns[0].reference_example_id).toBe(exampleId);
  });
});
