import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  RedditAPIWrapper,
  RedditPost,
  RedditAPIConfig,
} from "../../utils/reddit.js";

/**
 * Class representing a document loader for loading Reddit posts. It extends
 * the BaseDocumentLoader and implements the RedditAPIConfig interface.
 * @example
 * ```typescript
 * const loader = new RedditPostsLoader({
 *   clientId: "REDDIT_CLIENT_ID",
 *   clientSecret: "REDDIT_CLIENT_SECRET",
 *   userAgent: "REDDIT_USER_AGENT",
 *   searchQueries: ["LangChain", "Langchaindev"],
 *   mode: "subreddit",
 *   categories: ["hot", "new"],
 *   numberPosts: 5
 * });
 * const docs = await loader.load();
 * ```
 */
export class RedditPostsLoader
  extends BaseDocumentLoader
  implements RedditAPIConfig
{
  public clientId: string;

  public clientSecret: string;

  public userAgent: string;

  private redditApiWrapper: RedditAPIWrapper;

  private searchQueries: string[];

  private mode: string;

  private categories: string[];

  private numberPosts: number;

  constructor({
    clientId = getEnvironmentVariable("REDDIT_CLIENT_ID") as string,
    clientSecret = getEnvironmentVariable("REDDIT_CLIENT_SECRET") as string,
    userAgent = getEnvironmentVariable("REDDIT_USER_AGENT") as string,
    searchQueries,
    mode,
    categories = ["new"],
    numberPosts = 10,
  }: RedditAPIConfig & {
    searchQueries: string[];
    mode: string;
    categories?: string[];
    numberPosts?: number;
  }) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.userAgent = userAgent;
    this.redditApiWrapper = new RedditAPIWrapper({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      userAgent: this.userAgent,
    });
    this.searchQueries = searchQueries;
    this.mode = mode;
    this.categories = categories;
    this.numberPosts = numberPosts;
  }

  /**
   * Loads Reddit posts using the Reddit API, creates a Document instance
   * with the JSON representation of the post as the page content and metadata,
   * and returns it.
   * @returns A Promise that resolves to an array of Document instances.
   */
  public async load(): Promise<Document[]> {
    let results: Document[] = [];
    for (const query of this.searchQueries) {
      for (const category of this.categories) {
        let posts: RedditPost[] = [];

        if (this.mode === "subreddit") {
          posts = await this.redditApiWrapper.searchSubreddit(
            query,
            "*",
            category,
            this.numberPosts
          );
        } else if (this.mode === "username") {
          posts = await this.redditApiWrapper.fetchUserPosts(
            query,
            category,
            this.numberPosts
          );
        } else {
          throw new Error(
            "Invalid mode: please choose 'subreddit' or 'username'"
          );
        }
        results = results.concat(this._mapPostsToDocuments(posts, category));
      }
    }

    return results;
  }

  private _mapPostsToDocuments(
    posts: RedditPost[],
    category: string
  ): Document[] {
    return posts.map(
      (post) =>
        new Document({
          pageContent: post.selftext,
          metadata: {
            post_subreddit: post.subreddit_name_prefixed,
            post_category: category,
            post_title: post.title,
            post_score: post.score,
            post_id: post.id,
            post_url: post.url,
            post_author: post.author,
          },
        })
    );
  }
}
