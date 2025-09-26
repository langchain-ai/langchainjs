import { z } from "zod";
import { tool, createAgent, HumanMessage } from "langchain";
import { toolSequenceMiddleware } from "langchain/middleware";

const checkoutCode = tool(
  async ({ repo, branch }) => {
    console.log("checkout_code", repo, branch);
    return "Successfully checked out code.";
  },
  {
    name: "checkout_code",
    description: "Check out code from a repository.",
    schema: z.object({ repo: z.string(), branch: z.string() }),
  }
);

const runTest = tool(
  ({ repo, branch }) => {
    console.log("run tests", repo, branch);
    return "test run successful";
  },
  {
    name: "run_tests",
    description: "Run tests for a repository.",
    schema: z.object({ repo: z.string(), branch: z.string() }),
  }
);

const deploy = tool(
  ({ repo, branch }) => {
    console.log("deploy", repo, branch);
    return "deploy successful";
  },
  {
    name: "deploy",
    description: "Deploy a repository.",
    schema: z.object({ repo: z.string(), branch: z.string() }),
  }
);

const cicd = toolSequenceMiddleware({
  name: "cicd-test-pipeline",
  description: "A pipeline for testing and deploying a repository.",
  schema: z.object({ repo: z.string(), branch: z.string() }),
  workflow: {
    checkout_code: "run_tests",
    runTests: "deploy",
  },
  tools: [checkoutCode, runTest, deploy],
  start: "checkout_code",
});

const agent = createAgent({
  model: "openai:gpt-4o",
  middleware: [cicd],
});

const result = await agent.invoke({
  messages: [
    new HumanMessage(
      "I've pushed a new commit to the repository: langchain-ai/langchainjs, let's test and deploy it."
    ),
  ],
});
