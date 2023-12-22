const fs = require("fs/promises");
const { glob } = require("glob");
const path = require("path");

async function main() {
  const fullExamplesPath = path.join(process.cwd(), "docs/core_docs/docs");
  const globbered = await glob(`${fullExamplesPath}/**/*.mdx`);
  let iter = 0;
  for await (const file of globbered) {
    const contents = await fs.readFile(file, 'utf8');
    if (contents.includes(`from "langchain/chat_models/openai"`)) {
      console.log("found one!. iter:", iter)
      const newContents = contents.replace(/from "langchain\/chat_models\/openai"/g, `from "@langchain/openai"`);
      await fs.writeFile(file, newContents);
      iter += 1;
    }
  }
}
main()