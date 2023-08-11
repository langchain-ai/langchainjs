import { Bedrock } from "langchain/llms/bedrock";

async function test() {
  const model = new Bedrock({ model: "ai21", regionName: "us-west-2" });
  const res = await model.call("Tell me a joke");
  console.log(res);
}

test();
