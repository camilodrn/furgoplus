"""Internal bounded HTTP worker. Started only for an explicit --ollama call."""

import http.client
import json
import sys

from .ollama import MAX_RESPONSE


def main() -> int:
    connection = None
    try:
        port = int(sys.argv[1])
        timeout = float(sys.argv[2])
        if not 1 <= port <= 65535 or not 0.1 <= timeout <= 8:
            return 1
        request = sys.stdin.buffer.read(MAX_RESPONSE + 1)
        if len(request) > MAX_RESPONSE:
            return 1
        endpoint = sys.argv[3] if len(sys.argv) > 3 else "/api/chat"
        if endpoint == "/api/chat" and request:
            method = "POST"
        elif endpoint in {"/api/version", "/api/tags", "/api/ps"} and not request:
            method = "GET"
        else:
            return 1
        # Numeric loopback, no DNS, proxy env, redirect, auth or cloud endpoint.
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=timeout)
        connection.request(method, endpoint, body=request or None,
                           headers={"Content-Type": "application/json"})
        response = connection.getresponse()
        if response.status != 200:
            return 1
        if response.getheader("Content-Type", "").split(";")[0].strip() != "application/json":
            return 1
        raw = response.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            return 1
        json.loads(raw)  # parent performs the semantic validation
        sys.stdout.buffer.write(raw)
        return 0
    except TimeoutError:
        return 2  # fixed status only: never echo a server body or exception
    except (OSError, ValueError, http.client.HTTPException, IndexError, RecursionError):
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
