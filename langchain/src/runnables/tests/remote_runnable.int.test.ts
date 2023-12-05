import { RemoteRunnable } from "../remote.js";

test("Invoke local langserve", async () => {
  const remote = new RemoteRunnable({
    url: `https://chat-langchain-backend.langchain.dev/chat`,
  });
  const result = remote.streamLog({
    question: "who is joe byron?",
    diff: true,
  });
  let totalByteSize = 0;
  for await (const chonky of result) {
    // console.log("chonky", chonky);
    const jsonString = JSON.stringify(chonky);
    const byteSize = Buffer.byteLength(jsonString, "utf-8");
    // console.log("chonky", byteSize);
    totalByteSize += byteSize;
  }
  console.log("totalByteSize", totalByteSize);
});
