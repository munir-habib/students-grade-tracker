// Client-side text extraction for syllabus files. Runs entirely in the browser — the extracted
// plain text is what gets sent to the `extract-syllabus` edge function; this module never
// touches the network itself.

import * as mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
// Vite-specific `?url` import: resolves to the built worker script's URL in both dev and prod.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export class SyllabusExtractionError extends Error {}

function hasStr(item: unknown): item is { str: string } {
  return typeof item === 'object' && item !== null && 'str' in item && typeof (item as { str: unknown }).str === 'string'
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  const pageTexts: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => (hasStr(item) ? item.str : '')).join(' ')
    pageTexts.push(pageText)
  }

  return pageTexts.join('\n\n')
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/** Extracts plain text from a .pdf or .docx File. Throws SyllabusExtractionError on failure. */
export async function extractSyllabusText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase()
  const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf'
  const isDocx =
    lowerName.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  try {
    let text: string
    if (isPdf) {
      text = await extractPdfText(file)
    } else if (isDocx) {
      text = await extractDocxText(file)
    } else {
      throw new SyllabusExtractionError('unsupported-file-type')
    }

    if (!text || text.trim().length === 0) {
      throw new SyllabusExtractionError('empty-text')
    }

    return text
  } catch (err) {
    if (err instanceof SyllabusExtractionError) throw err
    throw new SyllabusExtractionError(err instanceof Error ? err.message : 'extraction-failed')
  }
}
