import { ChatVertexAI } from "@langchain/google-vertexai";
// Or, if using the web entrypoint:
// import { ChatVertexAI } from "@langchain/google-vertexai-web";

const model = new ChatVertexAI({
  temperature: 0.7,
  model: "gemini-1.0-pro",
});

const response = await model.invoke("Why is the ocean blue?");
console.log(response);
/*
AIMessageChunk {
  content: [{ type: 'text', text: 'The ocean appears blue due to a phenomenon called Rayleigh scattering. This occurs when sunlight' }],
  additional_kwargs: {},
  response_metadata: {}
}
 */
