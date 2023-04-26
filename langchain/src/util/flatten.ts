// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const flattenObject = (obj: Record<string, any>, deep = true) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flattenedObject: Record<string, any> = {};

  for (const key in obj) {
    if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      let recursiveResult = obj[key];
      if (deep) recursiveResult = flattenObject(recursiveResult);

      for (const deepKey in recursiveResult) {
        if (Object.hasOwn(obj, key))
          flattenedObject[`${key}.${deepKey}`] = recursiveResult[deepKey];
      }
    }
  }

  return flattenedObject;
};
