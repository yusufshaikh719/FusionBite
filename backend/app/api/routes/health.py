"""
Health Telemetry API routes — Sync and status for Health Connect / Apple HealthKit.
"""

from fastapi import APIRouter
from app.schemas.schemas import (
    TelemetrySyncRequest,
    HealthStatusResponse,
)
from app.services.telemetry_service import process_telemetry_sync, get_health_status

router = APIRouter(prefix="/api/health", tags=["health"])


@router.post("/sync", response_model=HealthStatusResponse)
async def sync_telemetry(request: TelemetrySyncRequest):
    """
    Receive batch telemetry data from Health Connect / Apple Health / manual input.
    Processes the data, updates Bayesian parameters, and returns current health status.
    """
    return await process_telemetry_sync(request)


@router.get("/status/{user_id}", response_model=HealthStatusResponse)
async def health_status(user_id: str):
    """
    Get current health telemetry summary without processing new data.
    """
    return get_health_status(user_id)
