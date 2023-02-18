import { OpenAI } from "langchain";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const res = await model.call(
    "What would be a good company name a company that makes colorful socks?",
    undefined,
    {
      headers: {
        "User-Id": "123",
      },
    }
  );
  console.log(res);
};
