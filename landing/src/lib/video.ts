import videos from '../generated/videos.json';

// getStaticPaths of the watch page and its Markdown twin
export const watchPaths = () => videos.map((video) => ({ params: { name: video.name }, props: { video } }));

export const videoUrl = (name: string) => `/videos/minuspod-${name}-landscape.mp4`;

export const posterUrl = (name: string) => `/videos/${name}-landscape.jpg`;
export const watchPath = (name: string) => `/watch/${name}/`;

export function formatLength(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}
