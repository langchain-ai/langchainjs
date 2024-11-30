import { test, expect } from "@jest/globals";
//import { Document } from "@langchain/core/documents";
//import { RedditPostsLoader } from "../web/reddit.js";
import { RedditSearchRun } from "../reddit.js";

test("Test fetching a post based on a query", async () => {
  const search = new RedditSearchRun({
    sortMethod: "relevance",
    time: "all",
    subreddit: "dankmemes",
    limit: 1,
  });

  const post = await search.invoke("College");
  expect(post).toHaveLength(1);
});

test("Test fetching a post from a user", async () => {
  const search = new RedditSearchRun({
    sortMethod: "relevance",
    time: "all",
    subreddit: "dankmemes",
    limit: 1,
  });

  const post = await search.fetchUserPosts("BloodJunkie", 1, "all");
  expect(post).toHaveLength(1);
});
