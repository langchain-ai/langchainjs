import { BedrockChat } from "langchain/llms/bedrock-chat";

async function test() {
  const model = new BedrockChat({model: "bedrock-model-name", region: "aws-region", streaming: true});
  const res = await model.call("Question: What would be a good company name a company that makes colorful socks?\nAnswer:");
  console.log(res);
}
test();
