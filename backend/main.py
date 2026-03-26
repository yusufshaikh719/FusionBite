"""
FusionBite Backend — FastAPI Application Entry Point.

This is the mathematical brain of the Digital Twin system.
It exposes APIs for:
  - /api/simulate        — ODE forward simulation
  - /api/dashboard/{id}  — Live dashboard data
  - /api/generate-meal   — Hybrid optimization + Gemini recipe
  - /api/food/search     — FDA food search
  - /api/food/log        — Food logging with twin perturbation
  - /api/health/sync     — Health telemetry ingestion
  - /api/health/status   — Health status summary
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api.routes import simulation, food, generation, health

app = FastAPI(
    title="FusionBite API",
    description="Whole-Body Digital Twin Backend",
    version="1.0.0",
)

# CORS — allow ALL origins so Expo web (any port) can reach the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(simulation.router)
app.include_router(food.router)
app.include_router(generation.router)
app.include_router(health.router)


@app.get("/")
async def root():
    return {
        "service": "FusionBite Digital Twin API",
        "version": "1.0.0",
        "status": "running",
        "engines": [
            "State-Space (ODE)",
            "Mapping (FDA)",
            "Optimization (SciPy + Gemini)",
            "Telemetry (Health Connect / Apple HealthKit)",
        ],
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
