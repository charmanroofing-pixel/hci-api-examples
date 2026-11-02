# Contributing

Thanks for helping. This repo holds runnable examples for the HobbyCardIndex Data API and the source of the `hobbycardindex` npm and PyPI packages.

- Open an issue first for anything bigger than a typo, so we can agree on the shape.
- Keep examples short and runnable as-is with only `HCI_API_KEY` set. No frameworks, no build step.
- Match the real API: check the field names against https://hobbycardindex.com/developers before changing a response excerpt.
- Never commit an API key, a customer's data, or a card photo you do not own.
- Code style: plain JavaScript (ES modules, Node 18+) and plain Python (3.9+, standard library). Run `node --test` in `js/` and `python -m unittest discover -s python/tests` before opening a pull request.
- Writing: short sentences, no hype. No em dashes.

Questions about the API itself, plans or keys: sean@hobbycardindex.com.
