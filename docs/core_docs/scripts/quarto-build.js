const fs = require("node:fs");
const { glob } = require("glob");
const { execSync } = require("node:child_process");

const IGNORED_CELL_REGEX =
  /^``` *\w*?[\s\S]\/\/ ?@lc-docs-hide-cell[\s\S]*?^```/gm;
const LC_TS_IGNORE_REGEX = /\/\/ ?@lc-ts-ignore\n/g;

async function main() {
  const allIpynb = await glob("./docs/**/*.ipynb");

  const allRenames = allIpynb.flatMap((filename) => [
    filename.replace(".ipynb", ".md"),
    filename.replace(".ipynb", ".mdx"),
  ]);
  const pathToRootGitignore = ".gitignore";
  let gitignore = fs.readFileSync(pathToRootGitignore, "utf-8");
  gitignore = gitignore.split("# AUTO_GENERATED_DOCS")[0];
  gitignore += "# AUTO_GENERATED_DOCS\n";
  gitignore += allRenames.join("\n");
  fs.writeFileSync(pathToRootGitignore, gitignore);
  for (const renamedFilepath of allRenames) {
    if (fs.existsSync(renamedFilepath)) {
      let content = fs.readFileSync(renamedFilepath, "utf-8").toString();
      if (
        content.match(IGNORED_CELL_REGEX) ||
        content.match(LC_TS_IGNORE_REGEX)
      ) {
        content = content
          .replace(IGNORED_CELL_REGEX, "")
          .replace(LC_TS_IGNORE_REGEX, "");
        fs.writeFileSync(renamedFilepath, content);
      }
    }
  }

  try {
    /**
     * Run Prettier on all generated .ipynb -> .mdx because we don't
     * currently have another way to format code written in notebooks.
     */
    const command = `pnpm prettier --write ${allRenames
      .filter((filename) => fs.existsSync(filename))
      .join(" ")}`;
    execSync(command);
  } catch (error) {
    console.error(
      {
        error,
        stdout: error?.stderr?.toString(),
      },
      "Failed to format notebooks"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
