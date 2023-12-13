const {
  Application,
  Converter,
  Context,
  ReflectionKind,
  DeclarationReflection,
} = require("typedoc");

/**
 * @param {Application} application 
 * @returns {void}
 */
function load(application) {
  /**
   * @type {Array<DeclarationReflection>}
   */
  let reflectionsToHide = [];
  
  application.converter.on(
    Converter.EVENT_CREATE_DECLARATION,
    resolveReflection
  );
  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, onBeginResolve);

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
  }
}

module.exports = { load };
