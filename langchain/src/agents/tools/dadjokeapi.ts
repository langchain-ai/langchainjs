import { Tool } from "./base.js";

class DadJokeAPI extends Tool {
  name: string;

  description: string;

  constructor() {
    super();
    this.name = "dadjoke";
    this.description =
      "a dad joke generator. get a dad joke about a specific topic. input should be a search term.";
  }

  async call(input: string): Promise<string> {
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
