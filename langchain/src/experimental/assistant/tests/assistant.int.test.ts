import { OpenAIAssistant } from "../assistant.js";

test("works", async () => {
  const assistantId = "asst_10kod7SgTuwiwQuzp1JdstKV";
  const threadId = "thread_NZ7jRqSkdtwGM1Rbj6HHjO5i";
  const assistant = await OpenAIAssistant.fromExistingAssistant(assistantId, {
    threadId,
  });

  // const message1 = await assistant.addMessage({
  //   content: "I need help with my math homework. Whats 10 times 10?",
  //   role: "user",
  // });

  const res = await assistant.invoke({});

  console.log("res", res);

  for await (const streamRes of assistant.streamRun(res.id)) {
    console.log("streamRes", streamRes);
  }

  const messages = await assistant.listMessages();
  const messageContent = messages.data.map((m) => m.content[0]);

  console.log(
    "messageContent",
    messageContent.map((m) => m.type === "text" && m.text)
  );

  const steps = await assistant.listRunSteps(res.id);
  const stepsContent = steps.data.map((s) => s.step_details);

  console.log("stepsContent", stepsContent);
});
