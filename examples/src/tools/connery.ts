import { ConneryService } from "langchain/tools/connery";

/**
 * This example shows how to create a tool for one specific Connery action and call it.
 *
 * Connery is an open-source plugin infrastructure for AI.
 * Source code: https://github.com/connery-io/connery-platform
 *
 * To run this example, you need to do some preparation:
 * 1. Set up the Connery runner. See a quick start guide here: https://docs.connery.io/docs/platform/quick-start/
 * 2. Install the "Gmail" plugin (https://github.com/connery-io/gmail) on the runner.
 * 3. Set environment variables CONNERY_RUNNER_URL and CONNERY_RUNNER_API_KEY in the ./examples/.env file of this repository.
 *
 * If you want to use several Connery actions in your agent, check out the Connery Toolkit.
 * Example of using Connery Toolkit: ./examples/src/agents/connery_mrkl.ts
 */

const conneryService = new ConneryService();

/**
 * The "getAction" method fetches the action from the Connery runner by ID,
 * constructs a LangChain tool object from it, and returns it to the caller.
 *
 * In this example, we use the ID of the "Send email" action from the "Gmail" plugin.
 * You can find action IDs in the Connery runner.
 */
const tool = await conneryService.getAction("CABC80BB79C15067CA983495324AE709");

/**
 * The "call" method of the tool takes a plain English prompt
 * with all the information needed to run the Connery action behind the scenes.
 */
const result = await tool.call(
  "Send an email to test@example.com with the subject 'Test email' and the body 'This is a test email sent from Langchain Connery tool.'"
);

console.log(result);
