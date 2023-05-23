import { OpenAI } from "langchain/llms/openai";
import { APIChain } from "langchain/chains";
import { OPEN_METEO_DOCS } from "../../../langchain/src/chains/api/open_meteo_docs.js";

export async function run() {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = APIChain.fromLLMAndApiDocs(model, OPEN_METEO_DOCS);

  const res = await chain.call({
    question:
      "What is the weather like right now in Munich, Germany in degrees Farenheit?",
  });
  console.log({ res });
}
