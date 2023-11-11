import { GoogleVertexAI } from "langchain/llms/googlevertexai";
// Or, if using the web entrypoint:
// import { GoogleVertexAI } from "langchain/llms/googlevertexai/web";

/*
 * Before running this, you should make sure you have created a
 * Google Cloud Project that is permitted to the Vertex AI API.
 *
 * You will also need permission to access this project / API.
 * Typically, this is done in one of three ways:
 * - You are logged into an account permitted to that project.
 * - You are running this on a machine using a service account permitted to
 *   the project.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the project.
 */
const model = new GoogleVertexAI({
  temperature: 0.7,
});
const res = await model.call(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
