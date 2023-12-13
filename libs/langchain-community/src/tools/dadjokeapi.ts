import { Tool } from "@langchain/core/tools";

/**
 * The DadJokeAPI class is a tool for generating dad jokes based on a
 * specific topic. It fetches jokes from an external API and returns a
 * random joke from the results. If no jokes are found for the given
 * search term, it returns a message indicating that no jokes were found.
 */
class DadJokeAPI extends Tool {
  static lc_name() {
    return "DadJokeAPI";
  }

  name = "dadjoke";

  description =
    "a dad joke generator. get a dad joke about a specific topic. input should be a search term.";

  /** @ignore */
  async _call(input: string): Promise<string> {
    const headers = { Accept: "application/json" };
    const searchUrl = `https://icanhazdadjoke.com/search?term=${input}`;

    const response = await fetch(searchUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    const jokes = data.results;

    if (jokes.length === 0) {
      return `No dad jokes found about ${input}`;
    }

    const randomIndex = Math.floor(Math.random() * jokes.length);
    const randomJoke = jokes[randomIndex].joke;

    return randomJoke;
  }
}

export { DadJokeAPI };
