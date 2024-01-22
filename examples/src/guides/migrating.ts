import { updateEntrypointsFrom0_0_xTo0_1_x } from "langchain/util/migrations/0_1";

updateEntrypointsFrom0_0_xTo0_1_x({
  localLangChainPath: "../langchain",
  codePath: "/Users/my-profile/code/langchain-chatbot",
})
  .then(() => console.log("done"))
  .catch(console.error);
