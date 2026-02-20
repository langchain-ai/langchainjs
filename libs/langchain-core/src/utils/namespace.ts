/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A constructor type that can be used as a base class for branding.
 */
type Constructor = abstract new (...args: any[]) => any;

/**
 * The return type of `Namespace.brand()`: the original base class
 * intersected with a polymorphic `isInstance` type guard.
 */
type BrandedClass<TBase extends Constructor> = TBase & {
  isInstance: IsInstanceFn;
};

/**
 * A static `isInstance` type guard that resolves to the subclass it's
 * called on via the generic `this` parameter.
 *
 * At call sites TypeScript infers `T` from the class, so
 * `StandardError.isInstance(obj)` narrows `obj` to `StandardError`.
 */
type IsInstanceFn = <T extends Constructor>(
  this: T,
  obj: unknown
) => obj is InstanceType<T>;

/**
 * A namespace object for hierarchical symbol-based branding.
 *
 * Namespaces are internal authoring tools. They are not intended to be
 * part of the public API -- only the branded classes are.
 *
 * @example
 * ```typescript
 * const langchain = createNamespace("langchain");
 * const errorNs = langchain.sub("error");
 *
 * export class LangChainError extends errorNs.brand(Error) {
 *   readonly name = "LangChainError";
 * }
 *
 * export class ModelAbortError extends errorNs.brand(LangChainError, "model-abort") {
 *   readonly name = "ModelAbortError";
 * }
 * ```
 */
export interface Namespace {
  /**
   * Brand a base class with this namespace's symbols.
   *
   * Without a marker, creates a namespace-level base class whose
   * `static isInstance` checks for the namespace's own symbol.
   *
   * With a marker, creates a leaf class whose `static isInstance`
   * checks for the marker-specific symbol.
   *
   * @param Base - The base class to extend
   * @param marker - Optional marker for leaf classes
   * @returns A new class extending Base with symbol branding and static isInstance
   */
  brand<TBase extends Constructor>(
    Base: TBase,
    marker?: string
  ): BrandedClass<TBase>;

  /**
   * Create a child namespace.
   *
   * @param childPath - The child segment to append to the current path
   * @returns A new Namespace with the extended path
   */
  sub(childPath: string): Namespace;

  /**
   * Check if an object is branded under this namespace (at any level).
   *
   * @param obj - The object to check
   * @returns true if the object carries this namespace's symbol
   */
  isInstance(obj: unknown): boolean;
}

/**
 * Create a symbol-based namespace for hierarchical `isInstance` checking.
 *
 * Each namespace level gets its own `Symbol.for(path)`. When a class is
 * branded via `.brand()`, only the new symbol for that level is stamped
 * on the prototype. Parent symbols are inherited implicitly through the
 * class extension chain -- `symbol in obj` traverses the prototype chain,
 * so a `ConfigError` instance is recognized by `LangChainError.isInstance()`
 * because it extends `GoogleError` which extends `LangChainError`, whose
 * prototype already carries the `langchain.error` symbol.
 *
 * @param path - The dot-separated namespace path (e.g. "langchain.error")
 * @returns A Namespace object with `.brand()`, `.sub()`, and `.isInstance()`
 *
 * @example
 * ```typescript
 * const langchain = createNamespace("langchain");
 * const errorNs = langchain.sub("error");
 * const googleNs = errorNs.sub("google");
 *
 * class LangChainError extends errorNs.brand(Error) {}
 * class GoogleError extends googleNs.brand(LangChainError) {}
 * class ConfigError extends googleNs.brand(GoogleError, "configuration") {}
 *
 * const err = new ConfigError("bad config");
 * LangChainError.isInstance(err); // true (checks langchain.error symbol)
 * GoogleError.isInstance(err);    // true (checks langchain.error.google symbol)
 * ConfigError.isInstance(err);    // true (checks langchain.error.google.configuration symbol)
 * ```
 */
export function createNamespace(path: string): Namespace {
  const symbol: symbol = Symbol.for(path);

  return {
    brand<TBase extends Constructor>(Base: TBase, marker?: string) {
      const brandSymbol: symbol = marker
        ? Symbol.for(`${path}.${marker}`)
        : symbol;

      class _Branded extends (Base as any) {
        readonly [brandSymbol] = true as const;

        constructor(...args: any[]) {
          super(...args);
        }

        static isInstance(obj: unknown): boolean {
          return (
            typeof obj === "object" &&
            obj !== null &&
            brandSymbol in obj &&
            (obj as Record<symbol, unknown>)[brandSymbol] === true
          );
        }
      }

      // Inherit the base class's name so "_Branded" doesn't leak
      // through the static prototype chain.
      Object.defineProperty(_Branded, "name", { value: Base.name });

      return _Branded as unknown as BrandedClass<TBase>;
    },

    sub(childPath: string): Namespace {
      return createNamespace(`${path}.${childPath}`);
    },

    isInstance(obj: unknown): boolean {
      return (
        typeof obj === "object" &&
        obj !== null &&
        symbol in obj &&
        (obj as Record<symbol, unknown>)[symbol] === true
      );
    },
  };
}

/** Base namespace used throughout LangChain */
export const ns = createNamespace("langchain");
