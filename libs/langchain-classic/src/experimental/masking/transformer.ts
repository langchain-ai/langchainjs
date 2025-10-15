/**
 * Abstract class representing a transformer used for masking and rehydrating messages.
 */
export abstract class MaskingTransformer {
  abstract transform(
    message: string,
    state?: Map<string, string>
  ): Promise<[string, Map<string, string>]>;

  abstract rehydrate(
    message: string,
    state: Map<string, string>
  ): Promise<string>;
}
