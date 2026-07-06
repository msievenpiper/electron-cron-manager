export const JOB_COLOR_HEXES = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#fb923c']

export function jobColor(index: number): string {
  return JOB_COLOR_HEXES[index % JOB_COLOR_HEXES.length]
}
