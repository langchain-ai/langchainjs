import { updateEntrypointsFrom0_0_xTo0_1_x } from "@langchain/scripts/migrations";

await updateEntrypointsFrom0_0_xTo0_1_x({
  // Path to the local langchainjs repository
  localLangChainPath: "/Users/my-profile/langchainjs",
  // Path to the repository where the migration should be applied
  codePath: "/Users/my-profile/langchainjs-project",
});
