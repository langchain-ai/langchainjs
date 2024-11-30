import { test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { RedditPostsLoader } from "../web/reddit.js";

test.skip("Test RedditPostsLoader in subreddit mode", async () => {
  const loader = new RedditPostsLoader({
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    userAgent: process.env.REDDIT_USER_AGENT!,
    searchQueries: ["LangChain"],
    mode: "subreddit",
    categories: ["new"],
    numberPosts: 2,
  });
  const documents = await loader.load();
  expect(documents).toHaveLength(2);
  expect(documents[0]).toBeInstanceOf(Document);
  expect(documents[0].metadata.post_subreddit).toMatch("LangChain");
  expect(documents[0].metadata.post_category).toMatch("new");
  expect(documents[0].metadata.post_title).toBeTruthy();
  expect(documents[0].metadata.post_score).toBeGreaterThanOrEqual(0);
  expect(documents[0].metadata.post_id).toBeTruthy();
  expect(documents[0].metadata.post_author).toBeTruthy();
  expect(documents[0].metadata.post_url).toMatch(/^http/);
});

test.skip("Test RedditPostsLoader in username mode", async () => {
  const loader = new RedditPostsLoader({
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    userAgent: process.env.REDDIT_USER_AGENT!,
    searchQueries: ["AutoModerator"],
    mode: "username",
    categories: ["hot", "new"],
    numberPosts: 5,
  });
  const documents = await loader.load();
  expect(documents).toHaveLength(10);
  expect(documents[0]).toBeInstanceOf(Document);
  expect(documents[0].metadata.post_author).toMatch("AutoModerator");
  expect(documents[0].metadata.post_category).toMatch("hot");
  expect(documents[0].metadata.post_title).toBeTruthy();
  expect(documents[0].metadata.post_score).toBeGreaterThanOrEqual(0);
  expect(documents[0].metadata.post_id).toBeTruthy();
  expect(documents[0].metadata.post_subreddit).toBeTruthy();
  expect(documents[0].metadata.post_url).toMatch(/^http/);
});
