// Search for a card and print its prices at every grade.
//   HCI_API_KEY=hci_live_... node price-lookup.mjs 2011 Topps Update Mike Trout US175
import { HobbyCardIndex, HobbyCardIndexError, CREDIT_HTML } from 'hobbycardindex';

const apiKey = process.env.HCI_API_KEY;
if (!apiKey) {
  console.error('Set HCI_API_KEY first (keys: https://hobbycardindex.com/developers)');
  process.exit(1);
}

const query = process.argv.slice(2).join(' ') || '2011 Topps Update Mike Trout US175';
const hci = new HobbyCardIndex({ apiKey });

try {
  const { results } = await hci.searchCards(query);
  if (!results.length) {
    console.log(`No cards matched "${query}". Try the year, set, player and card number.`);
    process.exit(0);
  }
  const first = results[0];
  console.log(`Top match: ${first.name} (${first.year} ${first.setName}) id ${first.id}`);
  if (results.length > 1) console.log(`${results.length - 1} more match(es); the first is used below.`);

  const { card, prices } = await hci.getPrices(first.id);
  console.log(`\n${card.name}  ${card.hciUrl}`);
  if (!prices) {
    console.log('No price on file for this card yet.');
  } else {
    const grades = [['Raw', 'loose'], ['PSA 10', 'psa10'], ['PSA 9', 'psa9'], ['PSA 8', 'psa8'], ['PSA 7', 'psa7'],
      ['BGS 9.5', 'bgs10'], ['CGC 10', 'cgc10'], ['SGC 10', 'sgc10']];
    for (const [label, key] of grades) {
      const v = prices[key];
      console.log(`${label.padEnd(8)} ${v == null ? 'n/a' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}`);
    }
    if (prices.updated) console.log(`Updated ${prices.updated}`);
  }

  // The Terms ask for this credit wherever the prices are shown.
  console.log(`\nCredit to show: ${hci.lastAttribution?.text || 'Prices from Hobby Card Index'}  ${CREDIT_HTML}`);
} catch (err) {
  if (err instanceof HobbyCardIndexError) {
    console.error(`${err.code} (${err.status}): ${err.message}`);
    if (err.retryAfter != null) console.error(`Retry after ${err.retryAfter} s`);
    process.exit(2);
  }
  throw err;
}
