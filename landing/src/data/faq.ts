import { DOCS_SITE } from '../../../shared/social.mjs';

// Answers restate the MinusPod README and docs; `more` links the page with the detail.
export const faq = [
  {
    q: 'What is MinusPod?',
    a: 'MinusPod is a self-hosted server that removes ads from podcasts and YouTube shows. You give it an RSS feed, playlist or channel, and it serves a new feed with the ads cut out.',
    more: { label: 'How it works', href: `${DOCS_SITE}/how-it-works/` },
  },
  {
    q: 'Which podcast apps does it work with?',
    a: 'Any podcast app that can subscribe to a feed by URL. MinusPod serves a standard RSS feed for each show, and you add that URL to your app.',
    more: { label: 'Feeds and usage', href: `${DOCS_SITE}/feeds-and-usage/` },
  },
  {
    q: 'Do I need a GPU?',
    a: 'No. An NVIDIA GPU speeds up local transcription, but the CPU image runs on amd64 and arm64 hosts without one. Transcription can also go to a remote API.',
    more: { label: 'Installation', href: `${DOCS_SITE}/installation/` },
  },
  {
    q: 'Do I need an LLM or an API key?',
    a: 'No. With the provider set to None, MinusPod finds ads with audio cues, fingerprints, text patterns, the cross-fetch differential and SponsorBlock. A fresh install without an LLM finds little on a regular podcast feed until you mark ads.',
    more: { label: 'Running without an LLM', href: `${DOCS_SITE}/llm-providers/#running-without-an-llm` },
  },
  {
    q: 'Which LLM providers can I use?',
    a: 'Anthropic, OpenRouter, Ollama, System One, or any OpenAI-compatible endpoint. You can switch providers while the server runs and set a different model for each stage.',
    more: { label: 'LLM providers', href: `${DOCS_SITE}/llm-providers/` },
  },
  {
    q: 'Does it work with YouTube?',
    a: 'Yes. MinusPod turns a YouTube playlist or channel into a podcast feed. The audio comes through yt-dlp and community SponsorBlock marks decide the cuts. The feature is off by default.',
    more: { label: 'YouTube feeds', href: `${DOCS_SITE}/youtube-feeds/` },
  },
  {
    q: 'What does it cost?',
    a: 'MinusPod is free and MIT licensed. You pay your LLM provider if you choose a paid one. Local transcription and a local Ollama model run on your own hardware.',
    more: { label: 'LLM pricing', href: `${DOCS_SITE}/llm-providers/#llm-pricing` },
  },
  {
    q: 'Can I try it before installing?',
    a: 'Yes. The hosted demo is a read-only copy of the web UI that runs on recorded data.',
    more: { label: 'Open the demo', href: 'https://demo.minuspod.app/' },
  },
];
