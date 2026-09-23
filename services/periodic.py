"""The one loop skeleton behind background pollers.

:func:`run_forever` is the shape every background loop shares: an optional
enabled gate, a startup delay, then tick, log a failure and go on, sleep,
forever, until the task is cancelled.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Optional

_module_logger = logging.getLogger(__name__)


async def run_forever(
    name: str,
    tick: Callable[[], Awaitable[object]],
    *,
    interval_s: Callable[[], float],
    startup_delay_s: float = 0.0,
    enabled: Optional[Callable[[], bool]] = None,
    logger: Optional[logging.Logger] = None,
) -> None:
    """Run ``tick`` forever, ``interval_s()`` seconds apart.

    Returns at once when ``enabled`` is given and ``enabled()`` is false.
    An ``Exception`` raised by ``tick`` is logged as non-fatal and the loop
    goes on; ``CancelledError`` propagates, so cancelling the task is how
    the loop stops. ``interval_s`` is re-read on every pass.
    """
    log = logger or _module_logger
    if enabled is not None and not enabled():
        return
    await asyncio.sleep(startup_delay_s)
    while True:
        try:
            await tick()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.warning("%s: tick failed (non-fatal)", name, exc_info=True)
        await asyncio.sleep(interval_s())
