import type { ModelProfile } from "@langchain/core/language_models/profile";

/**
 * Narrows the static profile, which describes the Responses API, to what the
 * API a model calls can send.
 *
 * - `fileMimeTypes` is reported for every model by default, so it is stripped
 *   back out when not applicable. `pdfInputs` stands in for `input_file`
 *   support, since PDFs go through the same input.
 * - `midConversationTools` is turned off on Chat Completions, since only the
 *   Responses API carries an `additional_tools` input item.
 */
export function profileForApi(
  profile: ModelProfile,
  usesResponsesApi: boolean
): ModelProfile {
  let result = profile;
  if (!usesResponsesApi || !profile.pdfInputs) {
    const { fileMimeTypes: _fileMimeTypes, ...rest } = result;
    result = rest;
  }
  if (!usesResponsesApi && result.midConversationTools) {
    result = { ...result, midConversationTools: false };
  }
  return result;
}
