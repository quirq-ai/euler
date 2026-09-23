# Euler

A small Python watcher service. It boots a FastAPI server on port 2718 and runs
a background tick loop that logs `helloworld` and reloads `timeline.json` on
every pass. The setup, configuration and startup commands mirror xo-space so
the two projects are operated the same way.

## Quick start

```sh
./euler.sh dev        # creates venv, installs requirements, runs with reload on 127.0.0.1:2718
```

Process manager (detached, logs to /tmp/euler.log, PID in /tmp/euler.pid):

```sh
./euler.sh install    # create venv and install requirements.txt
./euler.sh start      # start in the background
./euler.sh status
./euler.sh logs       # tail -f /tmp/euler.log
./euler.sh restart
./euler.sh stop
```

Or run the server directly, as the Dockerfile does:

```sh
venv/bin/python server.py
```

## Configuration

Copy `.env.example` to `.env`. Every key is documented there. Shell exports
outrank `.env`.

| Key | Default | Meaning |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | bind address |
| `PORT` | `2718` | under `STAGE=local`, 2719 is used when 2718 is busy |
| `STAGE` | `beta` | `local` on a laptop (`euler.sh dev` sets it) |
| `UVICORN_RELOAD` | `false` | restart on code changes |
| `EULER_WATCHER_ENABLED` | `true` | run the tick loop |
| `EULER_WATCHER_INTERVAL_S` | `5` | seconds between ticks |
| `EULER_TIMELINE_PATH` | `timeline.json` | file the watcher loads each tick; `.jsonl` is also accepted |

## Endpoints

| Route | Returns |
| --- | --- |
| `GET /` | service name and stage |
| `GET /health` | status plus a watcher snapshot |
| `GET /api/watcher` | tick count, last tick time, timeline path and event count |
| `GET /api/timeline` | the events currently in the timeline file |

## Layout

```
server.py            FastAPI app, lifespan starts the watcher, uvicorn entrypoint
services/periodic.py run_forever, the shared poll loop
services/watcher.py  the tick: log helloworld, reload timeline.json
utils/local_port.py  2718 -> 2719 fallback under STAGE=local
tests/               plain unittest.TestCase, runnable under pytest too
timeline.json        the file the watcher loads
euler.sh             dev | install | start | stop | restart | status | logs
```

## Tests

```sh
venv/bin/python -m unittest discover -s tests -v
venv/bin/python -m pytest -q
```

## Docker

```sh
docker build -t euler .
docker run -p 2718:2718 euler
```
