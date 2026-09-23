"""Deterministic port selection for local server startup (same shape as xo-space)."""

from __future__ import annotations

import socket
from collections.abc import Callable


DEFAULT_PORT = 2718
LOCAL_FALLBACK_PORT = 2719


class LocalPortsUnavailableError(RuntimeError):
    """Raised when both supported local ports are already occupied."""


def is_port_available(host: str, port: int) -> bool:
    """Return whether a TCP listener can bind to ``host:port``."""

    bind_host = host.strip() or "0.0.0.0"
    try:
        addresses = socket.getaddrinfo(
            bind_host,
            port,
            type=socket.SOCK_STREAM,
            flags=socket.AI_PASSIVE,
        )
    except socket.gaierror:
        return False

    for family, socktype, protocol, _, sockaddr in addresses:
        try:
            with socket.socket(family, socktype, protocol) as candidate:
                candidate.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                candidate.bind(sockaddr)
                return True
        except OSError:
            continue
    return False


def resolve_server_port(
    *,
    host: str,
    requested_port: int,
    stage: str,
    port_available: Callable[[str, int], bool] = is_port_available,
) -> int:
    """Resolve the bind port without changing non-local or explicit ports.

    Local startup has one fallback: the default ``2718`` moves to ``2719``
    when occupied. Explicit other ports are left for Uvicorn to validate.
    """

    if stage.strip().lower() != "local" or requested_port != DEFAULT_PORT:
        return requested_port

    if port_available(host, DEFAULT_PORT):
        return DEFAULT_PORT
    if port_available(host, LOCAL_FALLBACK_PORT):
        return LOCAL_FALLBACK_PORT

    raise LocalPortsUnavailableError(
        f"Local ports {DEFAULT_PORT} and {LOCAL_FALLBACK_PORT} are both in use. "
        "Set PORT to another available port and start again."
    )
