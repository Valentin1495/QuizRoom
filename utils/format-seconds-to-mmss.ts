// Helper to format seconds as mm:ss
export function formatSecondsToMMSS(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  if (min > 0) {
    return `${min}분 ${sec}초`;
  }
  return `${sec}초`;
}
