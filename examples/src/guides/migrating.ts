import { updateEntrypointsFrom0_0_xTo0_1_x } from "langchain/util/migrations/0_1";

updateEntrypointsFrom0_0_xTo0_1_x({
  localLangChainPath: "/Users/my-profile/langchainjs",
  codePath: "/Users/my-profile/langchainjs-project",
})
  .then(() => console.log("done"))
  .catch(console.error);
