# PDF files

예제에서는 PDF 파일에서 데이터를 로드하는 방법에 대해 설명합니다. 기본적으로 PDF 파일의 각 페이지에 대해 하나의 Documents가 생성되며, 이 동작을 변경하려면 `splitPages` 옵션을 `false`로 설정하면 됩니다.

## 설정

```bash npm2yarn
npm install pdf-parse
```

## 페이지당 하나의 Documents 생성

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf");

const docs = await loader.load();
```

## 파일당 하나의 Documents 생성

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  splitPages: false,
});

const docs = await loader.load();
```

## 사용자 정의 `pdfjs`를 이용하여 빌드하기

기본적으로 `pdf-parse`와 함께 번들로 제공되는 `pdfjs` 빌드를 사용하는데, 이는 Node.js 및 최신 브라우저를 포함한 대부분의 환경과 호환됩니다. 더 최신 버전의 `pdfjs-dist`를 사용하거나 사용자 정의 빌드를 사용하려는 경우, `PDFJS` 객체로 리졸브하는 프로미스를 반환하는 사용자 정의 `pdfjs` 함수를 제공하여 사용할 수 있습니다.

In the following example we use the "legacy" (see [pdfjs docs](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#which-browsersenvironments-are-supported)) build of `pdfjs-dist`, which includes several polyfills not included in the default build.

다음 예제에서는 기본 빌드에 포함되지 않은 몇 가지 폴리필이 포함된 `pdfjs-dist`의 "레거시"([pdfjs docs](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#which-browsersenvironments-are-supported)) 빌드를 사용합니다.

```bash npm2yarn
npm install pdfjs-dist
```

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  // 필요 시 import 끝에 `.then(m => m.default)`를 추가해야 할 수 있습니다.
  pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"),
});
```
