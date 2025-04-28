import { WebBrowser } from "langchain/tools/webbrowser";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export async function run() {
  const model = new ChatOpenAI({ temperature: 0 });
  const embeddings = new OpenAIEmbeddings();

  const browser = new WebBrowser({ model, embeddings });

  const result = await browser.invoke(
    `"https://www.themarginalian.org/2015/04/09/find-your-bliss-joseph-campbell-power-of-myth","who is joseph campbell"`
  );

  console.log(result);
  /*
  Joseph Campbell was a mythologist and writer who discussed spirituality, psychological archetypes, cultural myths, and the mythology of self. He sat down with Bill Moyers for a lengthy conversation at George Lucas’s Skywalker Ranch in California, which continued the following year at the American Museum of Natural History in New York. The resulting 24 hours of raw footage were edited down to six one-hour episodes and broadcast on PBS in 1988, shortly after Campbell’s death, in what became one of the most popular in the history of public television.

  Relevant Links:
  - [The Holstee Manifesto](http://holstee.com/manifesto-bp)
  - [The Silent Music of the Mind: Remembering Oliver Sacks](https://www.themarginalian.org/2015/08/31/remembering-oliver-sacks)
  - [Joseph Campbell series](http://billmoyers.com/spotlight/download-joseph-campbell-and-the-power-of-myth-audio/)
  - [Bill Moyers](https://www.themarginalian.org/tag/bill-moyers/)
  - [books](https://www.themarginalian.org/tag/books/)
  */
}
