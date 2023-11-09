import { CloudflareWorkersAI } from "langchain/llms/cloudflare_workersai";

const model = new CloudflareWorkersAI({
  model: "@cf/meta/llama-2-7b-chat-int8", // Default value
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  // Pass a custom base URL to use Cloudflare AI Gateway
  // baseUrl: `https://gateway.ai.cloudflare.com/v1/{YOUR_ACCOUNT_ID}/{GATEWAY_NAME}/workers-ai/`,
});

const response = await model.invoke(
  `Translate "I love programming" into German.`
);

console.log(response);

/*
 Here are a few options:

1. "Ich liebe Programmieren" - This is the most common way to say "I love programming" in German. "Liebe" means "love" in German, and "Programmieren" means "programming".
2. "Programmieren macht mir Spaß" - This means "Programming makes me happy". This is a more casual way to express your love for programming in German.
3. "Ich bin ein großer Fan von Programmieren" - This means "I'm a big fan of programming". This is a more formal way to express your love for programming in German.
4. "Programmieren ist mein Hobby" - This means "Programming is my hobby". This is a more casual way to express your love for programming in German.
5. "Ich liebe es, Programme zu schreiben" - This means "I love writing programs". This is a more formal way to express your love for programming in German.
*/

const stream = await model.stream(
  `Translate "I love programming" into German.`
);

for await (const chunk of stream) {
  console.log(chunk);
}

/*
  Here
  are
  a
  few
  options
  :




  1
  .
  "
  I
  ch
  lie
  be
  Program
  ...
*/
