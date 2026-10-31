import { z } from "zod/v3";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool } from "@langchain/core/tools";
import { InferInteropZodOutput } from "@langchain/core/utils/types";

const hackerNewsTopStoriesSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .default(5)
    .describe("The maximum number of top stories to return."),
});

type HackerNewsTopStoriesSchema = typeof hackerNewsTopStoriesSchema;

type HackerNewsItem = {
  id: number;
  title?: string;
  url?: string;
};

/**
 * Tool for fetching current top stories from Hacker News.
 */
export class HackerNewsTopStoriesTool extends StructuredTool<
  typeof hackerNewsTopStoriesSchema
> {
  static lc_name(): string {
    return "HackerNewsTopStoriesTool";
  }

  name = "hacker_news_top_stories";

  description =
    "Fetches the top stories from Hacker News. Useful for getting current tech news.";

  schema = hackerNewsTopStoriesSchema;

  async _call(
    { limit }: InferInteropZodOutput<HackerNewsTopStoriesSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const topStoriesResponse = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json"
    );

    if (!topStoriesResponse.ok) {
      throw new Error(
        `Failed to fetch Hacker News top stories: ${topStoriesResponse.status} ${topStoriesResponse.statusText}`
      );
    }

    const storyIds = (await topStoriesResponse.json()) as number[];
    const selectedStoryIds = storyIds.slice(0, limit);

    const stories = await Promise.all(
      selectedStoryIds.map(async (id) => {
        const itemResponse = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );

        if (!itemResponse.ok) {
          throw new Error(
            `Failed to fetch Hacker News item ${id}: ${itemResponse.status} ${itemResponse.statusText}`
          );
        }

        return (await itemResponse.json()) as HackerNewsItem | null;
      })
    );

    return stories
      .filter((story): story is HackerNewsItem => story !== null)
      .map((story, index) => {
        const title = story.title ?? "Untitled";
        const url =
          story.url ?? `https://news.ycombinator.com/item?id=${story.id}`;
        return `${index + 1}. ${title} - ${url}`;
      })
      .join("\n");
  }
}
