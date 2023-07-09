import { GooglePalm } from "langchain/llms/googlepalm";

export const run = async () => {
  // make sure Google PALM API key (from MakerSuite etc.) is set as GOOGLEPALM_API_KEY env
  const model = new GooglePalm({
    // other params
    temperature: 1,
  });
  const res = await model.call(
    "What would be a good company name for a company that makes colorful socks?"
  );
  console.log({ res });
};
