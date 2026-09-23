"""
Euler Server
FastAPI server that hosts the Euler watcher.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from services import watcher
from utils.local_port import LocalPortsUnavailableError, resolve_server_port

# Load environment variables. Keys already exported by the shell outrank .env.
load_dotenv(Path(__file__).resolve().parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("euler.server")

STAGE = (os.getenv("STAGE", "beta") or "beta").strip().lower()
IS_LOCAL_STAGE = STAGE == "local"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the watcher with the server and cancel it on shutdown."""
    task = asyncio.create_task(watcher.run(), name="euler.watcher")
    logger.info("euler started (stage=%s, watcher=%s)", STAGE, "on" if watcher.watcher_enabled() else "off")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        logger.info("euler stopped")


app = FastAPI(title="Euler", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"service": "euler", "stage": STAGE}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "stage": STAGE, "watcher": watcher.state.snapshot()}


@app.get("/api/watcher")
async def watcher_status():
    return watcher.state.snapshot()


@app.get("/api/timeline")
async def timeline():
    path = watcher.timeline_path()
    events = watcher.load_timeline(path)
    return {"path": str(path), "count": len(events), "events": events}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    requested_port = int(os.getenv("PORT", "2718"))
    try:
        port = resolve_server_port(host=host, requested_port=requested_port, stage=STAGE)
    except LocalPortsUnavailableError as exc:
        print(f"❌ {exc}")
        raise SystemExit(1) from exc

    if port != requested_port:
        print(f"⚠️ Local port {requested_port} is already in use; using http://{host}:{port} instead.")
        os.environ["PORT"] = str(port)

    reload = os.getenv("UVICORN_RELOAD", "").strip().lower() in ("1", "true", "yes")

    if reload:
        uvicorn.run(
            "server:app",
            host=host,
            port=port,
            reload=True,
            reload_dirs=[str(Path(__file__).resolve().parent)],
        )
    else:
        uvicorn.run("server:app", host=host, port=port, reload=False)
