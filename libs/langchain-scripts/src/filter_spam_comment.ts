/* eslint-disable no-process-env */
import { Octokit } from "@octokit/rest";

async function spamContentFilter() {
  if (process.env.SPAM_COMMENT_GITHUB_TOKEN === undefined) {
    throw new Error("SPAM_COMMENT_GITHUB_TOKEN is not set");
  }
  if (process.env.COMMENT_JSON === undefined) {
    throw new Error("COMMENT_JSON is not set");
  }
  if (process.env.COMMENT_ID === undefined) {
    throw new Error("COMMENT_ID is not set");
  }
  if (process.env.REPO_OWNER === undefined) {
    throw new Error("REPO_OWNER is not set");
  }
  if (process.env.REPO_NAME === undefined) {
    throw new Error("REPO_NAME is not set");
  }

  const octokit = new Octokit({ auth: process.env.SPAM_COMMENT_GITHUB_TOKEN });

  const comment: { body: string } = JSON.parse(process.env.COMMENT_JSON || "");
  const commentId = parseInt(process.env.COMMENT_ID || "", 10);
  const owner = process.env.REPO_OWNER || "";
  const repo = process.env.REPO_NAME || "";

  const SPAM_COMMENT_REGEX = [
    /^download\s+(?:https?:\/\/)?[\w-]+(\.[\w-]+)+[^\s]+\s+password:\s*.+\s+in the installer menu, select\s*.+$/i,
  ];

  if (
    SPAM_COMMENT_REGEX.some((pattern) =>
      pattern.test(comment.body.toLowerCase())
    )
  ) {
    try {
      await octokit.rest.issues.deleteComment({
        owner,
        repo,
        comment_id: commentId,
      });
      console.log(`Deleted spam comment with ID: ${commentId}`);
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  } else {
    console.log("Comment is not spam");
  }
}

await spamContentFilter();
