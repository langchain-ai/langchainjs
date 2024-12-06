import RedditSearchRun from "@langchain/community/tools/reddit";

// Retrieve a post from a subreddit

// Refer to doc linked below for how to set the userAgent. 
// https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki
// clientId, clientSecret and userAgent can be set in the environment variables
const search = new RedditSearchRun({
  sortMethod: "relevance",
  time: "all",
  subreddit: "dankmemes",
  limit: 1,
  clientId: "REDDIT_CLIENT_ID", // or load from process.env.REDDIT_CLIENT_ID
  clientSecret: "REDDIT_CLIENT_SECRET", // or load from process.env.REDDIT_CLIENT_SECRET
  userAgent: "REDDIT_USER_AGENT" // or load from process.env.REDDIT_USER_AGENT
});

const post = await search.invoke("College");
console.log(post);

// Retrieve a post from a user

// const search = new RedditSearchRun({
//   sortMethod: "relevance",
//   time: "all",
//   subreddit: "dankmemes",
//   limit: 1,
//   clientId: "REDDIT_CLIENT_ID", // or load from process.env.REDDIT_CLIENT_ID
//   clientSecret: "REDDIT_CLIENT_SECRET", // or load from process.env.REDDIT_CLIENT_SECRET
//   userAgent: "REDDIT_USER_AGENT" // or load from process.env.REDDIT_USER_AGENT
// });

// const post = await search.fetchUserPosts("REDDIT USER TO RETRIEVE POST FROM", 1, "all");
// console.log(post);