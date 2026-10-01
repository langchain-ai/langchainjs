import type { ModelProfile } from "@langchain/core/language_models/profile";

/**
 * The static profile now reports `fileMimeTypes` for every model by default,
 * so this strips it back out when not applicable. `pdfInputs` stands in for
 * `input_file` support, since PDFs go through the same input.
 */
export function withoutFileMimeTypesUnlessSupported(
  profile: ModelProfile,
  usesResponsesApi: boolean
): ModelProfile {
  if (usesResponsesApi && profile.pdfInputs) return profile;
  const { fileMimeTypes: _fileMimeTypes, ...rest } = profile;
  return rest;
}
