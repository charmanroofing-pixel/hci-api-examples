"""A small client for the HobbyCardIndex Data API. Standard library only (urllib).

Docs: https://hobbycardindex.com/developers   Keys: same page (free setup month by application).
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import socket
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Sequence, Union
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://hobbycardindex.com/api/v1"

#: The credit the Terms ask for wherever the data is shown.
CREDIT_HTML = '<a href="https://hobbycardindex.com">Prices from Hobby Card Index</a>'

JsonDict = Dict[str, Any]
ImageInput = Union[str, bytes, bytearray, "os.PathLike[str]"]


class HobbyCardIndexError(Exception):
    """Raised for every non-2xx answer, a timeout, or a network failure."""

    def __init__(self, status: int, code: str, message: str, details: Any = None,
                 retry_after: Optional[float] = None, body: Any = None) -> None:
        super().__init__(message)
        self.status = status            # HTTP status, 0 for a timeout or network failure
        self.code = code                # the API's error code, for example RATE_LIMITED
        self.message = message
        self.details = details          # the API's error.details when it sent any
        self.retry_after = retry_after  # seconds to wait, from the Retry-After header (429, 503)
        self.body = body                # the raw error body

    def __str__(self) -> str:
        return f"{self.code} ({self.status}): {self.message}"


def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    """Seconds from a Retry-After header (a number or an HTTP date), or None."""
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    try:
        when = parsedate_to_datetime(value)
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return max(0.0, (when - datetime.now(timezone.utc)).total_seconds())
    except (TypeError, ValueError):
        return None


def _clean(params: Optional[JsonDict]) -> JsonDict:
    """Drop None and empty values; booleans become true/false."""
    out: JsonDict = {}
    for key, value in (params or {}).items():
        if value is None or value == "":
            continue
        out[key] = "true" if value is True else "false" if value is False else value
    return out


def _image_to_base64(image: ImageInput) -> "tuple[str, Optional[str]]":
    """Base64 for POST /scan from a file path, bytes, or a base64 string. Returns (b64, guessed mime)."""
    if isinstance(image, (bytes, bytearray)):
        return base64.b64encode(bytes(image)).decode("ascii"), None
    path = os.fspath(image) if not isinstance(image, str) else image
    if os.path.isfile(path):
        with open(path, "rb") as handle:
            data = handle.read()
        return base64.b64encode(data).decode("ascii"), mimetypes.guess_type(path)[0]
    if isinstance(image, str):
        return image, None  # already base64 (a data: prefix is fine)
    raise TypeError("image must be a file path, bytes, or a base64 string")


class HobbyCardIndex:
    """HobbyCardIndex Data API client.

    Every method returns the ``data`` part of the API's ``{"success": true, "data": ...}``
    envelope (the text for CSV answers). Non-2xx answers raise :class:`HobbyCardIndexError`.
    """

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL, timeout: float = 30.0,
                 user_agent: str = "hobbycardindex-python/0.1.0") -> None:
        if not api_key or not isinstance(api_key, str):
            raise TypeError("api_key is required (it starts with hci_live_)")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.user_agent = user_agent
        #: The attribution from the most recent response: the body's attribution object plus the X-Attribution header.
        self.last_attribution: Optional[JsonDict] = None

    # ------------------------------------------------------------------ transport

    def request(self, method: str, path: str, query: Optional[JsonDict] = None,
                body: Optional[JsonDict] = None, raw: bool = False) -> Any:
        """One HTTP call. Returns data (or text), or the raw bytes when ``raw`` is True."""
        url = self.base_url + path
        params = _clean(query)
        if params:
            url += "?" + urlencode(params)
        headers = {"X-API-Key": self.api_key, "Accept": "*/*" if raw else "application/json",
                   "User-Agent": self.user_agent}
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode("utf-8")
        req = Request(url, data=payload, headers=headers, method=method)
        try:
            with urlopen(req, timeout=self.timeout) as res:
                content = res.read()
                header_credit = res.headers.get("X-Attribution")
        except HTTPError as err:
            raise self._to_error(err) from None
        except socket.timeout:
            raise HobbyCardIndexError(0, "TIMEOUT", f"Request timed out after {self.timeout} s") from None
        except URLError as err:
            reason = getattr(err, "reason", err)
            if isinstance(reason, socket.timeout):
                raise HobbyCardIndexError(0, "TIMEOUT", f"Request timed out after {self.timeout} s") from None
            raise HobbyCardIndexError(0, "NETWORK_ERROR", str(reason)) from None
        if raw:
            if header_credit:
                self.last_attribution = {"header": header_credit}
            return content
        text = content.decode("utf-8") if content else ""
        try:
            parsed = json.loads(text) if text else None
        except ValueError:
            return text  # a CSV or other non-JSON body
        body_credit = None
        if isinstance(parsed, dict):
            body_credit = parsed.get("attribution")
            data = parsed.get("data")
            if body_credit is None and isinstance(data, dict):
                body_credit = data.get("attribution")
        if body_credit or header_credit:
            credit = dict(body_credit) if isinstance(body_credit, dict) else {}
            credit["header"] = header_credit
            self.last_attribution = credit
        if isinstance(parsed, dict) and parsed.get("success") is True and "data" in parsed:
            return parsed["data"]
        return parsed

    @staticmethod
    def _to_error(err: HTTPError) -> HobbyCardIndexError:
        """Map an HTTPError to HobbyCardIndexError using the API's error envelope."""
        try:
            text = err.read().decode("utf-8", "replace")
        except Exception:  # pragma: no cover - a body that cannot be read
            text = ""
        body: Any = None
        try:
            body = json.loads(text) if text else None
        except ValueError:
            body = None
        error = body.get("error") if isinstance(body, dict) and isinstance(body.get("error"), dict) else {}
        headers = err.headers if err.headers is not None else {}
        message = error.get("message") or (text[:200] if text and body is None else None) or str(err.reason) or f"HTTP {err.code}"
        return HobbyCardIndexError(
            status=err.code,
            code=error.get("code") or f"HTTP_{err.code}",
            message=message,
            details=error.get("details"),
            retry_after=_parse_retry_after(headers.get("Retry-After")),
            body=body if body is not None else (text or None),
        )

    # ------------------------------------------------------------------ catalog and prices (every plan)

    def search_cards(self, q: Optional[str] = None, *, category: Optional[str] = None, set_id: Optional[str] = None,
                     language: Optional[str] = None, year: Optional[int] = None, added_since: Optional[str] = None,
                     min_price: Optional[float] = None, max_price: Optional[float] = None, sort: Optional[str] = None,
                     limit: Optional[int] = None, offset: Optional[int] = None) -> JsonDict:
        """GET /prices/search: a plain q search, or filters (category + set_id lists a whole set)."""
        return self.request("GET", "/prices/search", query={
            "q": q, "category": category, "set": set_id, "language": language, "year": year,
            "added_since": added_since, "min_price": min_price, "max_price": max_price,
            "sort": sort, "limit": limit, "offset": offset,
        })

    def list_sets(self, category: str, *, language: Optional[str] = None, q: Optional[str] = None,
                  limit: Optional[int] = None, offset: Optional[int] = None) -> JsonDict:
        """GET /sets?category=...: the sets in a category with the ids search and the watch list take."""
        return self.request("GET", "/sets", query={"category": category, "language": language, "q": q,
                                                   "limit": limit, "offset": offset})

    def get_prices(self, card_id: Union[int, str]) -> JsonDict:
        """GET /prices/:cardId: the card and its prices at every grade. card_id is the id from search or scan, or ext-<externalId>."""
        return self.request("GET", f"/prices/{quote(str(card_id), safe='')}")

    def get_card(self, card_id: Union[int, str]) -> JsonDict:
        """Same endpoint as get_prices."""
        return self.get_prices(card_id)

    def get_sales(self, card_id: Union[int, str], *, days: Optional[int] = None) -> JsonDict:
        """GET /prices/:cardId/sales?days=90: verified sold sales, newest first, with a summary. Commercial plans."""
        return self.request("GET", f"/prices/{quote(str(card_id), safe='')}/sales", query={"days": days})

    def get_price_history(self, card_id: Union[int, str], *, days: Optional[int] = None) -> JsonDict:
        """GET /prices/:cardId/history?days=365: the daily price at every grade. Commercial plans."""
        return self.request("GET", f"/prices/{quote(str(card_id), safe='')}/history", query={"days": days})

    def get_population(self, card_id: Union[int, str]) -> JsonDict:
        """GET /prices/:cardId/population: graded counts by grader. Platform, or the pop + cert add-on."""
        return self.request("GET", f"/prices/{quote(str(card_id), safe='')}/population")

    def get_listings(self, card_id: Union[int, str], *, limit: Optional[int] = None, grade: Optional[str] = None,
                     min_feedback_percent: Optional[float] = None, min_feedback_score: Optional[int] = None) -> JsonDict:
        """GET /prices/:cardId/listings: active listings for one card. Enabled per account."""
        return self.request("GET", f"/prices/{quote(str(card_id), safe='')}/listings", query={
            "limit": limit, "grade": grade, "minFeedbackPercent": min_feedback_percent, "minFeedbackScore": min_feedback_score,
        })

    def lookup_cert(self, grader: str, cert_number: Union[int, str]) -> JsonDict:
        """GET /certs/:grader/:certNumber: a PSA, BGS, CGC or SGC cert as the card, grade and price at that grade."""
        return self.request("GET", f"/certs/{quote(grader.lower(), safe='')}/{quote(str(cert_number), safe='')}")

    def scan_card(self, path_or_bytes: ImageInput, *, category: Optional[str] = None,
                  mime_type: Optional[str] = None, slab: Optional[bool] = None) -> JsonDict:
        """POST /scan: identify a card from a photo (a file path, bytes, or base64). JPEG, PNG or WebP under 10 MB."""
        image, guessed = _image_to_base64(path_or_bytes)
        body: JsonDict = {"image": image}
        if mime_type or guessed:
            body["mimeType"] = mime_type or guessed
        if category:
            body["category"] = category
        if isinstance(slab, bool):
            body["slab"] = slab
        return self.request("POST", "/scan", body=body)

    # ------------------------------------------------------------------ market and account

    def get_market_movers(self, *, category: Optional[str] = None, period: Optional[int] = None) -> JsonDict:
        """GET /market/movers?category=baseball&period=7: the biggest risers and fallers in a category."""
        return self.request("GET", "/market/movers", query={"category": category, "period": period})

    def get_categories(self) -> JsonDict:
        """GET /market/categories: every category with card counts and average prices."""
        return self.request("GET", "/market/categories")

    def get_usage(self) -> JsonDict:
        """GET /usage: this key's plan, limits and month-to-date usage."""
        return self.request("GET", "/usage")

    def get_collection(self) -> JsonDict:
        """GET /collection: the account's own collection."""
        return self.request("GET", "/collection")

    def export_collection_csv(self, *, category: Optional[str] = None) -> str:
        """GET /export/csv?category=: the account's collection as CSV text."""
        return self.request("GET", "/export/csv", query={"category": category})

    # ------------------------------------------------------------------ bulk price files (Platform, or the price files add-on)

    def list_bulk_files(self) -> JsonDict:
        """GET /bulk/prices: the categories available as daily files and when each was built."""
        return self.request("GET", "/bulk/prices")

    def download_bulk_file(self, category: str, *, part: Optional[int] = None, gzip: bool = False) -> bytes:
        """GET /bulk/prices/:category?part=1[&format=gz]: the whole file as bytes (CSV, or gzip when gzip=True)."""
        return self.request("GET", f"/bulk/prices/{quote(category, safe='')}",
                            query={"part": part, "format": "gz" if gzip else None}, raw=True)

    # ------------------------------------------------------------------ watch list and daily price webhook (commercial plans)

    def get_watchlist(self, *, limit: Optional[int] = None, offset: Optional[int] = None) -> JsonDict:
        """GET /watchlist?limit=&offset=: the watched cards and the sets being followed."""
        return self.request("GET", "/watchlist", query={"limit": limit, "offset": offset})

    def add_to_watchlist(self, *, card_ids: Optional[Sequence[Union[int, str]]] = None, category: Optional[str] = None,
                         set_id: Optional[str] = None, language: Optional[str] = None) -> JsonDict:
        """POST /watchlist: card_ids (up to 1,000 a call), or category + set_id for a whole set, or category alone."""
        return self.request("POST", "/watchlist", body=_clean({
            "cardIds": list(card_ids) if card_ids is not None else None,
            "category": category, "set": set_id, "language": language,
        }))

    def remove_from_watchlist(self, *, card_ids: Optional[Sequence[Union[int, str]]] = None, category: Optional[str] = None,
                              set_id: Optional[str] = None, language: Optional[str] = None, remove_all: bool = False) -> JsonDict:
        """POST /watchlist/remove: card_ids, a followed set (category + set_id), or remove_all=True to clear the list."""
        body = _clean({"cardIds": list(card_ids) if card_ids is not None else None,
                       "category": category, "set": set_id, "language": language})
        if remove_all:
            body["all"] = True
        return self.request("POST", "/watchlist/remove", body=body)

    def get_watchlist_prices(self, *, csv: bool = False) -> Union[JsonDict, str]:
        """GET /watchlist/prices: current prices for every watched card (JSON, or CSV text). One download a minute."""
        return self.request("GET", "/watchlist/prices", query={"format": "csv" if csv else None})

    def get_webhook(self) -> JsonDict:
        """GET /webhook: the endpoint, its hour (UTC) and last delivery."""
        return self.request("GET", "/webhook")

    def set_webhook(self, url: str, *, hour: Optional[int] = None, rotate_secret: bool = False) -> JsonDict:
        """PUT /webhook: set the daily price webhook. The signing secret is returned once."""
        body: JsonDict = {"url": url}
        if hour is not None:
            body["hour"] = hour
        if rotate_secret:
            body["rotateSecret"] = True
        return self.request("PUT", "/webhook", body=body)

    def delete_webhook(self) -> JsonDict:
        """DELETE /webhook: stop deliveries (the watch list stays)."""
        return self.request("DELETE", "/webhook")

    def test_webhook(self) -> JsonDict:
        """POST /webhook/test: send a signed ping to the endpoint now."""
        return self.request("POST", "/webhook/test", body={})
