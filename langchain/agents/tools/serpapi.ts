import { getJson, GoogleParameters } from "serpapi";
import { Tool } from "./index";

export const SerpAPI = (
  params?: Partial<GoogleParameters>,
  apiKey?: string
): Tool => {
  const key = apiKey ?? process.env.SERPAPI_API_KEY;
  return {
    name: "search",
    call: async (input: string) => {
      const res = await getJson("google", {
        ...params,
        api_key: key,
        q: input,
      });

      if (res.error) {
        throw new Error(`Got error from serpAPI: ${res.error}`);
      }

      if (res.answer_box?.answer) {
        return res.answer_box.answer;
      }

      if (res.answer_box?.snippet) {
        return res.answer_box.snippet;
      }

      if (res.answer_box?.snippet_highlighted_words) {
        return res.answer_box.snippet_highlighted_words[0];
      }

      if (res.sports_results?.game_spotlight) {
        return res.sports_results.game_spotlight;
      }

      if (res.knowledge_graph?.description) {
        return res.knowledge_graph.description;
      }

      if (res.organic_results?.[0]?.snippet) {
        return res.organic_results[0].snippet;
      }

      return "No good search result found";
    },

    description:
      // eslint-disable-next-line max-len
      "a search engine. useful for when you need to answer questions about current events. input should be a search query.",
  };
};
