import { Bedrock } from "langchain/llms/bedrock";
// Or, from web environments:
// import { Bedrock } from "langchain/llms/bedrock/web";

// If no credentials are provided, the default credentials from
// @aws-sdk/credential-provider-node will be used.
const model = new Bedrock({
  model: "ai21.j2-grande-instruct", // You can also do e.g. "anthropic.claude-v2"
  region: "us-east-1",
  // endpointUrl: "custom.amazonaws.com",
  // credentials: {
  //   accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
  //   secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  // },
  // modelKwargs: {},
});

const res = await model.invoke("Tell me a joke");
console.log(res);

/*


  Why was the math book unhappy?

  Because it had too many problems!
*/
