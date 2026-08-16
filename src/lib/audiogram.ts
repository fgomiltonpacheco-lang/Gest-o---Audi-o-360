import { AudiogramMap } from '@/types'

/**
 * Média Tritonal = (500Hz + 1000Hz + 2000Hz) / 3.
 * Retorna null se nenhuma das três frequências tiver valor.
 */
export function mediaTritonal(map: AudiogramMap): number | null {
  const freqs = ['500', '1000', '2000']
  const vals = freqs
    .map((f) => map[f]?.db)
    .filter((v): v is number => v !== null && v !== undefined)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/**
 * Média Quadritonal = (500Hz + 1000Hz + 2000Hz + 4000Hz) / 4.
 * Retorna null se nenhuma das quatro frequências tiver valor.
 */
export function mediaQuadritonal(map: AudiogramMap): number | null {
  const freqs = ['500', '1000', '2000', '4000']
  const vals = freqs
    .map((f) => map[f]?.db)
    .filter((v): v is number => v !== null && v !== undefined)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}
