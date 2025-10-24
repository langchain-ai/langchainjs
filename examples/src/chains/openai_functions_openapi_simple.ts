import { createOpenAPIChain } from "langchain/chains";

const chain = await createOpenAPIChain(
  "https://gist.githubusercontent.com/roaldnefs/053e505b2b7a807290908fe9aa3e1f00/raw/0a212622ebfef501163f91e23803552411ed00e4/openapi.yaml"
);
const result = await chain.run(`What's today's comic?`);

console.log(JSON.stringify(result, null, 2));

/*
  {
    "month": "6",
    "num": 2795,
    "link": "",
    "year": "2023",
    "news": "",
    "safe_title": "Glass-Topped Table",
    "transcript": "",
    "alt": "You can pour a drink into it while hosting a party, although it's a real pain to fit in the dishwasher afterward.",
    "img": "https://imgs.xkcd.com/comics/glass_topped_table.png",
    "title": "Glass-Topped Table",
    "day": "28"
  }
*/
