"""Normalize the visitor address only at the demo's explicit proxy boundary."""

from ipaddress import ip_address

from django.conf import settings
from django.http import JsonResponse


class DemoProxyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Validate the actual Host even for views that never call get_host().
        request.get_host()
        peer = request.META.get("REMOTE_ADDR", "")
        trusted = peer == settings.DEMO_TRUSTED_PROXY_IP
        health_probe = (
            peer == "127.0.0.1"
            and request.method == "GET"
            and request.path == "/api/v1/health/"
        )
        if trusted:
            # Caddy overwrites this header from Cloudflare's single-IP header.
            # Missing/ambiguous input fails closed instead of sharing a proxy bucket.
            try:
                address = ip_address(request.META.get("HTTP_X_FURGOPLUS_CLIENT_IP", ""))
                if getattr(address, "scope_id", None):
                    raise ValueError("Scoped address")
            except ValueError:
                return JsonResponse(
                    {
                        "code": "invalid_proxy_ip",
                        "message": "Invalid proxy client address.",
                        "fields": {},
                    },
                    status=400,
                )
            request.META["REMOTE_ADDR"] = str(
                getattr(address, "ipv4_mapped", None) or address
            )
            request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        elif not health_probe:
            # Gunicorn also restricts its scheme interpretation to the proxy/probe.
            request.META.pop("HTTP_X_FORWARDED_PROTO", None)
            request.META["wsgi.url_scheme"] = "http"
        for header in (
            "HTTP_X_FURGOPLUS_CLIENT_IP",
            "HTTP_CF_CONNECTING_IP",
            "HTTP_X_FORWARDED_FOR",
            "HTTP_X_FORWARDED_HOST",
            "HTTP_X_REAL_IP",
            "HTTP_FORWARDED",
        ):
            request.META.pop(header, None)
        return self.get_response(request)
