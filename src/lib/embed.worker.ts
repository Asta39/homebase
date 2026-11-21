/// <reference lib="webworker" />
// Runs the embedding model off the main thread so the UI never freezes.
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

const MODEL = 'Xenova/all-MiniLM-L6-v2' // ~23 MB, downloaded once then cached by the browser

let extractor: Promise<FeatureExtractionPipeline> | null = null
const load = () => (extractor ??= pipeline('feature-extraction', MODEL, {
  dtype: 'q8',
  progress_callback: (p: { status: string; progress?: number }) => {
    if (p.status === 'progress' && p.progress != null) self.postMessage({ type: 'progress', progress: Math.round(p.progress) })
  },
}) as Promise<FeatureExtractionPipeline>)

self.onmessage = async (e: MessageEvent<{ id: number; texts: string[] }>) => {
  const { id, texts } = e.data
  try {
    const fx = await load()
    const out = await fx(texts, { pooling: 'mean', normalize: true })
    const dim = out.dims[1]
    const data = out.data as Float32Array
    const vecs = texts.map((_, i) => data.slice(i * dim, (i + 1) * dim))
    self.postMessage({ type: 'result', id, vecs }, { transfer: vecs.map(v => v.buffer) })
  } catch (err) {
    self.postMessage({ type: 'error', id, error: (err as Error).message })
  }
}
