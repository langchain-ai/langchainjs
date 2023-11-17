const { readFile, writeFile } = require("fs/promises");

async function main() {
  const css = `\n.tsd-navigation {
    word-break: break-word;
}

.col-content {
    min-width: fit-content;
}

.page-menu {
    display: none;
}\n`;

  let file = await readFile("./public/assets/style.css", "utf-8");
  file += css;
  await writeFile("./public/assets/style.css", file);
}
main();
