const {
  Application,
  Converter,
  Context,
  ReflectionKind,
  DeclarationReflection,
  RendererEvent,
} = require("typedoc");
const fs = require("fs");
const path = require("path");

const PATH_TO_LANGCHAIN_PKG_JSON = "../../langchain/package.json";
const BASE_OUTPUT_DIR = "./public";
const SCRIPT_HTML = `<script>
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.keyCode === 75) { // Check for CMD + K or CTRL + K
      const input = document.getElementById('tsd-search-field'); // Get the search input element by ID
      input.focus(); // Focus on the search input element
      document.getElementById('tsd-search').style.display = 'block'; // Show the div wrapper with ID tsd-search
    }
  }, false); // Add event listener for keydown events
</script>`;
const VERSION_DROPDOWN_HTML = `<div class="version-select">
<select id="version-dropdown" onchange="window.location.href=this.value;">
  <option selected value="">v0.2</option>
  <option value="https://v01.api.js.langchain.com/">v0.1</option>
</select>
</div>`;

/**
 * @param {string | undefined} deprecationText
 * @returns {string}
 */
const DEPRECATION_HTML = (deprecationText) => `<div class="deprecation-warning">
<h2>⚠️ Deprecated ⚠️</h2>
${deprecationText ? `<p>${deprecationText}</p>` : ""}
<p>This feature is deprecated and will be removed in the future.</p>
<p>It is not recommended for use.</p>
</div>`;

/**
 * @param {Application} application
 * @returns {void}
 */
function load(application) {
  /**
   * @type {string}
   */
  let langchainVersion;
  try {
    const langChainPackageJson = fs
      .readFileSync(PATH_TO_LANGCHAIN_PKG_JSON)
      .toString();
    langchainVersion = JSON.parse(langChainPackageJson).version;
  } catch (e) {
    throw new Error(`Error reading LangChain version for typedoc: ${e}`);
  }

  /**
   * @type {Array<DeclarationReflection>}
   */
  let reflectionsToHide = [];

  application.converter.on(
    Converter.EVENT_CREATE_DECLARATION,
    resolveReflection
  );
  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, onBeginResolve);

  application.renderer.on(RendererEvent.BEGIN, onBeginRenderEvent);

  application.renderer.on(RendererEvent.END, onEndRenderEvent);

  const reflectionKindsToHide = [
    ReflectionKind.Property,
    ReflectionKind.Accessor,
    ReflectionKind.Variable,
    ReflectionKind.Method,
    ReflectionKind.Function,
    ReflectionKind.Class,
    ReflectionKind.Interface,
    ReflectionKind.Enum,
    ReflectionKind.TypeAlias,
  ];

  /**
   * @param {Context} context
   * @returns {void}
   */
  function onBeginRenderEvent(context) {
    const { project } = context;
    if (project && langchainVersion) {
      project.packageVersion = langchainVersion;
    }
  }

  /**
   * @param {Context} context
   * @returns {void}
   */
  function onBeginResolve(context) {
    reflectionsToHide.forEach((reflection) => {
      const { project } = context;
      // Remove the property from documentation
      project.removeReflection(reflection);
    });
  }

  /**
   * @param {Context} _context
   * @param {DeclarationReflection} reflection
   * @returns {void}
   */
  function resolveReflection(_context, reflection) {
    const reflectionKind = reflection.kind;
    if (reflectionKindsToHide.includes(reflectionKind)) {
      if (
        reflection.name.startsWith("_") ||
        reflection.name.startsWith("lc_")
      ) {
        reflectionsToHide.push(reflection);
      }
    }
    if (reflection.name.includes("/src")) {
      reflection.name = reflection.name.replace("/src", "");
    }
    if (reflection.name.startsWith("libs/")) {
      reflection.name = reflection.name.replace("libs/", "");
    }
  }

  /**
   * @param {Context} context
   */
  async function onEndRenderEvent(context) {
    const htmlToSplitAtSearchScript = `<div class="tsd-toolbar-contents container">`;
    const htmlToSplitAtVersionDropdown = `<div id="tsd-toolbar-links">`;
    const deprecatedHTML = "<h4>Deprecated</h4>";

    const { urls } = context;
    for (const { url } of urls) {
      const indexFilePath = path.join(BASE_OUTPUT_DIR, url);
      let htmlFileContent = fs.readFileSync(indexFilePath, "utf-8");

      if (htmlFileContent.includes(deprecatedHTML)) {
        // If any comments are added to the `@deprecated` JSDoc, they'll
        // be inside the following <p> tag.
        const deprecationTextRegex = new RegExp(
          `${deprecatedHTML}<p>(.*?)</p>`
        );
        const deprecationTextMatch =
          htmlFileContent.match(deprecationTextRegex);

        /** @type {string | undefined} */
        let textInsidePTag;

        if (deprecationTextMatch) {
          textInsidePTag = deprecationTextMatch[1];
          const newTextToReplace = `${deprecatedHTML}<p>${textInsidePTag}</p>`;
          htmlFileContent = htmlFileContent.replace(
            newTextToReplace,
            DEPRECATION_HTML(textInsidePTag)
          );
        } else {
          htmlFileContent = htmlFileContent.replace(
            deprecatedHTML,
            DEPRECATION_HTML(undefined)
          );
        }
      }

      const [part1, part2] = htmlFileContent.split(htmlToSplitAtSearchScript);
      const htmlWithScript = part1 + SCRIPT_HTML + part2;
      const htmlWithDropdown = htmlWithScript.replace(
        htmlToSplitAtVersionDropdown,
        htmlToSplitAtVersionDropdown + VERSION_DROPDOWN_HTML
      );
      fs.writeFileSync(indexFilePath, htmlWithDropdown);
    }
  }
}

module.exports = { load };
