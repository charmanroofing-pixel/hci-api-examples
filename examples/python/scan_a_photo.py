"""Identify a card from a photo and print the match, alternatives and slab label.

    HCI_API_KEY=hci_live_... python scan_a_photo.py ./card.jpg [category]

Commercial plans only (Lite, Growth Lite, Growth, Platform, or the free setup month).
"""

import os
import sys

from hobbycardindex import HobbyCardIndex, HobbyCardIndexError


def main() -> int:
    api_key = os.environ.get("HCI_API_KEY")
    if not api_key or len(sys.argv) < 2:
        print("Usage: HCI_API_KEY=hci_live_... python scan_a_photo.py ./card.jpg [category]", file=sys.stderr)
        return 1
    path = sys.argv[1]
    category = sys.argv[2] if len(sys.argv) > 2 else None
    hci = HobbyCardIndex(api_key, timeout=60.0)

    try:
        scan = hci.scan_card(path, category=category)  # JPEG, PNG or WebP, under 10 MB

        match = scan.get("match")
        if match:
            pct = round((match.get("confidence") or 0) * 100)
            print(f"Match: {match['name']} ({match.get('year')} {match.get('setName')}, {match.get('parallel')}) "
                  f"id {match['id']}, confidence {pct}%")
            prices = match.get("prices") or {}
            if prices:
                print(f"  Raw ${prices.get('loose', 'n/a')}  PSA 10 ${prices.get('psa10', 'n/a')}  PSA 9 ${prices.get('psa9', 'n/a')}")
        else:
            print("No confident match. Show the alternatives and let the user pick.")

        alternatives = scan.get("alternatives") or []
        if alternatives:
            print(f"\n{len(alternatives)} alternative(s):")
            for alt in alternatives:
                conf = alt.get("confidence")
                suffix = f", {round(conf * 100)}%" if conf is not None else ""
                print(f"  {alt['name']} ({alt.get('year')} {alt.get('setName')}, {alt.get('parallel')}) id {alt['id']}{suffix}")

        slab = scan.get("slab")
        if slab:
            cert = f", cert {slab['certNumber']}" if slab.get("certNumber") else ""
            verified = " (verified)" if slab.get("certVerified") else ""
            print(f"\nGraded: {slab.get('grader')} {slab.get('grade')}{cert}{verified}")
            if slab.get("priceAtGrade") is not None:
                print(f"  Price at this grade: ${slab['priceAtGrade']}")
            if slab.get("verifyUrl"):
                print(f"  {slab['verifyUrl']}")

        usage = (scan.get("usage") or {}).get("scans") or {}
        print(f"\nEngine: {scan.get('engine')}. Scans used this month: {usage.get('used', '?')} of {usage.get('allowance', '?')}.")
        return 0
    except HobbyCardIndexError as err:
        # 400 NO_IMAGE / INVALID_IMAGE, 413 IMAGE_TOO_LARGE, 403 REQUIRES_PARTNER_PLAN,
        # 429 SCAN_ENGINE_BUSY (wait err.retry_after seconds), 503 SCAN_ENGINE_UNAVAILABLE.
        print(f"{err.code} ({err.status}): {err.message}", file=sys.stderr)
        if err.retry_after is not None:
            print(f"Retry after {err.retry_after} s", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
