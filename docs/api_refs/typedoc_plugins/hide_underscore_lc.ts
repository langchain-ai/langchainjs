import {
  Application,
  Converter,
  Context,
  ReflectionKind,
  DeclarationReflection,
} from "typedoc";

export function load(application: Application): void {
  let reflections: Array<DeclarationReflection> = [];
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

  function onBeginResolve(context: Context) {
    reflections.forEach((reflection) => {
      const { project } = context;
      console.log("deleting", reflection.name);
      // Remove the property from documentation
      project.removeReflection(reflection);
    });
  }

  function resolveReflection(
    context: Context,
    reflection: DeclarationReflection
  ) {
    const reflectionKind = reflection.kind;
    // if (reflection.kindOf(ReflectionKind.Property)) {
    if (reflectionKindsToHide.includes(reflectionKind)) {
      if (
        reflection.name.startsWith("_") ||
        reflection.name.startsWith("lc_")
      ) {
        reflections.push(reflection);
        console.log("found lc or underscore", reflection.name);
      }
    }
  }
}
