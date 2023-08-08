import { Bedrock } from "langchain/llms/bedrock";

async function test() {
  const model = new Bedrock({model: "bedrock-model-name", regionName: "aws-region"});
  const res = await model.call("Question: What would be a good company name a company that makes colorful socks?\nAnswer:");
  console.log(res);
}
test();
