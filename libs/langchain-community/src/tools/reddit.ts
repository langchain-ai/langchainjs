import { getEnvironmentVariable } from "@langchain/core/utils/env"; //"../../../../langchain-core/src/utils/env.js";
import { RedditAPIWrapper } from "../utils/reddit.js";
import { Tool } from "@langchain/core/tools";

/*  Interface for the search parameters.
 *  sortMethod: The sorting method for the search results, can be one of "relevance", "hot", "top", "new", "comments"
 *  time: The time period for the search results, can be one of "hour", "day", "week", "month", "year", "all"
 *  subreddit: The subreddit to search in like "dankmemes" for "r/dankmemes"
 *  limit: The number of results to return
 *  clientId: The client ID for the Reddit API
 *  clientSecret: The client secret for the Reddit API
 *  userAgent: The user agent for the Reddit API
 */
export interface RedditSearchRunParams {
  sortMethod?: string;
  time?: string;
  subreddit?: string;
  limit?: number;
  clientId?: string;
  clientSecret?: string;
  userAgent?: string;
}

/**
 * Class representing a tool for searching reddit posts using the reddit API.
 * It extends the Tool class.
 *
 * @example
 * ```typescript
 * const search = new RedditSearchRun({
 *  sortMethod: "relevance",
 *  time: "all",
 *  subreddit: "dankmemes",
 *  limit: 1,
 * });
 *
 * const post = await search.invoke("College");
 * ```
 */
export class RedditSearchRun extends Tool {
  static lc_name() {
    return "RedditSearchRun";
  }

  name = "Reddit_search";

  description = "A tool for searching reddit posts using the reddit API";

  // Default values for the search parameters
  protected sortMethod = "relevance";
  protected time = "all";
  protected subreddit = "all";
  protected limit = 2;
  protected clientId = "";
  protected clientSecret = "";
  protected userAgent = "";

  /**
   * Constructor for the RedditSearchRun class
   * @description Initializes the search parameters if given
   * @param params The search parameters
   */
  constructor(params: RedditSearchRunParams = {}) {
    super();

    this.sortMethod = params.sortMethod ?? this.sortMethod;
    this.time = params.time ?? this.time;
    this.subreddit = params.subreddit ?? this.subreddit;
    this.limit = params.limit ?? this.limit;
    this.clientId =
      params.clientId ?? (getEnvironmentVariable("REDDIT_CLIENT_ID") as string);
    this.clientSecret =
      params.clientSecret ??
      (getEnvironmentVariable("REDDIT_CLIENT_SECRET") as string);
    this.userAgent =
      params.userAgent ??
      (getEnvironmentVariable("REDDIT_USER_AGENT") as string);
  }

  /**
   * @param {string} query The search query to be sent to reddit
   * @description Function to retrieve posts based on a search query
   * @returns the search results from using the API wrapper
   */
  async _call(query: string): Promise<any> {
    const apiWrapper = new RedditAPIWrapper({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      userAgent: this.userAgent,
    });

    return apiWrapper.searchSubreddit(
      this.subreddit,
      query,
      this.sortMethod,
      this.limit,
      this.time
    );
  }

  /**
   * @param {string} username The username whose posts are to be retrieved
   * @param {string} sortMethod The sorting method for the posts to be retrieved
   * @param {number} limit The number of posts to retrieve starting from the latest post
   * @param {string} time The time period for the posts to be retrieved
   * @description Function to retrieve posts from a certain user
   * @returns The latest limit number of posts from the user
   */
  async fetchUserPosts(
    username: string,
    sortMethod: string = this.sortMethod,
    limit: number = this.limit,
    time: string = this.time
  ): Promise<any> {
    const apiWrapper = new RedditAPIWrapper({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      userAgent: this.userAgent,
    });

    return apiWrapper.fetchUserPosts(username, sortMethod, limit, time);
  }
}
