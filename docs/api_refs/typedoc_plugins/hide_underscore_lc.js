const {
  Application,
  Converter,
  Context,
  ReflectionKind,
  DeclarationReflection,
  RendererEvent,
} = require("typedoc");
const { readFileSync } = require("fs");

const PATH_TO_LANGCHAIN_PKG_JSON = "../../langchain/package.json"

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
    const langChainPackageJson = readFileSync(PATH_TO_LANGCHAIN_PKG_JSON).toString();
    langchainVersion = JSON.parse(langChainPackageJson).version;
  } catch (e) {
    throw new Error(`Error assigning version to typedoc: ${e}`)
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
  function resolveReflection(
    _context,
    reflection
  ) {
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
      reflection.name = reflection.name.replace("/src", "")
    }
    if (reflection.name.startsWith("libs/")) {
      reflection.name = reflection.name.replace("libs/", "")
    }
  }
}

module.exports = { load };
