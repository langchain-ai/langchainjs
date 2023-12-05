import { RemoteRunnable } from "../remote.js";

test("Invoke local langserve", async () => {
  const remote = new RemoteRunnable({
    url: `https://chat-langchain-backend.langchain.dev/chat`,
  });
  const result = remote.streamLog({
    question: "What is this?",
    diff: true,
  });
  let totalByteSize = 0;
  for await (const chonky of result) {
    const jsonString = JSON.stringify(chonky);
    const byteSize = Buffer.byteLength(jsonString, "utf-8");
    totalByteSize += byteSize;
    console.log(chonky);
  }
  console.log("totalByteSize", totalByteSize);
});
