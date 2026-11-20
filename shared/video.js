// Builds a player for a clicked poster and starts it; mount puts it in the page.
export function playInPlace(mount, { src, poster, title, img }) {
  const video = document.createElement('video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'none';
  video.poster = poster;
  // keep the poster's box while the player loads
  if (img?.naturalWidth) video.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  // iOS never loads a preload=none video built from <source> children; set src directly
  video.src = src;
  video.setAttribute('aria-label', title);
  mount(video);
  video.focus();
  video.play().catch((err) => console.warn('video play failed', err));
}
