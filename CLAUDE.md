# Euler - Project Memory

## Project overview

- FastAPI service on port 2718 that runs a background watcher loop.
- The watcher tick logs `helloworld` and reloads `timeline.json` each pass.
- Setup, configuration and startup mirror xo-space (`euler.sh`, `.env`,
  `requirements.txt`, `venv/`, `python server.py`).

## Conventions

- Keep endpoint handlers thin in `server.py` (move to `routers/` when they grow).
- Background loops go through `services/periodic.run_forever`.
- Configuration is read from the environment on every tick, never cached at import.
- Tests are plain `unittest.TestCase` under `tests/` and must pass under both
  `python -m unittest discover -s tests` and `pytest -q`.
- No em dashes in code, comments or docs.

## Validation

- The project venv is `venv/bin/python`.
- `venv/bin/python -m unittest discover -s tests -v` before claiming done.
