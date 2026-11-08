// The landing origin and the social card image both sites share: the landing's demo video poster.
export const LANDING_SITE = 'https://minuspod.app';
export const SOCIAL_IMAGE_PATH = '/videos/demo-landscape.jpg';
export const SOCIAL_IMAGE_URL = new URL(SOCIAL_IMAGE_PATH, LANDING_SITE).href;
export const SOCIAL_IMAGE_ALT = 'The MinusPod web UI showing an episode with its ad segments marked';
// prepare-landing writes videos.json; the poster exists only when the demo video does
export const hasSocialImage = (videos) => videos.some((v) => v.name === 'demo');
