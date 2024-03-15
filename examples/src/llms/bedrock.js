import { Bedrock } from "langchain/llms/bedrock";

async function test() {
  const model = new Bedrock({
    model: "bedrock-model-name",
    region: "aws-region",
  });
  const res = await model.invoke(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  console.log(res);
}
test();
