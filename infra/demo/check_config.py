"""Validate the deployment model without a Docker daemon, network or database."""

import ast
import ipaddress
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compose_model():
    result = subprocess.run(
        [
            "docker",
            "compose",
            "--env-file",
            str(ROOT / "infra/demo/.env.example"),
            "-f",
            str(ROOT / "infra/demo/compose.yaml"),
            "config",
            "--format",
            "json",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def validate_model(model, project="furgoplus-demo"):
    require(model["name"] == project, "Unexpected Compose project")
    services = model["services"]
    require(
        set(services) == {"db", "backend", "caddy"}, "Expected three runtime services"
    )
    for name, service in services.items():
        require("container_name" not in service, f"{name}: no shared container name")
        require("network_mode" not in service, f"{name}: no host/shared network mode")
        require(not service.get("privileged"), f"{name}: no privileged containers")
        require(service.get("mem_limit") and service.get("cpus"), f"{name}: limits")
        require(service.get("healthcheck"), f"{name}: missing healthcheck")
        require(
            service["logging"]["options"]["max-file"] == "3", f"{name}: log rotation"
        )
        require(
            not (
                {"DB_PASSWORD", "POSTGRES_PASSWORD", "DJANGO_SECRET_KEY"}
                & set(service.get("environment", {}))
            ),
            f"{name}: secrets must use mounted files",
        )
        if name != "caddy":
            require(not service.get("ports"), f"{name}: no published ports")
        for volume in service.get("volumes", []):
            require(volume["type"] == "volume", f"{name}: no code/secret bind mounts")
    ports = services["caddy"].get("ports", [])
    require(len(ports) == 1, "Caddy must publish exactly one port")
    port = ports[0]
    require(port.get("host_ip") == "127.0.0.1", "Caddy must bind only to IPv4 loopback")
    require(port["target"] == 8080, "Only Caddy's HTTP port may be published")
    require(port.get("protocol", "tcp") == "tcp", "No UDP publication")
    require(str(port["published"]).isdigit(), "Publish a single host port, not a range")
    require(1 <= int(port["published"]) <= 65535, "Invalid host port")
    for name in ("backend", "caddy"):
        require(services[name]["read_only"], f"{name}: immutable runtime filesystem")
        require(services[name]["cap_drop"] == ["ALL"], f"{name}: capabilities")
        require(not services[name].get("cap_add"), f"{name}: no added capabilities")
        require(
            "no-new-privileges:true" in services[name]["security_opt"],
            f"{name}: no privilege escalation",
        )
    require(
        not services["caddy"].get("volumes"), "Caddy must never mount private files"
    )
    require(
        not services["caddy"].get("secrets"), "Caddy must never receive app secrets"
    )
    require(set(services["db"]["networks"]) == {"database"}, "Database isolation")
    require(
        set(services["caddy"]["networks"]) == {"ingress", "proxy"},
        "Caddy ingress boundary",
    )
    require(
        set(services["backend"]["networks"]) == {"proxy", "database"},
        "Backend isolation",
    )
    networks = model["networks"]
    require(
        set(networks) == {"ingress", "proxy", "database"}, "Expected three networks"
    )
    for name, network in networks.items():
        require(not network.get("external"), f"{name}: no external/shared network")
        require(
            network["name"] == f"{model['name']}_{name}",
            f"{name}: project-scoped network",
        )
        require(network.get("driver", "bridge") == "bridge", f"{name}: bridge only")
        require(not network.get("driver_opts"), f"{name}: default bridge routing only")
        require(not network.get("enable_ipv6"), f"{name}: IPv4 deployment only")
    require(
        not networks["ingress"].get("internal"), "Ingress must be an ordinary bridge"
    )
    for name in ("proxy", "database"):
        require(networks[name].get("internal") is True, f"{name}: must remain internal")
    require(
        set(model["volumes"]) == {"pg_data", "private_uploads"}, "Persistent data pair"
    )
    for name, volume in model["volumes"].items():
        require(not volume.get("external"), f"{name}: no existing/shared volume")
        require(
            volume["name"] == f"{model['name']}_{name}",
            f"{name}: project-scoped volume",
        )
    subnet = ipaddress.ip_network(networks["proxy"]["ipam"]["config"][0]["subnet"])
    addresses = []
    for name in ("backend", "caddy"):
        address = services[name]["networks"]["proxy"]["ipv4_address"]
        require(
            ipaddress.ip_address(address) in subnet, f"{name}: proxy subnet mismatch"
        )
        addresses.append(address)
    require(len(set(addresses)) == 2, "Proxy IP addresses must differ")
    require(
        services["backend"]["environment"]["DEMO_CADDY_IP"] == addresses[1],
        "Django must trust exactly Caddy's proxy-network IP",
    )
    for secret in model["secrets"].values():
        require(
            Path(secret["file"]).is_absolute(), "External secret-file paths required"
        )
        require(not Path(secret["file"]).is_relative_to(ROOT), "No repository secrets")


def main():
    try:
        validate_model(compose_model())
        for path in list((ROOT / "backend").rglob("*.py")) + list(
            Path(__file__).parent.glob("*.py")
        ):
            ast.parse(path.read_text(), filename=str(path))
    except (KeyError, ValueError) as error:
        raise SystemExit(f"Invalid demo configuration: {error}") from None
    print(
        "Compose ingress, isolation, loopback, persistence, limits, secret paths "
        "and Python AST: OK"
    )


if __name__ == "__main__":
    main()
