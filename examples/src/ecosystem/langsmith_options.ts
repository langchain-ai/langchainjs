import { RemoteRunnable } from "langchain/runnables/remote";

const remoteChain = new RemoteRunnable({
  url: "https://your_hostname.com/path",
  options: {
    timeout: 10000,
    headers: {
      Authorization: "Bearer YOUR_TOKEN",
    },
  },
});

const result = await remoteChain.invoke({
  param1: "param1",
  param2: "param2",
});

console.log(result);
