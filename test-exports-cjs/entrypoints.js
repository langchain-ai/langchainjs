const package = require("langchain/package.json");

Object.keys(package.exports).forEach((key) => {
  if (key === "./package.json") return;

  if (key === ".") {
    require("langchain");
  } else {
    require(`langchain/${key.slice(2)}`);
    // If this fails probably means that a ESM-only dependency is being imported
  }
});
