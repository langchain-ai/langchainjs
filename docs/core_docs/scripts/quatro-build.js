const fs = require("node:fs/promises");
const { glob } = require("glob");

async function main() {
  const allIpynb = await glob("./docs/**/*.ipynb");
  // iterate over each & rename to `.mdx` if a `.md` already exists
  const renamePromise = allIpynb.flatMap(async (ipynb) => {
    const md = ipynb.replace(".ipynb", ".md");
    // verify file exists
    let fileExists = false;
    try {
      await fs.access(md, fs.constants.W_OK);
      fileExists = true;
    } catch (_) {
      // no-op
    }
    if (!fileExists) {
      return [];
    }
    // rename
    await fs.rename(md, md + "x");

    // Quatro generates irregular quotes in the markdown files
    const badOpeningQuote = `“`;
    const badClosingQuote = `”`;
    const goodQuote = `"`;
    const contents = await fs.readFile(md + "x", "utf-8");
    if (
      contents.includes(badOpeningQuote) ||
      contents.includes(badClosingQuote)
    ) {
      // Regex search and replace all badQuotes
      const newContents = contents
        .replace(new RegExp(badOpeningQuote, "g"), goodQuote)
        .replace(new RegExp(badClosingQuote, "g"), goodQuote);
      await fs.writeFile(md + "x", newContents);
    }

    return [`${md}x`];
  });

  const allRenames = await Promise.all(renamePromise);
  const pathToRootGitignore = ".gitignore";
  let gitignore = await fs.readFile(pathToRootGitignore, "utf-8");
  gitignore = gitignore.split("# AUTO_GENERATED_DOCS")[0];
  gitignore += "# AUTO_GENERATED_DOCS\n";
  gitignore += allRenames.join("\n");
  await fs.writeFile(pathToRootGitignore, gitignore);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
