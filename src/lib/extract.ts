/** Turn a dropped file into plain text for notes. Heavy libs are lazy-loaded. */

export type Progress = (msg: string) => void

export async function extractText(file: File, onProgress: Progress = () => {}): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return extractPdf(file, onProgress)
  if (name.endsWith('.docx')) return extractDocx(file)
  if (file.type.startsWith('image/')) return ocr(file, onProgress)
  if (file.type.startsWith('text/') || /\.(md|txt|csv)$/.test(name)) return file.text()
  throw new Error(`${file.name}: unsupported file type`)
}

async function extractPdf(file: File, onProgress: Progress) {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Reading page ${i}/${pdf.numPages}`)
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let text = content.items.map(it => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('').trim()

    // Scanned page (no text layer) → render it and OCR
    if (text.length < 20) {
      onProgress(`Scanning page ${i}/${pdf.numPages} (OCR)`)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
      text = await ocr(canvas, onProgress)
    }
    pages.push(text)
  }
  return pages.join('\n\n')
}

async function extractDocx(file: File) {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return value
}

async function ocr(image: File | HTMLCanvasElement, onProgress: Progress) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: m => m.status === 'recognizing text' && onProgress(`Reading handwriting/photo… ${Math.round(m.progress * 100)}%`),
  })
  try { return (await worker.recognize(image)).data.text.trim() }
  finally { await worker.terminate() }
}
