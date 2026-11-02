// Identify a card from a photo and print the match, alternatives and slab label.
//   HCI_API_KEY=hci_live_... node scan-a-photo.mjs ./card.jpg [category]
// Commercial plans only (Lite, Growth Lite, Growth, Platform, or the free setup month).
import { readFile } from 'node:fs/promises';
import { HobbyCardIndex, HobbyCardIndexError } from 'hobbycardindex';

const [file, category] = process.argv.slice(2);
if (!process.env.HCI_API_KEY || !file) {
  console.error('Usage: HCI_API_KEY=hci_live_... node scan-a-photo.mjs ./card.jpg [category]');
  process.exit(1);
}

const hci = new HobbyCardIndex({ apiKey: process.env.HCI_API_KEY, timeoutMs: 60000 });
const photo = await readFile(file); // JPEG, PNG or WebP, under 10 MB
const mimeType = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg';

try {
  const scan = await hci.scanCard(photo, { mimeType, category });

  if (scan.match) {
    const m = scan.match;
    console.log(`Match: ${m.name} (${m.year} ${m.setName}, ${m.parallel}) id ${m.id}, confidence ${(m.confidence * 100).toFixed(0)}%`);
    if (m.prices) console.log(`  Raw $${m.prices.loose ?? 'n/a'}  PSA 10 $${m.prices.psa10 ?? 'n/a'}  PSA 9 $${m.prices.psa9 ?? 'n/a'}`);
  } else {
    console.log('No confident match. Show the alternatives and let the user pick.');
  }

  if (scan.alternatives.length) {
    console.log(`\n${scan.alternatives.length} alternative(s):`);
    for (const a of scan.alternatives) {
      console.log(`  ${a.name} (${a.year} ${a.setName}, ${a.parallel}) id ${a.id}${a.confidence != null ? `, ${(a.confidence * 100).toFixed(0)}%` : ''}`);
    }
  }

  if (scan.slab) {
    const s = scan.slab;
    console.log(`\nGraded: ${s.grader} ${s.grade}${s.certNumber ? `, cert ${s.certNumber}` : ''}${s.certVerified ? ' (verified)' : ''}`);
    if (s.priceAtGrade != null) console.log(`  Price at this grade: $${s.priceAtGrade}`);
    if (s.verifyUrl) console.log(`  ${s.verifyUrl}`);
  }

  console.log(`\nEngine: ${scan.engine}. Scans used this month: ${scan.usage.scans.used ?? '?'} of ${scan.usage.scans.allowance}.`);
} catch (err) {
  if (err instanceof HobbyCardIndexError) {
    // 400 NO_IMAGE / INVALID_IMAGE, 413 IMAGE_TOO_LARGE, 403 REQUIRES_PARTNER_PLAN,
    // 429 SCAN_ENGINE_BUSY (wait err.retryAfter seconds), 503 SCAN_ENGINE_UNAVAILABLE.
    console.error(`${err.code} (${err.status}): ${err.message}`);
    if (err.retryAfter != null) console.error(`Retry after ${err.retryAfter} s`);
    process.exit(2);
  }
  throw err;
}
