import {
  ConneryToolkit,
  initializeAgentExecutorWithOptions,
} from "langchain/agents";
import { OpenAI } from "langchain/llms/openai";
import { ConneryService } from "langchain/tools";

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
  "Make a short summary of the webpage http://www.paulgraham.com/vb.html in three sentences and send it to test@example.com. Include the link to the webpage into the body of the email.";
const result = await executor.invoke({ input });
console.log(result.output);
