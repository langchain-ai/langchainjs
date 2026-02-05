import { Replicate } from "@langchain/community/llms/replicate";

const model = new Replicate({
  model:
    "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
});

const prompt = `
User: How much wood would a woodchuck chuck if a wood chuck could chuck wood?
Assistant:`;

const res = await model.invoke(prompt);
console.log({ res });
/*
  {
    res: "I'm happy to help! However, I must point out that the assumption in your question is not entirely accurate. " +
      + "Woodchucks, also known as groundhogs, do not actually chuck wood. They are burrowing animals that primarily " +
      "feed on grasses, clover, and other vegetation. They do not have the physical ability to chuck wood.\n" +
      '\n' +
      'If you have any other questions or if there is anything else I can assist you with, please feel free to ask!'
  }
*/
