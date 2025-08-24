/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document } from "@langchain/core/documents";
import { XMLParser } from "fast-xml-parser";

import { PDFLoader } from "../document_loaders/fs/pdf.js";

// Interface for processed arXiv entry
interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  updated: string;
  authors: string[];
  pdfUrl: string;
  links: any[];
}

// Used to check if the query is an arXiv ID, or a natural language query
export function isArXivIdentifier(query: string): boolean {
  const arxivIdRegex = /^\d{4}\.\d{4,5}(v\d+)?$|^\d{7}(\.\d+)?(v\d+)?$/;
  return arxivIdRegex.test(query.trim());
}

// Used to fetch direct arXiv articles by IDs (supports multiple IDs)
export async function fetchDirectArxivArticle(
  arxivIds: string
): Promise<ArxivEntry[]> {
  try {
    const idList = arxivIds
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean)
      .join(",");
    const url = `http://export.arxiv.org/api/query?id_list=${idList}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const result = parser.parse(xml);
    let entries = result.feed.entry;

    if (!entries) {
      return [];
    }

    // Ensure entries is an array
    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    const processedEntries = entries.map(processEntry);

    return processedEntries;
  } catch {
    throw new Error(`Failed to fetch articles with IDs ${arxivIds}`);
  }
}

// Used to fetch arXiv results by natural language query with maxResults parameter
export async function fetchArxivResultsByQuery(
  query: string,
  start = 0,
  maxResults = 10
): Promise<ArxivEntry[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=${start}&max_results=${maxResults}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const result = parser.parse(xml);
    let entries = result.feed.entry;

    if (!entries) {
      return [];
    }

    // Ensure entries is an array
    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    const processedEntries = entries.map(processEntry);

    return processedEntries;
  } catch {
    throw new Error(`Failed to fetch articles with query "${query}"`);
  }
}

// Used to search for arXiv articles with a maxResults parameter
export async function searchArxiv(
  query: string,
  maxResults = 3
): Promise<ArxivEntry[]> {
  if (isArXivIdentifier(query)) {
    return await fetchDirectArxivArticle(query);
  } else {
    return await fetchArxivResultsByQuery(query, 0, maxResults);
  }
}

// Used to fetch and parse PDF to text
export async function fetchAndParsePDF(pdfUrl: string): Promise<string> {
  try {
    // Fetch the PDF
    const response = await fetch(pdfUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Convert the ArrayBuffer to a Blob
    const blob = new Blob([buffer], { type: "application/pdf" });

    // Use PDFLoader to process the PDF
    const loader = new PDFLoader(blob, { splitPages: false }); // Pass the Blob
    const docs: Document[] = await loader.load();

    // Combine all document content into a single string
    const content = docs.map((doc) => doc.pageContent).join("\n\n");
    return content;
  } catch {
    throw new Error(`Failed to fetch or parse PDF from ${pdfUrl}`);
  }
}

// Used to load raw text from each search result, and convert to Document instances
export async function loadDocsFromResults(
  results: ArxivEntry[]
): Promise<Document[]> {
  const docs: Document[] = [];
  for (const result of results) {
    const pdfUrl = result.pdfUrl;
    try {
      const pdfContent = await fetchAndParsePDF(pdfUrl);
      const metadata = {
        id: result.id,
        title: result.title,
        authors: result.authors,
        published: result.published,
        updated: result.updated,
        source: "arxiv",
        url: result.id,
        summary: result.summary,
      };
      const doc = new Document({
        pageContent: pdfContent,
        metadata,
      });
      docs.push(doc);
    } catch {
      throw new Error(`Error loading document from ${pdfUrl}`);
    }
  }
  return docs;
}

// Used to convert metadata and summaries to Document instances
export function getDocsFromSummaries(results: ArxivEntry[]): Document[] {
  const docs: Document[] = [];
  for (const result of results) {
    const metadata = {
      id: result.id,
      title: result.title,
      authors: result.authors,
      published: result.published,
      updated: result.updated,
      source: "arxiv",
      url: result.id,
    };
    const doc = new Document({
      pageContent: result.summary,
      metadata,
    });
    docs.push(doc);
  }
  return docs;
}

// Helper function to process each arXiv entry
function processEntry(entry: any): ArxivEntry {
  const id = entry.id;
  const title = entry.title.replace(/\s+/g, " ").trim();
  const summary = entry.summary.replace(/\s+/g, " ").trim();
  const published = entry.published;
  const updated = entry.updated;

  // Extract authors
  let authors: string[] = [];
  if (Array.isArray(entry.author)) {
    authors = entry.author.map((author: any) => author.name);
  } else if (entry.author) {
    authors = [entry.author.name];
  }

  // Extract links
  let links: any[] = [];
  if (Array.isArray(entry.link)) {
    links = entry.link;
  } else if (entry.link) {
    links = [entry.link];
  }

  // Extract PDF link
  let pdfUrl = `${id.replace("/abs/", "/pdf/")}.pdf`;
  const pdfLinkObj = links.find((link: any) => link["@_title"] === "pdf");
  if (pdfLinkObj && pdfLinkObj["@_href"]) {
    pdfUrl = pdfLinkObj["@_href"];
  }

  return {
    id,
    title,
    summary,
    published,
    updated,
    authors,
    pdfUrl,
    links,
  };
}
