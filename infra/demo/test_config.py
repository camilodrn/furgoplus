"""Regression tests against accidental publication, shared networks and proxy trust."""

import os
import runpy
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from check_config import compose_model, validate_model


class TopologyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = compose_model()

    def reject(self, mutate):
        model = deepcopy(self.model)
        mutate(model)
        with self.assertRaises((ValueError, KeyError)):
            validate_model(model)

    def test_effective_topology_passes(self):
        validate_model(self.model)

    def test_caddy_cannot_publish_to_lan_or_ipv6(self):
        for address in ("0.0.0.0", "::", "::1", "192.0.2.10", None):
            with self.subTest(address=address):
                self.reject(
                    lambda m: m["services"]["caddy"]["ports"][0].update(host_ip=address)
                )

    def test_caddy_requires_one_http_tcp_port(self):
        self.reject(lambda m: m["services"]["caddy"].update(ports=[]))
        self.reject(
            lambda m: m["services"]["caddy"]["ports"].append(
                {"host_ip": "127.0.0.1", "target": 2019, "published": "12019"}
            )
        )
        for change in (
            {"target": 2019},
            {"protocol": "udp"},
            {"published": "18080-18090"},
        ):
            with self.subTest(change=change):
                self.reject(lambda m: m["services"]["caddy"]["ports"][0].update(change))

    def test_backend_and_postgres_cannot_join_ingress_or_publish(self):
        for name in ("backend", "db"):
            with self.subTest(service=name):
                self.reject(
                    lambda m: m["services"][name]["networks"].update(ingress={})
                )
                self.reject(
                    lambda m: m["services"][name].update(
                        ports=[{"host_ip": "127.0.0.1", "target": 8000}]
                    )
                )
                self.reject(lambda m: m["services"][name].update(network_mode="host"))

    def test_internal_networks_and_project_scope_are_required(self):
        for name in ("proxy", "database"):
            with self.subTest(network=name):
                self.reject(lambda m: m["networks"][name].update(internal=False))
        self.reject(lambda m: m["networks"]["ingress"].update(internal=True))
        self.reject(
            lambda m: m["networks"]["ingress"].update(
                driver_opts={"com.docker.network.bridge.gateway_mode_ipv4": "routed"}
            )
        )
        for name in ("ingress", "proxy", "database"):
            with self.subTest(network=name):
                self.reject(lambda m: m["networks"][name].update(external=True))
                self.reject(lambda m: m["networks"][name].update(name="fitfu_shared"))

    def test_caddy_cannot_access_database_files_or_secrets(self):
        self.reject(lambda m: m["services"]["caddy"].update(cap_add=["NET_ADMIN"]))
        self.reject(lambda m: m["services"]["caddy"]["networks"].update(database={}))
        self.reject(
            lambda m: m["services"]["caddy"].update(
                volumes=[{"type": "volume", "source": "private_uploads"}]
            )
        )
        self.reject(
            lambda m: m["services"]["caddy"].update(secrets=["django_secret_key"])
        )

    def test_trust_must_use_caddys_exact_proxy_ip(self):
        for address in ("*", "172.30.81.0/29", "172.30.81.3", "192.0.2.1"):
            with self.subTest(address=address):
                self.reject(
                    lambda m: m["services"]["backend"]["environment"].update(
                        DEMO_CADDY_IP=address
                    )
                )


class GunicornConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(os.environ, {"DEMO_CADDY_IP": "172.30.81.2"}, clear=True):
            cls.config = runpy.run_path(Path(__file__).with_name("gunicorn.conf.py"))

    def test_proxy_options_use_config_file_string_types(self):
        self.assertIsInstance(self.config["forwarded_allow_ips"], str)
        self.assertIsInstance(self.config["forwarder_headers"], str)
        self.assertEqual(self.config["forwarder_headers"], "")

    def test_proxy_trust_does_not_expand_to_ingress_or_forwarded_path_headers(self):
        self.assertEqual(
            self.config["forwarded_allow_ips"].split(","), ["172.30.81.2", "127.0.0.1"]
        )
        self.assertEqual(
            self.config["secure_scheme_headers"], {"X-FORWARDED-PROTO": "https"}
        )
        self.assertTrue(self.config["control_socket_disable"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
