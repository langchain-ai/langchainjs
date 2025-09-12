const { readFile, writeFile } = require("fs/promises");

const CSS = `\n.tsd-navigation {
  word-break: break-word;
}

.page-menu {
  display: none;
}

.tsd-toolbar-icon.menu {
  display: flex;
  justify-content: center;
  margin-left: 1rem;
}

@media (max-width: 769px) {
.col-content {
    margin-top: 1.5rem;
  }
#tsd-toolbar-links {
        display: block
    }
    a.title {
  margin-left: 1.8rem;
}
}

@media (min-width: 770px) {
#tsd-search {
  display: flex;
  align-items: center;
}
a.title {
  margin-left: auto;
  margin-right: auto;
}
a.tsd-widget.tsd-toolbar-icon.menu.no-caption {
    display: none;
  }
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

async function main() {
  let cssContents = await readFile("./public/assets/style.css", "utf-8");
  cssContents += CSS;
  await writeFile("./public/assets/style.css", cssContents);
}

main();
