import { Replicate } from "langchain/llms/replicate";

const model = new Replicate({
  model:
    "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
});

const res = await model.call(
  "How much wood would a woodchuck chuck if a wood chuck could chuck wood?"
);
console.log({ res });
/*
  {
    res: "This tongue twister is a playful way to explore the idea of a woodchuck's ability to move wood.\n" +
    "However, it is important to note that woodchucks, also known as groundhogs, do not actually chuck wood. " +
    "If we were to interpret this tongue twister literally, we could say that a woodchuck could potentially move a " +
    "small to moderate amount of wood given its size and strength. However, it is important to remember that this " +
    "is purely hypothetical as woodchucks do not have the ability to chuck wood.\n" +
    "In conclusion, this tongue twister is a fun and lighthearted way to explore the idea of a woodchuck's " +
    "potential abilities but it is not meant to be taken literally."
  }
*/
