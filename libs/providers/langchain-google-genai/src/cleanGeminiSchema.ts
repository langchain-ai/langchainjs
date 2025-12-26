export function cleanGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const cleaned: any = Array.isArray(schema)
    ? schema.map((item) => cleanGeminiSchema(item))
    : { ...schema };


  delete cleaned.propertyNames;
  delete cleaned.patternProperties;

  
  for (const key of Object.keys(cleaned)) {
    if (typeof cleaned[key] === "object") {
      cleaned[key] = cleanGeminiSchema(cleaned[key]);
    }
  }

  return cleaned;
}
