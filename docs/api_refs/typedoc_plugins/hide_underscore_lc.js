"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = void 0;
var typedoc_1 = require("typedoc");
function load(application) {
    var reflections = [];
    application.converter.on(typedoc_1.Converter.EVENT_CREATE_DECLARATION, resolveReflection);
    application.converter.on(typedoc_1.Converter.EVENT_RESOLVE_BEGIN, onBeginResolve);
    var reflectionKindsToHide = [
        typedoc_1.ReflectionKind.Property,
        typedoc_1.ReflectionKind.Accessor,
        typedoc_1.ReflectionKind.Variable,
        typedoc_1.ReflectionKind.Method,
        typedoc_1.ReflectionKind.Function,
        typedoc_1.ReflectionKind.Class,
        typedoc_1.ReflectionKind.Interface,
        typedoc_1.ReflectionKind.Enum,
        typedoc_1.ReflectionKind.TypeAlias,
    ];
    function onBeginResolve(context) {
        reflections.forEach(function (reflection) {
            var project = context.project;
            console.log("deleting", reflection.name);
            // Remove the property from documentation
            project.removeReflection(reflection);
        });
    }
    function resolveReflection(context, reflection) {
        var reflectionKind = reflection.kind;
        // if (reflection.kindOf(ReflectionKind.Property)) {
        if (reflectionKindsToHide.includes(reflectionKind)) {
            if (reflection.name.startsWith("_") ||
                reflection.name.startsWith("lc_")) {
                reflections.push(reflection);
                console.log("found lc or underscore", reflection.name);
            }
        }
    }
}
exports.load = load;
