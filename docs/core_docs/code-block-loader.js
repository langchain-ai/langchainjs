/* eslint-disable prefer-template */
/* eslint-disable no-param-reassign */
// eslint-disable-next-line import/no-extraneous-dependencies
const swc = require("@swc/core");
const path = require("path");
const fs = require("fs");

/**
 *
 * @param {string|Buffer} content Content of the resource file
 * @param {object} [map] SourceMap data consumable by https://github.com/mozilla/source-map
 * @param {any} [meta] Meta data, could be anything
 */
async function webpackLoader(content, map, meta) {
  const cb = this.async();
  const BASE_URL = "https://api.js.langchain.com";
  // Directories generated inside the API docs (excluding "modules").
  const CATEGORIES = [
    "classes",
    "functions",
    "interfaces",
    "types",
    "variables",
  ];

  if (!this.resourcePath.endsWith(".ts")) {
    cb(null, JSON.stringify({ content, imports: [] }), map, meta);
    return;
  }

  try {
    const module = await swc.parse(content, {
      isModule: true,
      filename: this.resourcePath,
      syntax: "typescript",
    });

    const imports = [];

    module.body.forEach((node) => {
      if (node.type === "ImportDeclaration") {
        const source = node.source.value;

        if (!source.startsWith("langchain")) {
          return;
        }

        node.specifiers.forEach((specifier) => {
          if (specifier.type === "ImportSpecifier") {
            const local = specifier.local.value;
            const imported = specifier.imported?.value ?? local;
            imports.push({ local, imported, source });
          } else {
            throw new Error("Unsupported import type");
          }
        });
      }
    });

    const getDocsPath = (componentPath) =>
      path.resolve(__dirname, "..", "api_refs", "public", componentPath);

    /**
     * Somewhat of a hacky solution to finding the exact path of the docs file.
     * Maps over all categories in the API docs and if the file exists, returns the path.
     * @param {string} moduleName
     * @param {string} imported
     * @returns {string | undefined}
     */
    const findExactPath = (moduleName, imported) => {
      let modulePath;
      CATEGORIES.forEach((category) => {
        const componentPath = `${category}/${moduleName}.${imported}.html`;
        const docsPath = getDocsPath(componentPath);
        // The modules from `langchain-core` are named differently in the API docs.
        const componentPathWithSchema = `${category}/schema_${moduleName.slice(
          0,
          -1
        )}.${imported}.html`;
        const newDocsPath = getDocsPath(componentPathWithSchema);
        if (fs.existsSync(docsPath)) {
          modulePath = componentPath;
        } else if (fs.existsSync(newDocsPath)) {
          modulePath = componentPathWithSchema;
        }
      });
      return modulePath;
    };

    imports.forEach((imp) => {
      const { imported, source } = imp;
      const moduleName = source.split("/").slice(1).join("_");
      const exactPath = findExactPath(moduleName, imported);
      if (exactPath) {
        imp.docs = BASE_URL + "/" + exactPath;
      } else {
        throw new Error(
          `Could not find docs for ${moduleName}.${imported} or schema_${moduleName}.${imported} in api_refs/public/`
        );
      }
    });

    cb(null, JSON.stringify({ content, imports }), map, meta);
  } catch (err) {
    cb(err);
  }
}

module.exports = webpackLoader;
