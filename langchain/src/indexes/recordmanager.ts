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
  createSchema(): Promise<void>;
  getTime(): Promise<number>;
  update(keys: string[], updateOptions: UpdateOptions): Promise<void>;
  exists(keys: string[]): Promise<boolean[]>;
  listKeys(options: ListKeyOptions): Promise<string[]>;
  deleteKeys(keys: string[]): Promise<void>;
}
