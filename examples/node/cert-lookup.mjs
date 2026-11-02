// Look a graded card up by its cert number: the card, the grade and the price at that grade.
//   HCI_API_KEY=hci_live_... node cert-lookup.mjs psa 12345678
// Commercial plans; each plan has a monthly number of cert lookups, one per second per key.
import { HobbyCardIndex, HobbyCardIndexError } from 'hobbycardindex';

const [grader, certNumber] = process.argv.slice(2);
if (!process.env.HCI_API_KEY || !grader || !certNumber) {
  console.error('Usage: HCI_API_KEY=hci_live_... node cert-lookup.mjs <psa|bgs|cgc|sgc> <certNumber>');
  process.exit(1);
}

const hci = new HobbyCardIndex({ apiKey: process.env.HCI_API_KEY });

try {
  const out = await hci.lookupCert(grader, certNumber);
  const { cert, card, slab } = out;

  console.log(`${String(grader).toUpperCase()} cert ${certNumber}`);
  if (cert) {
    const parts = [cert.year, cert.player, cert.cardNumber ? `#${cert.cardNumber}` : null, cert.grade ? `grade ${cert.grade}` : null].filter(Boolean);
    console.log(`  Grader's record: ${parts.join(' ')}`);
  }
  if (card) {
    console.log(`  Our card: ${card.name} (id ${card.id})${card.hciUrl ? `  ${card.hciUrl}` : ''}`);
    if (card.prices) console.log(`  Raw $${card.prices.loose ?? 'n/a'}  PSA 10 $${card.prices.psa10 ?? 'n/a'}`);
  } else {
    console.log('  No matching card in the catalog yet.');
  }
  if (slab) {
    console.log(`  Price at this grade: ${slab.priceAtGrade != null ? `$${slab.priceAtGrade}` : 'n/a'}${slab.certVerified ? ' (cert verified)' : ''}`);
    if (slab.verifyUrl) console.log(`  Grader page: ${slab.verifyUrl}`);
    if (slab.frontImageUrl) console.log(`  Slab photo: ${slab.frontImageUrl}`);
  }
} catch (err) {
  if (err instanceof HobbyCardIndexError) {
    // 400 for a bad grader or number, 404 when the grader has no record, 403 REQUIRES_GROWTH
    // without a commercial plan, 429 CERT_LIMIT_REACHED or CERT_LOOKUPS_BUSY.
    console.error(`${err.code} (${err.status}): ${err.message}`);
    process.exit(2);
  }
  throw err;
}
