import { VertexAI } from "@langchain/google-vertexai";
// Or, if using the web entrypoint:
// import { VertexAI } from "@langchain/google-vertexai-web";

const model = new VertexAI({
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
 * Kaleidoscope Toes
* Huephoria
* Soleful Spectrum
*

---------
Chunk:
---------
  Colorwave Hosiery
* Chromatic Threads
* Rainbow Rhapsody
* Vibrant Soles
* Toe-tally Colorful
* Socktacular Hues
*

---------
Chunk:
---------
  Threads of Joy

---------
Chunk:
---------
*/
