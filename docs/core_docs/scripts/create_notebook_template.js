const path = require("path");
const fs = require("fs");

const TEMPLATE_NOTEBOOK = {
  cells: [
    {
      cell_type: "code",
      execution_count: 1,
      metadata: {
        tags: [
          "remove-cell"
        ]
      },
      outputs: [
        {
          data: {
            "text/plain": [
              "[Module: null prototype] {  }"
            ]
          },
          execution_count: 1,
          metadata: {},
          output_type: "execute_result"
        }
      ],
      source: []
    }
  ],
  metadata: {
    kernelspec: {
      display_name: "Deno",
      language: "typescript",
      name: "deno"
    },
    language_info: {
      file_extension: ".ts",
      mimetype: "text/x.typescript",
      name: "typescript",
      nb_converter: "script",
      pygments_lexer: "typescript",
      version: "5.3.3"
    }
  },
  nbformat: 4,
  nbformat_minor: 2
};

const NOTEBOOK_INIT_UTILS_FILE = "notebook_init_utils.js";

/**
 * @param {string} invokedFromDirectory
 * @returns {string} The path to the notebook utils file from script invocation CWD.
 */
function getPathToNotebookInitUtils(invokedFromDirectory) {
  // Split the path by the directory separator and filter out empty strings
  const pathParts = invokedFromDirectory.split(path.sep).filter(Boolean);
  // Find the index of "core_docs" in the path
  const coreDocsIndex = pathParts.indexOf("core_docs");
  // If "core_docs" is not found, or it is the last part, the path is invalid
  if (coreDocsIndex === -1 || coreDocsIndex === pathParts.length - 1) {
    throw new Error('"core_docs" must be part of the path and not the last element.');
  }
  // Calculate how many levels up we need to go from the current directory
  const levelsUp = pathParts.length - coreDocsIndex - 1; // -1 to account for "core_docs"
  // Create an array with a ".." for each level we need to go up
  const relativePathParts = new Array(levelsUp).fill('..');
  // Add the "scripts" and the filename to the relative path
  relativePathParts.push('scripts', NOTEBOOK_INIT_UTILS_FILE);
  // Join the parts with the directory separator to form the relative path
  return relativePathParts.join(path.sep);
}

/**
 * Generate a notebook file inside the directory the script
 * was invoked from. Automatically write the .ipynb file with 
 * a default cell importing a util that allows for certain 
 * native node processes to be used, eg `process.env.<ENV_VAR>`
 */
function main() {
  // Get the current working directory from where the script was invoked
  const invokedFromDirectory = process.argv[2] || process.cwd();
  // Get the file name argument
  let fileName = process.argv[3] ?? "new_notebook";
  fileName = fileName.endsWith(".ipynb") ? fileName : `${fileName}.ipynb`;
  if (fileName.includes(path.sep) || fileName.includes(" ")) {
    throw new Error("Invalid file name passed:" + fileName);
  }
  const pathToNotebookInitUtils = getPathToNotebookInitUtils(invokedFromDirectory);
  const cellSourceContents = ["// Auto-generated, ignore.\n", `import "${pathToNotebookInitUtils}"`];
  TEMPLATE_NOTEBOOK.cells[0].source = cellSourceContents; // Set the source on the first cell
  const pathToNewNotebook = path.join(invokedFromDirectory, fileName);
  fs.writeFileSync(pathToNewNotebook, JSON.stringify(TEMPLATE_NOTEBOOK, null, 2))
}

main();
