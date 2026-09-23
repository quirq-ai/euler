"""The Euler watcher: a periodic tick that logs and reloads ``timeline.json``.

Deliberately tiny. The tick is the seam the architecture grows from: each
pass logs ``helloworld``, re-reads the timeline file and records how many
events it holds. Configuration is re-read from the environment on every
tick so an edited ``.env`` takes effect on restart without code changes.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

from services.periodic import run_forever

logger = logging.getLogger("euler.watcher")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TIMELINE_PATH = "timeline.json"
DEFAULT_INTERVAL_S = 5.0


def watcher_enabled() -> bool:
    value = (os.getenv("EULER_WATCHER_ENABLED", "true") or "true").strip().lower()
    return value not in ("0", "false", "no", "off")


def watcher_interval_s() -> float:
    raw = (os.getenv("EULER_WATCHER_INTERVAL_S", "") or "").strip()
    try:
        interval = float(raw) if raw else DEFAULT_INTERVAL_S
    except ValueError:
        logger.warning("EULER_WATCHER_INTERVAL_S=%r is not a number; using %s", raw, DEFAULT_INTERVAL_S)
        return DEFAULT_INTERVAL_S
    return interval if interval > 0 else DEFAULT_INTERVAL_S


def timeline_path() -> Path:
    raw = (os.getenv("EULER_TIMELINE_PATH", "") or "").strip() or DEFAULT_TIMELINE_PATH
    path = Path(raw).expanduser()
    return path if path.is_absolute() else PROJECT_ROOT / path


def load_timeline(path: Path) -> List[Dict[str, Any]]:
    """Return the timeline's events.

    Accepts either ``{"events": [...]}`` or a bare JSON array. A ``.jsonl``
    path is read one JSON object per line (the workspace's timeline format).
    A missing file is an empty timeline, not an error.
    """
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    data = json.loads(text) if text.strip() else []
    if isinstance(data, dict):
        events = data.get("events", [])
    else:
        events = data
    if not isinstance(events, list):
        raise ValueError(f"{path}: expected a list of events, got {type(events).__name__}")
    return events


@dataclass
class WatcherState:
    ticks: int = 0
    last_tick_ts: str = ""
    timeline_path: str = ""
    event_count: int = 0
    events: List[Dict[str, Any]] = field(default_factory=list)

    def snapshot(self) -> Dict[str, Any]:
        return {
            "enabled": watcher_enabled(),
            "interval_s": watcher_interval_s(),
            "ticks": self.ticks,
            "last_tick_ts": self.last_tick_ts,
            "timeline_path": self.timeline_path,
            "event_count": self.event_count,
        }


state = WatcherState()


async def tick() -> None:
    import datetime

    state.ticks += 1
    state.last_tick_ts = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
    path = timeline_path()
    state.timeline_path = str(path)
    events = load_timeline(path)
    state.events = events
    state.event_count = len(events)
    logger.info("helloworld tick=%d timeline=%s events=%d", state.ticks, path.name, len(events))


async def run() -> None:
    await run_forever(
        "euler.watcher",
        tick,
        interval_s=watcher_interval_s,
        enabled=watcher_enabled,
        logger=logger,
    )
