const fs = require("fs");
const path = require("path");

const PATH_TO_DOCS = "./docs/";

function main() {
  /**
   * @type {string[]}
   */
  const pathToIPYNBFiles = [];
  const getIPYNBFilesInDir = (dir) => {
    const dirContents = fs.readdirSync(dir);
    dirContents.forEach((item) => {
      if (item.endsWith(".ipynb")) {
        pathToIPYNBFiles.push(path.join(dir, item));
      } else if (fs.statSync(path.join(dir, item)).isDirectory()) {
        getIPYNBFilesInDir(path.join(dir, item));
      }
    });
  };
  getIPYNBFilesInDir(PATH_TO_DOCS);
  // read the existing gitignore
  const existingGitignore = fs.readFileSync("./.gitignore", "utf8");
  // split at the # notebook comment
  const [existing] = existingGitignore.split("# notebooks");
  // rewrite the after
  const newGitignore = `${existing}# notebooks\n${pathToIPYNBFiles
    .map((file) => file.replace(".ipynb", ".md"))
    .join("\n")}`;
  fs.writeFileSync("./.gitignore", newGitignore);
}
main();
