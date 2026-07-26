#!/usr/bin/env python3
"""Static file server for the test harness — HTTP/1.1 with keep-alive.

`python -m http.server` speaks HTTP/1.0 and closes the socket after every response, so a
Playwright suite that opens many browser contexts burns one ephemeral TCP port per file
per page load. On Windows that exhausts the 49152-65535 dynamic range (sockets sit in
TIME_WAIT for ~4 minutes) and pages start failing with net::ERR_ADDRESS_IN_USE part-way
through a long suite. Keep-alive collapses a whole page load onto a handful of sockets.

    python scripts/serve.py 8123
    BASE=http://127.0.0.1:8123 ./_runall.sh
"""
import sys
import http.server
import socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    Server(("127.0.0.1", port), Handler).serve_forever()
