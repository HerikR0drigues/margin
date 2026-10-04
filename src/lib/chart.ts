// Helpers de escala e desenho dos gráficos SVG.

/** Passo "redondo" para o eixo Y, com no máximo 5 divisões. */
export function niceStep(max: number): number {
  const steps = [100, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 250000, 500000, 1000000]
  for (const s of steps) if (max / s <= 5) return s
  return 1000000
}

export function yTicks(max: number): { ticks: number[]; ymax: number } {
  const step = niceStep(max)
  const ymax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= ymax + 1e-9; v += step) ticks.push(v)
  return { ticks, ymax }
}

/** Retângulo com os cantos de cima arredondados e a base reta. */
export function topRoundedPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h, w / 2))
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}
