export interface AudioParams {
  file: Blob;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Interface for interacting with an audio file.
 */
export class Audio implements AudioParams {
  file: Blob;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;

  constructor(fields?: Partial<AudioParams>) {
    this.file = fields?.file ?? this.file;
    this.metadata = fields?.metadata ?? {};
  }
}
