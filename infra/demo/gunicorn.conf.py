import os

bind = "0.0.0.0:8000"
workers = 2
worker_class = "gthread"
threads = 2
timeout = 60
graceful_timeout = 30
keepalive = 5
max_requests = 1000
max_requests_jitter = 100
# Avoid worker heartbeat writes on the HDD.
worker_tmp_dir = "/dev/shm"
# Config-file validators require strings, which Gunicorn then parses internally.
# Trust only Caddy's proxy-network IP plus the local read-only health probe.
forwarded_allow_ips = os.environ["DEMO_CADDY_IP"] + ",127.0.0.1"
secure_scheme_headers = {"X-FORWARDED-PROTO": "https"}
forwarder_headers = ""
control_socket_disable = True
# No URL/query, IP, email, cookie, CSRF, payload or upload-filename access logs.
accesslog = None
errorlog = "-"
loglevel = "warning"
