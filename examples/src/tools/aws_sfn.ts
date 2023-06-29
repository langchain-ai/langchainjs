import { StartExecutionAWSSfnTool } from "langchain/tools/aws_sfn";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export async function run() {
  // const model = new ChatOpenAI({ temperature: 0 });

  const sfn = new StartExecutionAWSSfnTool({
    name: "Summarize PDF",
    description: "Summarize a PDF",
    stateMachineArn: "arn:aws:states:us-east-1:1234567890:stateMachine:my-state-machine",
  });

  const result = await sfn.call(
    `{}`
  );

  console.log(result);
  /*
  Output: arn:aws:states:us-east-1:1234567890:execution:my-state-machine:<execuation-name-or-uuid>

  Relevant Links:
  - https://aws.amazon.com/step-functions/
  */
}
