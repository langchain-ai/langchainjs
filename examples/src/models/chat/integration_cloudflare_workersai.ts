import { ChatCloudflareWorkersAI } from "langchain/chat_models/cloudflare_workersai";

const model = new ChatCloudflareWorkersAI({
  model: "@cf/meta/llama-2-7b-chat-int8", // Default value
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
});

const response = await model.invoke([
  ["system", "You are a helpful assistant that translates English to German."],
  ["human", `Translate "I love programming".`],
]);

console.log(response);

/*
AIMessage {
  content: `Sure! Here's the translation of "I love programming" into German:\n` +
    '\n' +
    '"Ich liebe Programmieren."\n' +
    '\n' +
    'In this sentence, "Ich" means "I," "liebe" means "love," and "Programmieren" means "programming."',
  additional_kwargs: {}
}
*/
