"""Search for a card and print its prices at every grade.

    HCI_API_KEY=hci_live_... python price_lookup.py 2011 Topps Update Mike Trout US175
"""

import os
import sys

from hobbycardindex import CREDIT_HTML, HobbyCardIndex, HobbyCardIndexError

GRADES = [("Raw", "loose"), ("PSA 10", "psa10"), ("PSA 9", "psa9"), ("PSA 8", "psa8"), ("PSA 7", "psa7"),
          ("BGS 9.5", "bgs10"), ("CGC 10", "cgc10"), ("SGC 10", "sgc10")]


def main() -> int:
    api_key = os.environ.get("HCI_API_KEY")
    if not api_key:
        print("Set HCI_API_KEY first (keys: https://hobbycardindex.com/developers)", file=sys.stderr)
        return 1
    query = " ".join(sys.argv[1:]) or "2011 Topps Update Mike Trout US175"
    hci = HobbyCardIndex(api_key)

    try:
        results = hci.search_cards(query)["results"]
        if not results:
            print(f'No cards matched "{query}". Try the year, set, player and card number.')
            return 0
        first = results[0]
        print(f"Top match: {first['name']} ({first['year']} {first['setName']}) id {first['id']}")
        if len(results) > 1:
            print(f"{len(results) - 1} more match(es); the first is used below.")

        out = hci.get_prices(first["id"])
        card, prices = out["card"], out["prices"]
        print(f"\n{card['name']}  {card.get('hciUrl', '')}")
        if not prices:
            print("No price on file for this card yet.")
        else:
            for label, key in GRADES:
                value = prices.get(key)
                print(f"{label:<8} {'n/a' if value is None else f'${value:,.2f}'}")
            if prices.get("updated"):
                print(f"Updated {prices['updated']}")

        # The Terms ask for this credit wherever the prices are shown.
        credit = (hci.last_attribution or {}).get("text") or "Prices from Hobby Card Index"
        print(f"\nCredit to show: {credit}  {CREDIT_HTML}")
        return 0
    except HobbyCardIndexError as err:
        print(f"{err.code} ({err.status}): {err.message}", file=sys.stderr)
        if err.retry_after is not None:
            print(f"Retry after {err.retry_after} s", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
