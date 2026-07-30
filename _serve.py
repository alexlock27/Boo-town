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

import os
import socket
import sys
import threading
import webbrowser
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
    # the first argument that is NOT a flag is the port (so `--open` is not read as one)
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    port = int(args[0]) if args else 8000

    # Serve THIS SCRIPT'S folder, never the shell's current directory.
    #
    # Why: SimpleHTTPRequestHandler serves the cwd, so `python _serve.py` run from the project
    # ROOT (one level up, where three copies of the app sit side by side) quietly served an
    # empty directory listing instead of the app — "nothing is opening", with no error anywhere.
    # The script knows where it lives; the shell does not need to.
    root = os.path.dirname(os.path.abspath(__file__))
    if not os.path.exists(os.path.join(root, 'index.html')):
        print('ERROR: no index.html next to _serve.py — this is not the Boo Town folder.')
        sys.exit(1)
    os.chdir(root)

    # ...and say plainly if the port is already taken, rather than dying in a traceback nobody
    # reads and leaving a stale server from an earlier session answering instead.
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(0.4)
    if probe.connect_ex(('127.0.0.1', port)) == 0:
        probe.close()
        print(f'ERROR: something is ALREADY serving port {port}.')
        print(f'  That is probably an old server from an earlier session, serving old files.')
        print(f'  Stop it, or run:  python _serve.py {port + 1}')
        sys.exit(1)
    probe.close()

    handler = partial(NoCacheHandler, directory=root)
    # ThreadingHTTPServer, not HTTPServer: the single-threaded server wedges the moment a
    # client holds a keep-alive connection open (one hung socket = every later request
    # times out). Found 2026-07-30 when Playwright suites froze it twice in one session.
    server = ThreadingHTTPServer(('', port), handler)
    url = f'http://localhost:{port}'
    print(f'Boo Town review server (no-store) on {url}')
    print(f'Serving: {root}')
    # --open: bring the browser up once the server is actually listening, so the double-click
    # launcher never lands on a "can't connect" page a second before the server is ready.
    if '--open' in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    print('Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
