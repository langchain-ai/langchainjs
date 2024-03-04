const fs = require("node:fs/promises");
const { glob } = require("glob");

async function main() {
  const allIpynb = await glob("./docs/**/*.ipynb");

  const allRenames = allIpynb.flatMap((filename) => [
    filename.replace(".ipynb", ".md"),
    filename.replace(".ipynb", ".mdx"),
  ]);
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
