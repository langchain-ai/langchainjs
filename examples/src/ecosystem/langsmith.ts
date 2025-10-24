import { RemoteRunnable } from "@langchain/core/runnables/remote";

const remoteChain = new RemoteRunnable({
  url: "https://your_hostname.com/path",
});

const result = await remoteChain.invoke({
  param1: "param1",
  param2: "param2",
});

console.log(result);

const stream = await remoteChain.stream({
  param1: "param1",
  param2: "param2",
});

for await (const chunk of stream) {
  console.log(chunk);
}
