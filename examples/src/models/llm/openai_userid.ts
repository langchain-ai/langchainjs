import { OpenAI } from "@langchain/openai";

const model = new OpenAI({ temperature: 0 });

const res = await model.invoke(
  "What would be a good company name a company that makes colorful socks?",
  {
    options: {
      headers: {
        "User-Id": "123",
      },
    },
  }
);
console.log(res);
