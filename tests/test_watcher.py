import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from services import watcher
from utils.local_port import LocalPortsUnavailableError, resolve_server_port


class LoadTimelineTests(unittest.TestCase):
    def test_missing_file_is_empty(self):
        self.assertEqual(watcher.load_timeline(Path("/nonexistent/timeline.json")), [])

    def test_events_object(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "timeline.json"
            p.write_text(json.dumps({"events": [{"type": "a"}, {"type": "b"}]}))
            self.assertEqual(len(watcher.load_timeline(p)), 2)

    def test_bare_array(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "timeline.json"
            p.write_text(json.dumps([{"type": "a"}]))
            self.assertEqual(watcher.load_timeline(p), [{"type": "a"}])

    def test_jsonl(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "timeline.jsonl"
            p.write_text('{"type": "a"}\n\n{"type": "b"}\n')
            self.assertEqual(len(watcher.load_timeline(p)), 2)

    def test_non_list_events_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "timeline.json"
            p.write_text(json.dumps({"events": "nope"}))
            with self.assertRaises(ValueError):
                watcher.load_timeline(p)


class TickTests(unittest.TestCase):
    def test_tick_logs_helloworld_and_loads_timeline(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "timeline.json"
            p.write_text(json.dumps({"events": [{"type": "a"}]}))
            before = watcher.state.ticks
            with mock.patch.dict(os.environ, {"EULER_TIMELINE_PATH": str(p)}):
                with self.assertLogs("euler.watcher", level="INFO") as captured:
                    asyncio.run(watcher.tick())
            self.assertEqual(watcher.state.ticks, before + 1)
            self.assertEqual(watcher.state.event_count, 1)
            self.assertTrue(any("helloworld" in line for line in captured.output))


class ConfigTests(unittest.TestCase):
    def test_interval_default_and_override(self):
        with mock.patch.dict(os.environ, {"EULER_WATCHER_INTERVAL_S": ""}):
            self.assertEqual(watcher.watcher_interval_s(), watcher.DEFAULT_INTERVAL_S)
        with mock.patch.dict(os.environ, {"EULER_WATCHER_INTERVAL_S": "2.5"}):
            self.assertEqual(watcher.watcher_interval_s(), 2.5)
        with mock.patch.dict(os.environ, {"EULER_WATCHER_INTERVAL_S": "abc"}):
            self.assertEqual(watcher.watcher_interval_s(), watcher.DEFAULT_INTERVAL_S)

    def test_enabled_flag(self):
        with mock.patch.dict(os.environ, {"EULER_WATCHER_ENABLED": "false"}):
            self.assertFalse(watcher.watcher_enabled())
        with mock.patch.dict(os.environ, {"EULER_WATCHER_ENABLED": "true"}):
            self.assertTrue(watcher.watcher_enabled())


class PortTests(unittest.TestCase):
    def test_non_local_keeps_requested(self):
        self.assertEqual(resolve_server_port(host="0.0.0.0", requested_port=2718, stage="beta",
                                             port_available=lambda h, p: False), 2718)

    def test_local_falls_back(self):
        self.assertEqual(resolve_server_port(host="127.0.0.1", requested_port=2718, stage="local",
                                             port_available=lambda h, p: p == 2719), 2719)

    def test_local_both_busy(self):
        with self.assertRaises(LocalPortsUnavailableError):
            resolve_server_port(host="127.0.0.1", requested_port=2718, stage="local",
                                port_available=lambda h, p: False)


if __name__ == "__main__":
    unittest.main()
