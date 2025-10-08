import { OpenAI } from "@langchain/openai";
import { DatadogLLMObsTracer } from "@langchain/community/experimental/callbacks/handlers/datadog";

/**
 * This example demonstrates how to use the DatadogLLMObsTracer with the OpenAI model.
 * It will produce a "llm" span with the input and output of the model inside the meta field.
 *
 * To run this example, you need to have a valid Datadog API key and OpenAI API key.
 */
export const run = async () => {
  const model = new OpenAI({
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 1000,
    maxRetries: 5,
  });

  const res = await model.invoke(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:",
    {
      callbacks: [
        new DatadogLLMObsTracer({
          mlApp: "my-ml-app",
        }),
      ],
    }
  );

  console.log({ res });
};
