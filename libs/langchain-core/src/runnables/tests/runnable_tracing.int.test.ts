import { Client } from "langsmith";
import { test } from "vitest";
import { LangChainTracer } from "../../tracers/tracer_langchain.js";
import {
  BaseOutputParser,
  FormatInstructionsOptions,
} from "../../output_parsers/base.js";
import { FakeChatModel } from "../../utils/testing/index.js";
import { getEnvironmentVariable } from "../../utils/env.js";

class FakeDateOutputParser extends BaseOutputParser<Date> {
  lc_namespace = ["langchain_core", "output_parsers", "testing"];

  async parse(_text: string): Promise<Date> {
    return new Date();
  }

  getFormatInstructions(_options?: FormatInstructionsOptions): string {
    return "";
  }
}

test("Should handle tracing with a date output", async () => {
  const client = new Client({
    apiUrl: getEnvironmentVariable("LANGCHAIN_ENDPOINT"),
    apiKey: getEnvironmentVariable("LANGCHAIN_API_KEY"),
  });

  const tracer = new LangChainTracer({
    projectName: getEnvironmentVariable("LANGCHAIN_SESSION"),
    client,
  });
  const model = new FakeChatModel({});
  const parser = new FakeDateOutputParser();
  const chain = model.pipe(parser);
  const result = await chain.invoke("test", { callbacks: [tracer] });
  expect(result).toBeDefined();
});
