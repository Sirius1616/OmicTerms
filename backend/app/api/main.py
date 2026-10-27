from fastapi import APIRouter

from app.api.routes import (
    documents,
    experiments,
    imports,
    jobs,
    login,
    private,
    projects,
    samples,
    users,
    utils,
    validations,
)

api_router = APIRouter()


api_router.include_router(login.router)
api_router.include_router(jobs.router)
api_router.include_router(utils.router)
api_router.include_router(users.router)
api_router.include_router(private.router)
api_router.include_router(documents.router)
api_router.include_router(documents.upload_router)
api_router.include_router(validations.router)
api_router.include_router(validations.validation_router)
api_router.include_router(projects.router)
api_router.include_router(experiments.router)
api_router.include_router(samples.router)
api_router.include_router(imports.router)
