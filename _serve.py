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

    def log_message(self, fmt, *args):
        # Only say something when something is WRONG. A successful request is not news, and a
        # screenful of "GET /js/ui.js 200" hides the messages that actually matter.
        try:
            status = str(args[1]) if len(args) > 1 else ''
        except Exception:
            status = ''
        if status and not status.startswith('2') and not status.startswith('3'):
            sys.stderr.write('  problem: ' + (fmt % args) + '\n')

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

    # A port already in use almost always means a stale server from an earlier session is
    # answering — and it will be serving OLD FILES, which looks exactly like a caching bug.
    #
    # The double-click launcher must never dead-end on that: it just moves to the next free
    # port and says so. Only an explicitly requested port refuses, because if you asked for
    # 8000 by name you want to know 8000 is taken rather than be quietly moved.
    def taken(p):
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        probe.settimeout(0.4)
        busy = probe.connect_ex(('127.0.0.1', p)) == 0
        probe.close()
        return busy

    if taken(port):
        asked_explicitly = bool(args)
        if asked_explicitly:
            print(f'ERROR: something is ALREADY serving port {port}.')
            print(f'  That is probably an old server from an earlier session, serving old files.')
            print(f'  Stop it, or run:  python _serve.py {port + 1}')
            sys.exit(1)
        original = port
        for candidate in range(port + 1, port + 12):
            if not taken(candidate):
                port = candidate
                break
        else:
            print(f'ERROR: ports {original}-{original + 11} are all in use. Close some windows and try again.')
            sys.exit(1)
        # Say this LOUDLY. A stale server on the original port is still answering, and any
        # browser tab still pointed at it is showing an OLD COPY OF THE GAME - which looks
        # exactly like "my changes aren't showing up" and is impossible to guess from inside
        # the browser. The number in the address bar is the only way to tell the two apart.
        print(flush=True)
        print('  ' + '!' * 52, flush=True)
        print(f'  PORT {original} WAS ALREADY BUSY.', flush=True)
        print(f'  Something else - almost certainly a leftover server from an', flush=True)
        print(f'  earlier session - is still answering on {original}, and it is', flush=True)
        print(f'  serving an OLD COPY of the game.', flush=True)
        print(flush=True)
        print(f'  CLOSE any browser tab showing localhost:{original}.', flush=True)
        print(f'  The real, up-to-date game is on port {port} (below).', flush=True)
        print('  ' + '!' * 52, flush=True)
        print(flush=True)

    handler = partial(NoCacheHandler, directory=root)
    # ThreadingHTTPServer, not HTTPServer: the single-threaded server wedges the moment a
    # client holds a keep-alive connection open (one hung socket = every later request
    # times out). Found 2026-07-30 when Playwright suites froze it twice in one session.
    server = ThreadingHTTPServer(('', port), handler)
    url = f'http://localhost:{port}'
    print('  ' + '-' * 52, flush=True)
    print(f'  Boo Town is running at:  {url}', flush=True)
    print(f'  Serving: {root}', flush=True)
    print('  ' + '-' * 52, flush=True)
    print(flush=True)
    # --open: bring the browser up once the server is actually listening, so the double-click
    # launcher never lands on a "can't connect" page a second before the server is ready.
    if '--open' in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    print('  (Only problems are shown below - silence is good.)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
