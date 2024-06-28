import { ChatBedrockConverse } from "@langchain/aws";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatBedrockConverse({
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  },
});

const res = await model.invoke([
  new HumanMessage({ content: "Tell me a joke" }),
]);
console.log(res);

/*
AIMessage {
  content: "Here's a joke for you:\n" +
    '\n' +
    "Why can't a bicycle stand up by itself? Because it's two-tired!",
  response_metadata: { ... },
  id: '08afa4fb-c212-4c1e-853a-d854972bec78',
  usage_metadata: { input_tokens: 11, output_tokens: 28, total_tokens: 39 }
}
*/

const stream = await model.stream([
  new HumanMessage({ content: "Tell me a joke" }),
]);

for await (const chunk of stream) {
  console.log(chunk.content);
}

/*
Here
's
 a
 silly
 joke
 for
 you
:


Why
 di
d the
 tom
ato
 turn
 re
d?
 Because
 it
 saw
 the
 sal
a
d
dressing
!
*/
