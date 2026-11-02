"""Client for the HobbyCardIndex Data API. Docs: https://hobbycardindex.com/developers"""

from .client import CREDIT_HTML, DEFAULT_BASE_URL, HobbyCardIndex, HobbyCardIndexError

__all__ = ["HobbyCardIndex", "HobbyCardIndexError", "CREDIT_HTML", "DEFAULT_BASE_URL"]
__version__ = "0.1.0"
