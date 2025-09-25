import { z } from "zod";
import { createAgent, createMiddleware, tool, HumanMessage } from "langchain";

// GitHub tools
const githubCreateIssue = tool(
  async ({ repo, title }) => ({
    url: `https://github.com/${repo}/issues/1`,
    title,
  }),
  {
    name: "github_create_issue",
    description: "Create an issue in a GitHub repository",
    schema: z.object({ repo: z.string(), title: z.string() }),
  }
);

// GitLab tools
const gitlabCreateIssue = tool(
  async ({ project, title }) => ({
    url: `https://gitlab.com/${project}/-/issues/1`,
    title,
  }),
  {
    name: "gitlab_create_issue",
    description: "Create an issue in a GitLab project",
    schema: z.object({ project: z.string(), title: z.string() }),
  }
);

const allTools = [githubCreateIssue, gitlabCreateIssue];

// Choose tools based on user context (e.g., vcsProvider = "github" | "gitlab")
const vcsToolGate = createMiddleware({
  name: "VcsToolGate",
  contextSchema: z.object({ vcsProvider: z.string() }),
  modifyModelRequest: (request, _state, runtime) => {
    const provider = runtime.context.vcsProvider.toLowerCase();
    const active =
      provider === "gitlab" ? [gitlabCreateIssue] : [githubCreateIssue];
    return { ...request, tools: active };
  },
});

const agent = createAgent({
  model: "openai:gpt-4o",
  tools: allTools, // superset for validation; middleware narrows per turn
  middleware: [vcsToolGate],
});

// GitHub user
const resultGithub = await agent.invoke(
  {
    messages: [
      new HumanMessage(
        "Open an issue titled 'Bug: login fails' in my langchain-ai/langchainjs project"
      ),
    ],
  },
  {
    context: { vcsProvider: "github" },
  }
);
console.log("GitHub tool call result:", resultGithub.messages.at(-1)?.content);

// GitLab user
const resultGitlab = await agent.invoke(
  {
    messages: [
      new HumanMessage(
        "Open an issue titled 'Bug: login fails' in my langchain-ai/langchainjs project"
      ),
    ],
  },
  { context: { vcsProvider: "gitlab" } }
);
console.log("GitLab tool call result:", resultGitlab.messages.at(-1)?.content);
