import { Ollama } from "@langchain/ollama";
import * as fs from "node:fs/promises";

const imageData = await fs.readFile("./hotdog.jpg");
const model = new Ollama({
  model: "llava",
  baseUrl: "http://127.0.0.1:11434",
}).withConfig({
  images: [imageData.toString("base64")],
});
const res = await model.invoke("What's in this image?");
console.log({ res });

/*
  {
    res: ' The image displays a hot dog sitting on top of a bun, which is placed directly on the table. The hot dog has a striped pattern on it and looks ready to be eaten.'
  }
*/
