export const videoUrl = (name: string) => `/videos/minuspod-${name}-landscape.mp4`;

export function formatLength(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}
