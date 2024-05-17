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
}

.deprecation-warning {
  background-color: #ef4444;
  border-radius: 0.375rem;
  display: flex;
  flex-direction: column;
  padding: 12px;
  text-align: left;
}

.version-select {
  display: inline-block;
  margin-left: 10px;
  z-index: 1;
}

.version-select select {
  padding: 2.5px 5px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  color: #333;
  cursor: pointer;
}

.version-select select:hover {
  border-color: #999;
}

.version-select select:focus {
  outline: none;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
}
`;

  let file = await readFile("./public/assets/style.css", "utf-8");
  file += css;
  await writeFile("./public/assets/style.css", file);
}
main();
