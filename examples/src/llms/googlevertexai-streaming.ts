import { GoogleVertexAI } from "langchain/llms/googlevertexai";

const model = new GoogleVertexAI({
  temperature: 0.7,
});
const stream = await model.stream(
  "What would be a good company name for a company that makes colorful socks?"
);

for await (const chunk of stream) {
  console.log("\n---------\nChunk:\n---------\n", chunk);
}

/*
  ---------
  Chunk:
  ---------
    1. Toe-tally Awesome Socks
  2. The Sock Drawer
  3. Happy Feet
  4. 

  ---------
  Chunk:
  ---------
  Sock It to Me
  5. Crazy Color Socks
  6. Wild and Wacky Socks
  7. Fu

  ---------
  Chunk:
  ---------
  nky Feet
  8. Mismatched Socks
  9. Rainbow Socks
  10. Sole Mates

  ---------
  Chunk:
  ---------
  

*/
