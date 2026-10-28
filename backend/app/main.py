import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.request_id import RequestIDMiddleware
from app.services.extraction_job import poll_extraction_jobs, stop_poller


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"

if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    poller: asyncio.Task[None] | None = None
    if settings.EXTRACTION_POLLER_ENABLED:
        poller = asyncio.create_task(poll_extraction_jobs())
    try:
        yield
    finally:
        if poller is not None:
            poller.cancel()
            with suppress(asyncio.CancelledError):
                await poller
        stop_poller()


app = FastAPI(title=settings.PROJECT_NAME, 
              openapi_url=f"{settings.API_V1_STR}/openapi.json",
              generate_unique_id_function=custom_generate_unique_id,
              lifespan=lifespan)

if settings.all_cors_origin:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origin,
        allow_credentials=True,
        allow_headers=["*"],
        allow_methods=["*"]
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

app.add_middleware(RequestIDMiddleware)

