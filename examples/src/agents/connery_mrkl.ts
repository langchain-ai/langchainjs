import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ConneryToolkit } from "langchain/agents/toolkits/connery";
import { ConneryService } from "langchain/tools/connery";

/**
 * This example shows how to create an agent with Connery actions using the Connery Actions Toolkit.
 *
 * Connery is an open-source plugin infrastructure for AI.
 * Source code: https://github.com/connery-io/connery-platform
 *
 * To run this example, you need to do some preparation:
 * 1. Set up the Connery runner. See a quick start guide here: https://docs.connery.io/docs/platform/quick-start/
 * 2. Intsall the "Summarization" plugin (https://github.com/connery-io/summarization-plugin) on the runner.
 * 3. Install the "Gmail" plugin (https://github.com/connery-io/gmail) on the runner.
 * 4. Set environment variables CONNERY_RUNNER_URL and CONNERY_RUNNER_API_KEY in the ./examples/.env file of this repository.
 *
 * If you want to use only one particular Connery action in your agent,
 * check out an example here: ./examples/src/tools/connery.ts
 */

const model = new OpenAI({ temperature: 0 });
const conneryService = new ConneryService();
const conneryToolkit = await ConneryToolkit.createInstance(conneryService);

const executor = await initializeAgentExecutorWithOptions(
  conneryToolkit.tools,
  model,
  {
    agentType: "zero-shot-react-description",
    verbose: true,
  }
);

/**
 * In this example we use two Connery actions:
 * 1. "Summarize public webpage" from the "Summarization" plugin.
 * 2. "Send email" from the "Gmail" plugin.
 */
const input =
  "Make a short summary of the webpage http://www.paulgraham.com/vb.html in three sentences " +
  "and send it to test@example.com. Include the link to the webpage into the body of the email.";
const result = await executor.invoke({ input });
console.log(result.output);

/**
 * As a result, you should receive an email similar to this:
 *
 * Subject: Summary of "Life is Short"
 * Body: Here is a summary of the webpage "Life is Short" by Paul Graham:
 * The author reflects on the shortness of life and how having children has made them realize
 * the limited time they have. They argue that life is too short for unnecessary things,
 * or "bullshit," and that one should prioritize avoiding it.
 * They also discuss the importance of actively seeking out things that matter and not waiting to do them.
 * The author suggests pruning unnecessary things, savoring the time one has, and not waiting to do what truly matters.
 * They also discuss the effect of how one lives on the length of their life and the importance of being conscious of time.
 * Link to webpage: http://www.paulgraham.com/vb.html
 */
