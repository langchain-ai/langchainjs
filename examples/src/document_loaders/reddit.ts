import { RedditPostsLoader } from "@langchain/community/document_loaders/web/reddit";

// load using 'subreddit' mode
const loader = new RedditPostsLoader({
  clientId: "REDDIT_CLIENT_ID", // or load it from process.env.REDDIT_CLIENT_ID
  clientSecret: "REDDIT_CLIENT_SECRET", // or load it from process.env.REDDIT_CLIENT_SECRET
  userAgent: "REDDIT_USER_AGENT", // or load it from process.env.REDDIT_USER_AGENT
  searchQueries: ["LangChain", "Langchaindev"],
  mode: "subreddit",
  categories: ["hot", "new"],
  numberPosts: 5
});
const docs = await loader.load();
console.log({ docs });

// // or load using 'username' mode
// const loader = new RedditPostsLoader({
//   clientId: "REDDIT_CLIENT_ID", // or load it from process.env.REDDIT_CLIENT_ID
//   clientSecret: "REDDIT_CLIENT_SECRET", // or load it from process.env.REDDIT_CLIENT_SECRET
//   userAgent: "REDDIT_USER_AGENT", // or load it from process.env.REDDIT_USER_AGENT
//   searchQueries: ["AutoModerator"],
//   mode: "username",
//   categories: ["hot", "new"],
//   numberPosts: 2
// });
// const docs = await loader.load();
// console.log({ docs });

// Note: Categories can be only of following value - "controversial" "hot" "new" "rising" "top"