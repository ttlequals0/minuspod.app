// Cloudflare Web Analytics gives a whole <script> snippet; the sites only need the 32-hex token inside it.
export function beaconToken(value) {
  const m = /[0-9a-f]{32}/i.exec(value || '');
  return m ? m[0].toLowerCase() : '';
}
