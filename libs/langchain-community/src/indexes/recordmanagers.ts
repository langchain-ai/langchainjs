import { Serializable } from "../load/serializable.js";

export const UUID_NAMESPACE = "00000000-0000-0000-0000-0000000007c0";

export type UpdateOptions = {
  groupIds?: (string | null)[];
  timeAtLeast?: number;
};

export type ListKeyOptions = {
  before?: number;
  after?: number;
  groupIds?: (string | null)[];
  limit?: number;
};

export interface RecordManagerInterface {
  _recordManagerType(): string;
  createSchema(): Promise<void>;
  getTime(): Promise<number>;
  update(keys: string[], updateOptions: UpdateOptions): Promise<void>;
  exists(keys: string[]): Promise<boolean[]>;
  listKeys(options: ListKeyOptions): Promise<string[]>;
  deleteKeys(keys: string[]): Promise<void>;
  end(): Promise<void>;
}

export abstract class RecordManager
  extends Serializable
  implements RecordManagerInterface
{
  lc_namespace = ["langchain", "recordmanagers", this._recordManagerType()];

  abstract _recordManagerType(): string;

  abstract createSchema(): Promise<void>;

  abstract getTime(): Promise<number>;

  abstract update(keys: string[], updateOptions?: UpdateOptions): Promise<void>;

  abstract exists(keys: string[]): Promise<boolean[]>;

  abstract listKeys(options?: ListKeyOptions): Promise<string[]>;

  abstract deleteKeys(keys: string[]): Promise<void>;

  abstract end(): Promise<void>;
}
