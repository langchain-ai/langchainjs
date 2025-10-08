import { AlephAlpha } from "@langchain/community/llms/aleph_alpha";

const model = new AlephAlpha({
  aleph_alpha_api_key: "YOUR_ALEPH_ALPHA_API_KEY", // Or set as process.env.ALEPH_ALPHA_API_KEY
});

const res = await model.invoke(`Is cereal soup?`);

console.log({ res });

/*
  {
    res: "\nIs soup a cereal? I don’t think so, but it is delicious."
  }
 */
