"""Read-only HTTP + database probe. Migration readiness is a manual release gate."""

import http.client
import json

import django
from django.db import connection

connection_http = http.client.HTTPConnection("127.0.0.1", 8000, timeout=3)
connection_http.request(
    "GET",
    "/api/v1/health/",
    headers={"Host": "demo.furgoplus.cl", "X-Forwarded-Proto": "https"},
)
response = connection_http.getresponse()
if response.status != 200 or json.load(response) != {"status": "ok"}:
    raise SystemExit("HTTP health failed")
connection_http.close()
django.setup()
with connection.cursor() as cursor:
    cursor.execute("SELECT 1")
    if cursor.fetchone() != (1,):
        raise SystemExit("Database health failed")
connection.close()
