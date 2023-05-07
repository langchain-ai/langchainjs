import { WebBrowser } from "langchain/tools/webbrowser";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export async function run() {
  // this will not work with Azure OpenAI API yet
  // Azure OpenAI API does not support embedding with multiple inputs yet
  // Too many inputs. The max number of inputs is 1.  We hope to increase the number of inputs per request soon. Please contact us through an Azure support request at: https://go.microsoft.com/fwlink/?linkid=2213926 for further questions.
  // So we will fail fast, when Azure OpenAI API is used
  if (process.env.AZURE_OPENAI_API_KEY) {
    throw new Error(
      "Azure OpenAI API does not support embedding with multiple inputs yet"
    );
  }

  const model = new ChatOpenAI({ temperature: 0 });
  const embeddings = new OpenAIEmbeddings(
    process.env.AZURE_OPENAI_API_KEY
      ? { azureOpenAIApiDeploymentName: "Embeddings2" }
      : {}
  );

  const browser = new WebBrowser({ model, embeddings });

  const result = await browser.call(
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
