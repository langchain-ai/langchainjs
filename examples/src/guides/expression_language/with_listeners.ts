import { Run } from "langchain/callbacks";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a nice assistant."],
  ["human", "{question}"],
]);
const model = new ChatOpenAI({});
const chain = prompt.pipe(model);

const trackTime = () => {
  let start: { startTime: number; question: string };
  let end: { endTime: number; answer: string };

  const handleStartOrEnd = (run: Run, isStart: boolean) => {
    if (isStart) {
      start = {
        startTime: run.start_time,
        question: run.inputs.question,
      };
    } else if (run.end_time && run.outputs && !isStart) {
      end = {
        endTime: run.end_time,
        answer: run.outputs.content,
      };
    }

    if (!isStart) {
      console.log("start", start);
      console.log("end", end);
      console.log(`total time: ${end.endTime - start.startTime}ms`);
    }
  };

  return { handleStartOrEnd };
};

const { handleStartOrEnd } = trackTime();

await chain
  .withListeners({
    onStart: (run: Run) => {
      try {
        handleStartOrEnd(run, true);
      } catch (e) {
        console.error("Bruh");
        throw e;
      }
    },
    onEnd: (run: Run) => {
      handleStartOrEnd(run, false);
    },
  })
  .invoke({ question: "What is the meaning of life?" });

/**
 * start { startTime: 1701723365470, question: 'What is the meaning of life?' }
end {
  endTime: 1701723368767,
  answer: "The meaning of life is a philosophical question that has been contemplated and debated by scholars, philosophers, and individuals for centuries. The answer to this question can vary depending on one's beliefs, perspectives, and values. Some suggest that the meaning of life is to seek happiness and fulfillment, others propose it is to serve a greater purpose or contribute to the well-being of others. Ultimately, the meaning of life can be subjective and personal, and it is up to each individual to determine their own sense of purpose and meaning."
}
total time: 3297ms
 */
