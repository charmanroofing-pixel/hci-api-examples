"""Unit tests with a patched urlopen. No network.

Run from the repo root:  py -3 -m unittest discover -s sdk/python/tests
"""

import base64
import io
import json
import os
import sys
import tempfile
import unittest
from email.message import Message
from unittest import mock
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from hobbycardindex import CREDIT_HTML, HobbyCardIndex, HobbyCardIndexError  # noqa: E402

KEY = "hci_live_test_key_0000"


class FakeResponse:
    """What urlopen yields inside a with-block: read(), status, headers."""

    def __init__(self, body, status=200, headers=None):
        self._body = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
        self.status = status
        self.headers = Message()
        for key, value in (headers or {}).items():
            self.headers[key] = value

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def http_error(status, body, headers=None):
    hdrs = Message()
    for key, value in (headers or {}).items():
        hdrs[key] = value
    payload = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
    return HTTPError("https://hobbycardindex.com/api/v1/x", status, "error", hdrs, io.BytesIO(payload))


class ClientTests(unittest.TestCase):
    def setUp(self):
        self.client = HobbyCardIndex(KEY)

    def test_api_key_required(self):
        with self.assertRaises(TypeError):
            HobbyCardIndex("")

    def test_header_url_and_data_unwrap(self):
        body = {"success": True, "data": {"results": [{"id": 12345, "name": "Mike Trout #US175"}], "count": 1}}
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
            out = self.client.search_cards("Mike Trout 2011", category="baseball", limit=5, min_price=10)
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["results"][0]["id"], 12345)
        req = opener.call_args[0][0]
        self.assertEqual(req.get_method(), "GET")
        self.assertEqual(req.get_header("X-api-key"), KEY)
        parsed = urlparse(req.full_url)
        self.assertEqual(parsed.scheme + "://" + parsed.netloc + parsed.path, "https://hobbycardindex.com/api/v1/prices/search")
        qs = parse_qs(parsed.query)
        self.assertEqual(qs["q"], ["Mike Trout 2011"])
        self.assertEqual(qs["category"], ["baseball"])
        self.assertEqual(qs["limit"], ["5"])
        self.assertEqual(qs["min_price"], ["10"])
        self.assertEqual(opener.call_args[1]["timeout"], 30.0)

    def test_error_envelope_mapping(self):
        err = http_error(403, {"success": False, "error": {
            "code": "REQUIRES_COMMERCIAL_LICENSE",
            "message": "Individual sold-sale records need a Commercial plan.",
            "details": {"plans_url": "https://hobbycardindex.com/developers"},
        }})
        with mock.patch("hobbycardindex.client.urlopen", side_effect=err):
            with self.assertRaises(HobbyCardIndexError) as ctx:
                self.client.get_sales(12345, days=30)
        e = ctx.exception
        self.assertEqual(e.status, 403)
        self.assertEqual(e.code, "REQUIRES_COMMERCIAL_LICENSE")
        self.assertIn("Commercial plan", e.message)
        self.assertEqual(e.details["plans_url"], "https://hobbycardindex.com/developers")
        self.assertIsNone(e.retry_after)
        self.assertIn("REQUIRES_COMMERCIAL_LICENSE (403)", str(e))

    def test_rate_limit_retry_after(self):
        err = http_error(429, {"error": {"code": "RATE_LIMITED", "message": "Rate limit: 1 request per second per key."}},
                         headers={"Retry-After": "7"})
        with mock.patch("hobbycardindex.client.urlopen", side_effect=err):
            with self.assertRaises(HobbyCardIndexError) as ctx:
                self.client.get_usage()
        self.assertEqual(ctx.exception.status, 429)
        self.assertEqual(ctx.exception.code, "RATE_LIMITED")
        self.assertEqual(ctx.exception.retry_after, 7.0)

    def test_not_found(self):
        err = http_error(404, {"success": False, "error": {"code": "NOT_FOUND", "message": "Card not found"}})
        with mock.patch("hobbycardindex.client.urlopen", side_effect=err):
            with self.assertRaises(HobbyCardIndexError) as ctx:
                self.client.get_prices("999999999")
        self.assertEqual(ctx.exception.code, "NOT_FOUND")

    def test_attribution_from_body_and_header(self):
        attribution = {"text": "Prices from Hobby Card Index", "url": "https://hobbycardindex.com"}
        body = {"success": True, "data": {"card": {"id": 1}, "prices": {"loose": 12.5}}, "attribution": attribution}
        header = "Prices from Hobby Card Index <https://hobbycardindex.com>"
        self.assertIsNone(self.client.last_attribution)
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body, headers={"X-Attribution": header})):
            out = self.client.get_prices(1)
        self.assertEqual(out["prices"]["loose"], 12.5)
        self.assertEqual(self.client.last_attribution["text"], attribution["text"])
        self.assertEqual(self.client.last_attribution["url"], attribution["url"])
        self.assertEqual(self.client.last_attribution["header"], header)
        self.assertIn('href="https://hobbycardindex.com"', CREDIT_HTML)

    def test_attribution_inside_data(self):
        body = {"success": True, "data": {"results": [], "count": 0, "attribution": {"text": "Prices from Hobby Card Index"}}}
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)):
            self.client.search_cards("Charizard")
        self.assertEqual(self.client.last_attribution["text"], "Prices from Hobby Card Index")
        self.assertIsNone(self.client.last_attribution["header"])

    def test_scan_card_from_path_and_bytes(self):
        body = {"success": True, "data": {"match": None, "alternatives": [], "engine": "image", "slab": None}}
        photo = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "card.png")
            with open(path, "wb") as handle:
                handle.write(photo)
            with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
                out = self.client.scan_card(path, category="pokemon", slab=False)
        self.assertEqual(out["engine"], "image")
        req = opener.call_args[0][0]
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.full_url, "https://hobbycardindex.com/api/v1/scan")
        self.assertEqual(req.get_header("Content-type"), "application/json")
        sent = json.loads(req.data.decode("utf-8"))
        self.assertEqual(sent["image"], base64.b64encode(photo).decode("ascii"))
        self.assertEqual(sent["mimeType"], "image/png")
        self.assertEqual(sent["category"], "pokemon")
        self.assertIs(sent["slab"], False)

        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
            self.client.scan_card(photo, mime_type="image/jpeg")
        sent = json.loads(opener.call_args[0][0].data.decode("utf-8"))
        self.assertEqual(sent["image"], base64.b64encode(photo).decode("ascii"))
        self.assertEqual(sent["mimeType"], "image/jpeg")

        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
            self.client.scan_card("data:image/png;base64,iVBORw0KGgo=")
        sent = json.loads(opener.call_args[0][0].data.decode("utf-8"))
        self.assertEqual(sent["image"], "data:image/png;base64,iVBORw0KGgo=")

    def test_csv_returns_text(self):
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(b"id,name\n1,Card\n")) as opener:
            csv = self.client.get_watchlist_prices(csv=True)
        self.assertEqual(csv, "id,name\n1,Card\n")
        self.assertIn("format=csv", opener.call_args[0][0].full_url)

    def test_bulk_download_returns_bytes(self):
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(b"\x1f\x8b\x08")) as opener:
            data = self.client.download_bulk_file("baseball", part=2, gzip=True)
        self.assertEqual(data, b"\x1f\x8b\x08")
        qs = parse_qs(urlparse(opener.call_args[0][0].full_url).query)
        self.assertEqual(qs["part"], ["2"])
        self.assertEqual(qs["format"], ["gz"])

    def test_cert_path(self):
        body = {"success": True, "data": {"cert": {}, "card": None, "slab": None}}
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
            self.client.lookup_cert("PSA", "12345678")
        self.assertEqual(opener.call_args[0][0].full_url, "https://hobbycardindex.com/api/v1/certs/psa/12345678")

    def test_watchlist_bodies(self):
        body = {"success": True, "data": {"added": 2, "total": 2}}
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
            self.client.add_to_watchlist(card_ids=[1, 2])
        self.assertEqual(json.loads(opener.call_args[0][0].data.decode("utf-8")), {"cardIds": [1, 2]})
        with mock.patch("hobbycardindex.client.urlopen", return_value=FakeResponse(body)) as opener:
            self.client.remove_from_watchlist(remove_all=True)
        self.assertEqual(json.loads(opener.call_args[0][0].data.decode("utf-8")), {"all": True})

    def test_network_error(self):
        with mock.patch("hobbycardindex.client.urlopen", side_effect=URLError("connection refused")):
            with self.assertRaises(HobbyCardIndexError) as ctx:
                self.client.get_categories()
        self.assertEqual(ctx.exception.status, 0)
        self.assertEqual(ctx.exception.code, "NETWORK_ERROR")


if __name__ == "__main__":
    unittest.main()
