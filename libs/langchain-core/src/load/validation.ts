/**
 * Sentinel key used to mark escaped user objects during serialization.
 *
 * When a plain object contains 'lc' key (which could be confused with LC objects),
 * we wrap it as `{"__lc_escaped__": {...original...}}`.
 */
export const LC_ESCAPED_KEY = "__lc_escaped__";

/**
 * Check if an object needs escaping to prevent confusion with LC objects.
 *
 * An object needs escaping if:
 * 1. It has an `'lc'` key (could be confused with LC serialization format)
 * 2. It has only the escape key (would be mistaken for an escaped object)
 */
export function needsEscaping(obj: Record<string, unknown>): boolean {
  return (
    "lc" in obj || (Object.keys(obj).length === 1 && LC_ESCAPED_KEY in obj)
  );
}

/**
 * Wrap an object in the escape marker.
 *
 * @example
 * ```typescript
 * {"key": "value"}  // becomes {"__lc_escaped__": {"key": "value"}}
 * ```
 */
export function escapeObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  return { [LC_ESCAPED_KEY]: obj };
}

/**
 * Check if an object is an escaped user object.
 *
 * @example
 * ```typescript
 * {"__lc_escaped__": {...}}  // is an escaped object
 * ```
 */
export function isEscapedObject(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 1 && LC_ESCAPED_KEY in obj;
}

/**
 * Interface for objects that can be serialized.
 * This is a duck-typed interface to avoid circular imports.
 */
interface SerializableLike {
  lc_serializable: boolean;
  lc_secrets?: Record<string, string>;
  toJSON(): {
    lc: number;
    type: string;
    id: string[];
    kwargs?: Record<string, unknown>;
  };
}

/**
 * Check if an object looks like a Serializable instance (duck typing).
 */
function isSerializableLike(obj: unknown): obj is SerializableLike {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "lc_serializable" in obj &&
    typeof (obj as SerializableLike).toJSON === "function"
  );
}

/**
 * Create a "not_implemented" serialization result for objects that cannot be serialized.
 */
function createNotImplemented(obj: unknown): {
  lc: 1;
  type: "not_implemented";
  id: string[];
} {
  let id: string[];
  if (obj !== null && typeof obj === "object") {
    if ("lc_id" in obj && Array.isArray(obj.lc_id)) {
      id = obj.lc_id as string[];
    } else {
      id = [obj.constructor?.name ?? "Object"];
    }
  } else {
    id = [typeof obj];
  }
  return {
    lc: 1,
    type: "not_implemented",
    id,
  };
}

/**
 * Serialize a value with escaping of user objects.
 *
 * Called recursively on kwarg values to escape any plain objects that could be
 * confused with LC objects.
 *
 * @param obj - The value to serialize.
 * @param pathSet - WeakSet to track ancestor objects in the current path to detect circular references.
 *                  Objects are removed after processing to allow shared references (same object in
 *                  multiple places) while still detecting true circular references (ancestor in descendant).
 * @returns The serialized value with user objects escaped as needed.
 */
export function serializeValue(
  obj: unknown,
  pathSet: WeakSet<object> = new WeakSet()
): unknown {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    // Check for circular reference - only if this object is an ancestor in the current path
    if (pathSet.has(obj)) {
      return createNotImplemented(obj);
    }

    if (isSerializableLike(obj)) {
      // This is an LC object - serialize it properly (not escaped)
      return serializeLcObject(obj, pathSet);
    }

    // Add to path before processing children
    pathSet.add(obj);

    const record = obj as Record<string, unknown>;
    // Check if object needs escaping BEFORE recursing into values.
    // If it needs escaping, wrap it as-is - the contents are user data that
    // will be returned as-is during deserialization (no instantiation).
    // This prevents re-escaping of already-escaped nested content.
    if (needsEscaping(record)) {
      // Remove from path before returning (to allow shared references)
      pathSet.delete(obj);
      return escapeObject(record);
    }
    // Safe object (no 'lc' key) - recurse into values
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = serializeValue(value, pathSet);
    }
    // Remove from path after processing (to allow shared references in other branches)
    pathSet.delete(obj);
    return result;
  }

  if (Array.isArray(obj)) {
    // Arrays don't need circular reference tracking since they're handled by object tracking
    return obj.map((item) => serializeValue(item, pathSet));
  }

  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean" ||
    obj === null
  ) {
    return obj;
  }

  // Non-JSON-serializable object (Date, custom objects, etc.)
  return createNotImplemented(obj);
}

/**
 * Serialize a `Serializable` object with escaping of user data in kwargs.
 *
 * @param obj - The `Serializable` object to serialize.
 * @param pathSet - WeakSet to track ancestor objects in the current path to detect circular references.
 *                  The Serializable object is kept in the path set to detect if it appears in its own kwargs.
 * @returns The serialized object with user data in kwargs escaped as needed.
 *
 * @remarks
 * Kwargs values are processed with `serializeValue` to escape user data (like
 * metadata) that contains `'lc'` keys. Secret fields (from `lc_secrets`) are
 * skipped because `toJSON()` replaces their values with secret markers.
 */
export function serializeLcObject(
  obj: SerializableLike,
  pathSet: WeakSet<object> = new WeakSet()
): {
  lc: number;
  type: string;
  id: string[];
  kwargs?: Record<string, unknown>;
} {
  // Add object to path set to detect if it appears in its own kwargs (circular reference)
  // Note: We intentionally don't remove this after processing because a Serializable
  // appearing in its own kwargs is always a circular reference that should be detected.
  pathSet.add(obj);

  // Secret fields are handled by toJSON() - it replaces values with secret markers
  const secretFields = new Set(Object.keys(obj.lc_secrets ?? {}));

  const serialized = { ...obj.toJSON() };

  // Process kwargs to escape user data that could be confused with LC objects
  // Skip secret fields - toJSON() already converted them to secret markers
  if (serialized.type === "constructor" && serialized.kwargs) {
    const newKwargs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(serialized.kwargs)) {
      if (secretFields.has(key)) {
        newKwargs[key] = value;
      } else {
        newKwargs[key] = serializeValue(value, pathSet);
      }
    }
    serialized.kwargs = newKwargs;
  }

  return serialized;
}

/**
 * Escape a value if it needs escaping (contains `lc` key).
 *
 * This is a simpler version of `serializeValue` that doesn't handle Serializable
 * objects - it's meant to be called on kwargs values that have already been
 * processed by `toJSON()`.
 *
 * @param value - The value to potentially escape.
 * @param pathSet - WeakSet to track ancestor objects in the current path to detect circular references.
 *                  Objects are removed after processing to allow shared references (same object in
 *                  multiple places) while still detecting true circular references (ancestor in descendant).
 * @returns The value with any `lc`-containing objects wrapped in escape markers.
 */
export function escapeIfNeeded(
  value: unknown,
  pathSet: WeakSet<object> = new WeakSet()
): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    // Check for circular reference - only if this object is an ancestor in the current path
    if (pathSet.has(value)) {
      // Replace circular reference with a not_implemented marker
      return createNotImplemented(value);
    }

    // Preserve Serializable objects - they have their own toJSON() that will be
    // called by JSON.stringify. We don't want to convert them to plain objects.
    if (isSerializableLike(value)) {
      return value;
    }

    // Add to path before processing children
    pathSet.add(value);

    const record = value as Record<string, unknown>;
    // Check if object needs escaping BEFORE recursing into values.
    // If it needs escaping, wrap it as-is - the contents are user data that
    // will be returned as-is during deserialization (no instantiation).
    if (needsEscaping(record)) {
      // Remove from path before returning (to allow shared references)
      pathSet.delete(value);
      return escapeObject(record);
    }
    // Safe object (no 'lc' key) - recurse into values
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      result[key] = escapeIfNeeded(val, pathSet);
    }
    // Remove from path after processing (to allow shared references in other branches)
    pathSet.delete(value);
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((item) => escapeIfNeeded(item, pathSet));
  }

  return value;
}

/**
 * Unescape a value, processing escape markers in object values and arrays.
 *
 * When an escaped object is encountered (`{"__lc_escaped__": ...}`), it's
 * unwrapped and the contents are returned AS-IS (no further processing).
 * The contents represent user data that should not be modified.
 *
 * For regular objects and arrays, we recurse to find any nested escape markers.
 *
 * @param obj - The value to unescape.
 * @returns The unescaped value.
 */
export function unescapeValue(obj: unknown): unknown {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    if (isEscapedObject(record)) {
      // Unwrap and return the user data as-is (no further unescaping).
      // The contents are user data that may contain more escape keys,
      // but those are part of the user's actual data.
      return record[LC_ESCAPED_KEY];
    }

    // Regular object - recurse into values to find nested escape markers
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = unescapeValue(value);
    }
    return result;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => unescapeValue(item));
  }

  return obj;
}
