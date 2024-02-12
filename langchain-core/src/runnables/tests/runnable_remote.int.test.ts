import { HumanMessage } from "../../messages/index.js";
import { applyPatch } from "../../utils/json_patch.js";
import { RemoteRunnable } from "../remote.js";

test("streamLog hosted langserve", async () => {
  const remote = new RemoteRunnable({
    url: `https://chat-langchain-backend.langchain.dev/chat`,
  });
  const result = await remote.streamLog({
    question: "What is a document loader?",
  });
  let totalByteSize = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aggregate: any = {};
  for await (const chunk of result) {
    const jsonString = JSON.stringify(chunk);
    aggregate = applyPatch(aggregate, chunk.ops).newDocument;
    const byteSize = Buffer.byteLength(jsonString, "utf-8");
    totalByteSize += byteSize;
  }
  console.log("aggregate", aggregate);
  console.log("totalByteSize", totalByteSize);
});

test("streamLog hosted langserve with concat syntax", async () => {
  const remote = new RemoteRunnable({
    url: `https://chat-langchain-backend.langchain.dev/chat`,
  });
  const result = await remote.streamLog({
    question: "What is a document loader?",
  });
  let totalByteSize = 0;
  let state;

  for await (const chunk of result) {
    if (!state) {
      state = chunk;
    } else {
      state = state.concat(chunk);
    }
    const jsonString = JSON.stringify(chunk);
    const byteSize = Buffer.byteLength(jsonString, "utf-8");
    totalByteSize += byteSize;
  }
  console.log("final state", state);
  console.log("totalByteSize", totalByteSize);
});

test.skip("streamLog with raw messages", async () => {
  const chain = new RemoteRunnable({
    url: "https://aimor-deployment-bf1e4ebc87365334b3b8a6b175fb4151-ffoprvkqsa-uc.a.run.app/",
  });
  const events = chain.streamLog([new HumanMessage("I'd like some advice!")], {
    configurable: { thread_id: "THREAD_ID", user_id: "USER_ID" },
  });
  for await (const logEvent of events) {
    console.log(logEvent);
  }
});
