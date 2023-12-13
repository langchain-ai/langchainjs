import { WatsonxAIChat } from "langchain/chat_models/watsonx_ai";

const model = new WatsonxAIChat({
  clientConfig: {
    region: "eu-de",
  },
  modelParameters: {
    max_new_tokens: 100,
  },
});

const stream = await model.stream(
  "What would be a good company name for a company that makes colorful socks?"
);

let text = "";
for await (const chunk of stream) {
  text += chunk.content;
  console.log(text);
}
