import { GooglePalm } from "langchain/llms/googlepalm";

// make sure Google PALM API key (from MakerSuite etc.) is set as GOOGLEPALM_API_KEY env
const model = new GooglePalm({
  // other params
});
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
