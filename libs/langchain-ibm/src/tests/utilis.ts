/* eslint-disable @typescript-eslint/no-explicit-any */
import { WatsonxEmbeddings, WatsonxEmbeddingsParams } from "../embeddings.js";
import { WatsonxInputLLM, WatsonxLLM } from "../llms.js";

export function getKey<K>(key: K): K {
  return key;
}
export const testProperties = (
  instance: WatsonxLLM | WatsonxEmbeddings,
  testProps: WatsonxInputLLM,
  notExTestProps?: { [key: string]: any }
) => {
  const checkProperty = <T extends { [key: string]: any }>(
    testProps: T,
    instance: T,
    existing = true
  ) => {
    Object.keys(testProps).forEach((key) => {
      const keys = getKey<keyof T>(key);
      type Type = Pick<T, typeof keys>;

      if (typeof testProps[key as keyof T] === "object")
        checkProperty<Type>(testProps[key as keyof T], instance[key], existing);
      else {
        if (existing)
          expect(instance[key as keyof T]).toBe(testProps[key as keyof T]);
        else if (instance) expect(instance[key as keyof T]).toBeUndefined();
      }
    });
  };
  checkProperty<WatsonxEmbeddingsParams>(testProps, instance);
  if (notExTestProps)
    checkProperty<typeof notExTestProps>(notExTestProps, instance, false);
};
