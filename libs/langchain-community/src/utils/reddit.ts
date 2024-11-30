import dotenv from "dotenv";
import { AsyncCaller } from "@langchain/core/utils/async_caller";

dotenv.config();

export interface RedditAPIConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export interface RedditPost {
  title: string;
  selftext: string;
  subreddit_name_prefixed: string;
  score: number;
  id: string;
  url: string;
  author: string;
}

export class RedditAPIWrapper {
  private clientId: string;

  private clientSecret: string;

  private userAgent: string;

  private token: string | null = null;

  private baseUrl = "https://oauth.reddit.com";

  private asyncCaller: AsyncCaller; // Using AsyncCaller for requests

  constructor(config: RedditAPIConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.userAgent = config.userAgent;
    this.asyncCaller = new AsyncCaller({
      maxConcurrency: 5,
      maxRetries: 3,
      onFailedAttempt: (error) => {
        console.error("Attempt failed:", error.message);
      },
    });
  }

  private async authenticate() {
    if (this.token) return;

    const authString = btoa(`${this.clientId}:${this.clientSecret}`);

    try {
      const response = await fetch(
        "https://www.reddit.com/api/v1/access_token",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authString}`,
            "User-Agent": this.userAgent,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Error authenticating with Reddit: ${response.statusText}`
        );
      }

      const data = await response.json();
      this.token = data.access_token;
    } catch (error) {
      console.error("Error authenticating with Reddit:", error);
    }
  }

  private async makeRequest(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    await this.authenticate();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key])
    );

    return this.asyncCaller.call(async () => {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("Rate limit exceeded, retrying...");
          throw new Error("Rate limit exceeded");
        }
        throw new Error(
          `Error making request to ${endpoint}: ${response.statusText}`
        );
      }

      return await response.json();
    });
  }

  async searchSubreddit(
    subreddit: string,
    query: string,
    sort: "new",
    limit: 10,
    time: "all"
  ): Promise<RedditPost[]> {
    const data = await this.makeRequest(`/r/${subreddit}/search`, {
      q: query,
      sort,
      limit,
      t: time,
      restrict_sr: "on",
    });

    return data.data.children.map((item: { data: any; }) => item.data);
  }

  async fetchUserPosts(
    username: string,
    sort = "new",
    limit = 10,
    time = "all"
  ): Promise<RedditPost[]> {
    const data = await this.makeRequest(`/user/${username}/submitted`, {
      sort: sort,
      limit: limit.toString(),
      t: time,
    });

    return data.data.children.map((item: { data: any; }) => item.data);
  }
}
