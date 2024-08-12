const {
  Application,
  Converter,
  Context,
  ReflectionKind,
  DeclarationReflection,
  RendererEvent,
  UrlMapping,
  Reflection,
} = require("typedoc");
const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const { Project, ClassDeclaration } = require("ts-morph");

// Chat model methods which _should_ be included in the documentation
const WHITELISTED_CHAT_MODEL_INHERITED_METHODS = [
  "invoke",
  "stream",
  "batch",
  "streamLog",
  "streamEvents",
  "bind",
  "bindTools",
  "asTool",
  "pipe",
  "withConfig",
  "withRetry",
  "assign",
  "getNumTokens",
  "getGraph",
  "pick",
  "withFallbacks",
  "withStructuredOutput",
  "withListeners",
  "transform",
];

// Reflection types to check for methods that should not be documented.
// e.g methods prefixed with `_` or `lc_`
const REFLECTION_KINDS_TO_HIDE = [
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

const BASE_OUTPUT_DIR = "./public";

// Script to inject into the HTML to add a CMD/CTRL + K 'hotkey' which focuses
// on the search input element.
const SCRIPT_HTML = `<script>
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.keyCode === 75) { // Check for CMD + K or CTRL + K
      const input = document.getElementById('tsd-search-field'); // Get the search input element by ID
      input.focus(); // Focus on the search input element
      document.getElementById('tsd-search').style.display = 'block'; // Show the div wrapper with ID tsd-search
    }
  }, false); // Add event listener for keydown events
</script>`;

// Injected into each page's HTML to add a dropdown to switch between versions.
const VERSION_DROPDOWN_HTML = `<div class="version-select">
<select id="version-dropdown" onchange="window.location.href=this.value;">
  <option selected value="">v0.2</option>
  <option value="https://v01.api.js.langchain.com/">v0.1</option>
</select>
</div>`;

/**
 * HTML injected into sections where there is a `@deprecated` JSDoc tag.
 * This provides a far more visible warning to the user that the feature is
 * deprecated.
 *
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
 * Uses ts-morph to check if the class is a subclass of `BaseChatModel` or
 * `SimpleChatModel`.
 *
 * @param {ClassDeclaration} classDeclaration
 * @returns {boolean}
 */
function isBaseChatModelOrSimpleChatModel(classDeclaration) {
  let currentClass = classDeclaration;
  while (currentClass) {
    const baseClassName = currentClass.getBaseClass()?.getName();
    if (
      baseClassName === "BaseChatModel" ||
      baseClassName === "SimpleChatModel"
    ) {
      return true;
    }
    currentClass = currentClass.getBaseClass();
  }
  return false;
}

/**
 * Uses ts-morph to load all chat model files, and extract the names of the
 * classes. This is then used to remove unwanted properties from showing up
 * in the documentation of those classes.
 *
 * @returns {Array<string>}
 */
function getAllChatModelNames() {
  const communityChatModelPath =
    "../../libs/langchain-community/src/chat_models/*";
  const communityChatModelNestedPath =
    "../../libs/langchain-community/src/chat_models/**/*";
  const partnerPackageGlob =
    "../../libs/!(langchain-community)/**/chat_models.ts";
  const partnerPackageFiles = glob.globSync(partnerPackageGlob);

  const tsMorphProject = new Project();
  const sourceFiles = tsMorphProject.addSourceFilesAtPaths([
    communityChatModelPath,
    communityChatModelNestedPath,
    ...partnerPackageFiles,
  ]);

  const chatModelNames = [];
  for (const sourceFile of sourceFiles) {
    const exportedClasses = sourceFile.getClasses();
    for (const exportedClass of exportedClasses) {
      if (isBaseChatModelOrSimpleChatModel(exportedClass)) {
        chatModelNames.push(exportedClass.getName());
      }
    }
  }
  return chatModelNames.flatMap((n) => (n ? [n] : []));
}

/**
 * Takes in a reflection and an array of all chat model class names.
 * Then performs checks to see if the given reflection should be removed
 * from the documentation.
 * E.g a class method on chat models which is
 * not intended to be documented.
 *
 * @param {DeclarationReflection} reflection
 * @param {Array<string>} chatModelNames
 * @returns {boolean} Whether or not the reflection should be removed
 */
function shouldRemoveReflection(reflection, chatModelNames) {
  const kind = reflection.kind;

  if (
    reflection.parent &&
    chatModelNames.find((name) => name === reflection.parent.name) &&
    reflection.name !== "constructor"
  ) {
    if (kind === ReflectionKind.Property) {
      return true;
    }
    if (
      !WHITELISTED_CHAT_MODEL_INHERITED_METHODS.find(
        (n) => n === reflection.name
      )
    ) {
      return true;
    }
    if (kind === ReflectionKind.Accessor && reflection.name === "callKeys") {
      return true;
    }
  }

  if (REFLECTION_KINDS_TO_HIDE.find((kindToHide) => kindToHide === kind)) {
    if (reflection.name.startsWith("_") || reflection.name.startsWith("lc_")) {
      // Remove all reflections which start with an `_` or `lc_`
      return true;
    }
  }
}

/**
 * @param {Application} application
 * @returns {void}
 */
function load(application) {
  let allChatModelNames = [];
  try {
    allChatModelNames = getAllChatModelNames();
  } catch (err) {
    console.error("Error while getting all chat model names");
    throw err;
  }

  application.converter.on(
    Converter.EVENT_CREATE_DECLARATION,
    resolveReflection
  );

  application.renderer.on(RendererEvent.END, onEndRenderEvent);

  /**
   * @param {Context} context
   * @param {DeclarationReflection} reflection
   * @returns {void}
   */
  function resolveReflection(context, reflection) {
    const { project } = context;

    if (shouldRemoveReflection(reflection, allChatModelNames)) {
      project.removeReflection(reflection);
    }
  }

  /**
   * @param {Context} context
   */
  function onEndRenderEvent(context) {
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
