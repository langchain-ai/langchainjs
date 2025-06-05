import * as readline from "readline";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { callToolList, model } from "./helpers.js";

// Use readline to ask the user for approval
function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin as unknown as NodeJS.ReadableStream,
    output: process.stdout as unknown as NodeJS.WritableStream,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function humanApproval(toolInvocations: any[]): Promise<any[]> {
  const toolStrs = toolInvocations
    .map((toolCall) => JSON.stringify(toolCall, null, 2))
    .join("\n\n");
  const msg = `Do you approve of the following tool invocations\n\n${toolStrs}

Anything except 'Y'/'Yes' (case-insensitive) will be treated as a no.\n`;

  // Ask the user for approval
  const resp = await askQuestion(msg);
  if (!["yes", "y"].includes(resp.toLowerCase())) {
    throw new Error(`Tool invocations not approved:\n\n${toolStrs}`);
  }
  return toolInvocations;
}

const chain = model
  .pipe(new JsonOutputToolsParser())
  .pipe(humanApproval)
  .pipe(callToolList);

const response = await chain.invoke(
  "how many emails did i get in the last 5 days?"
);
console.log(response);
/**
Do you approve of the following tool invocations

{
  "type": "count_emails",
  "args": {
    "lastNDays": 5
  }
}

Anything except 'Y'/'Yes' (case-insensitive) will be treated as a no.
y
[ { type: 'count_emails', args: { lastNDays: 5 }, output: '10' } ]
 */
const response2 = await chain.invoke(
  "Send sally@gmail.com an email saying 'What's up homie'"
);
console.log(response2);
/**
Do you approve of the following tool invocations

{
  "type": "send_email",
  "args": {
    "message": "What's up homie",
    "recipient": "sally@gmail.com"
  }
}

Anything except 'Y'/'Yes' (case-insensitive) will be treated as a no.
y
[
  {
    type: 'send_email',
    args: { message: "What's up homie", recipient: 'sally@gmail.com' },
    output: 'Successfully sent email to sally@gmail.com'
  }
]
 */
