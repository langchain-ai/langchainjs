---
---

# Examples

함수의 입력값(input)과 예상되는 출력(output)값으로 이루어진 쌍(Pair)은 모델을 학습시키거나 평가하는데 사용될 수 있습니다.

```typescript
type Example = Record<string, string>;
```

## Creating an Example

입/출력 쌍에 대한 예시를 아래와 같은 방식으로 만들 수 있습니다.

```typescript
const example = {
  input: "foo",
  output: "bar",
};
```
