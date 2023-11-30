import { ConneryService } from "langchain/tools";

/**
 * This example shows how to create a tool from one specific Connery action and call it.
 * The getAction method of the ConneryService fetches the action from the Connery runner by ID, constructs a LangChain tool object from it, and returns it to the caller.
 *
 * If you want to use multiple Connery actions in your agent, check out the Connery Toolkit.
 * Example of using Connery Toolkit: ./examples/src/agents/connery_mrkl.ts
 */

const conneryService = new ConneryService();

/**
 * In this example, we use the ID of the "Send email" action from the Gmail plugin (https://github.com/connery-io/gmail).
 * You can find action IDs in the Connery runner.
 */
const action = await conneryService.getAction(
  "CABC80BB79C15067CA983495324AE709"
);

/**
 * The call method of the tool object takes the input expected by the Connery action.
 * You can find the input schema of the action in the Connery runner.
 *
 * Also, the input schema is configured in the schema property of the tool object, so Langchain will understand what input the tool expects and will validate the input.
 */
const result = await action.call({
  recipient: "test@example.com",
  subject: "Test email",
  body: "This is a test email sent from Langchain Connery tool.",
});

console.log(result);
