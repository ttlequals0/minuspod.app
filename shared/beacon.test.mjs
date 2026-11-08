import { describe, it, expect } from 'vitest';
import { beaconToken } from './beacon.mjs';

const token = 'adf25978c956443db71cf1c8768dc438';

describe('beaconToken', () => {
  it('accepts a bare token', () => {
    expect(beaconToken(token)).toBe(token);
    expect(beaconToken(` ${token.toUpperCase()}\n`)).toBe(token);
  });
  it('extracts the token from a pasted snippet', () => {
    const snippet = `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${token}"}'></script><!-- End Cloudflare Web Analytics -->`;
    expect(beaconToken(snippet)).toBe(token);
  });
  it('returns an empty string for nothing usable', () => {
    expect(beaconToken(undefined)).toBe('');
    expect(beaconToken('')).toBe('');
    expect(beaconToken('not-a-token')).toBe('');
  });
});
