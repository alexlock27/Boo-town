#!/usr/bin/env python3
"""Local review server for Boo Town.

Use this instead of `python -m http.server 8000`.

Why it exists: index.html is the one file that cannot carry a ?v= cache-busting
query, so a browser holding a stale copy of it keeps loading the OLD main.js,
the OLD registry, and therefore every OLD game module — while the files on disk
are correct. That cost three rounds of "the fix still isn't showing" during the
RUN18E/RUN19 local review. This server sends no-store on everything, so what you
see is always what is on disk.

    python _serve.py          # serves this folder on http://localhost:8000
    python _serve.py 8080     # different port
"""

import sys
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_header(self, keyword, value):
        # SimpleHTTPRequestHandler adds Last-Modified, which lets Chrome apply a
        # heuristic freshness lifetime and serve from cache without revalidating.
        if keyword == 'Last-Modified':
            return
        super().send_header(keyword, value)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory='.')
    # ThreadingHTTPServer, not HTTPServer: the single-threaded server wedges the moment a
    # client holds a keep-alive connection open (one hung socket = every later request
    # times out). Found 2026-07-30 when Playwright suites froze it twice in one session.
    server = ThreadingHTTPServer(('', port), handler)
    print(f'Boo Town review server (no-store) on http://localhost:{port}')
    print('Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
