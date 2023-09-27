import { Bedrock } from "langchain/llms/bedrock";

// If no credentials are provided, the default credentials from
// @aws-sdk/credential-provider-node will be used.
const model = new Bedrock({
  model: "ai21",
  region: "us-west-2",
  // endpointUrl: "custom.amazonaws.com",
  // credentials: {
  //   accessKeyId: "YOUR_AWS_ACCESS_KEY",
  //   secretAccessKey: "YOUR_SECRET_ACCESS_KEY"
  // }
});
const res = await model.call("Tell me a joke");
console.log(res);
