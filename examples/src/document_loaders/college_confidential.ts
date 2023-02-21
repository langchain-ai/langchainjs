import { CollegeConfidentialLoader } from "langchain/document_loaders";

export const run = async () => {
  const loader = new CollegeConfidentialLoader(
    "https://www.collegeconfidential.com/colleges/brown-university/"
  );
  const docs = await loader.load();
  console.log({ docs });
};
