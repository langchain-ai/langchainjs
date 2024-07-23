import { ChatVertexAI } from "@langchain/google-vertexai";

const model = new ChatVertexAI({
  model: "gemini-pro-vision", 
  temperature: 0.7,
});

const imageURL = "imageURL"; // Replace with your image URL

const response = await model.invoke([
  { type: "text", text: "Describe what you see in this image." },
  { type: "image_url", image_url: { url: imageURL } },
]);

console.log(response.content); // Extract the text content from the response