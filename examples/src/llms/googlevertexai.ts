import { VertexAI } from "@langchain/google-vertexai";
// Or, if using the web entrypoint:
// import { VertexAI } from "@langchain/google-vertexai-web";

const model = new VertexAI({
  temperature: 0.7,
});
const res = await model.invoke(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
/*
{
  res: '* Hue Hues\n' +
    '* Sock Spectrum\n' +
    '* Kaleidosocks\n' +
    '* Threads of Joy\n' +
    '* Vibrant Threads\n' +
    '* Rainbow Soles\n' +
    '* Colorful Canvases\n' +
    '* Prismatic Pedals\n' +
    '* Sock Canvas\n' +
    '* Color Collective'
}
 */
