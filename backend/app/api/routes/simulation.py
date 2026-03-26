"""
Simulation API routes — Run ODE forward simulations.
"""

from fastapi import APIRouter, HTTPException
from app.schemas.schemas import (
    SimulationRequest,
    SimulationResponse,
    DigitalTwinState,
    CurrentState,
    BayesianParameters,
    DashboardResponse,
    HealthStatusResponse,
)
from app.services.ode_model import simulate, get_peak_glucose
from app.services.telemetry_service import get_health_status
from app.core.firebase import get_digital_twin, get_user_profile

router = APIRouter(prefix="/api", tags=["simulation"])


@router.post("/simulate", response_model=SimulationResponse)
async def run_simulation(request: SimulationRequest):
    """
    Run a forward ODE simulation from the user's current Digital Twin state.
    Returns predicted glucose/insulin/glycogen trajectory.
    """
    # Load user's twin state from Firebase
    twin_data = get_digital_twin(request.user_id)
    if twin_data:
        twin = DigitalTwinState(**twin_data)
    else:
        twin = DigitalTwinState()

    trajectory = simulate(
        current_state=twin.current_state,
        params=twin.bayesian_parameters,
        meal_carbs=request.meal_carbs,
        meal_protein=request.meal_protein,
        meal_fat=request.meal_fat,
        meal_fiber=request.meal_fiber,
        duration_minutes=request.duration_minutes,
    )

    peak, time_to_peak = get_peak_glucose(trajectory)

    return SimulationResponse(
        trajectory=trajectory,
        peak_glucose=round(peak, 1),
        time_to_peak_minutes=round(time_to_peak),
        final_glucose=round(trajectory[-1].glucose, 1) if trajectory else 95.0,
        current_state=twin.current_state,
    )


@router.get("/dashboard/{user_id}", response_model=DashboardResponse)
async def get_dashboard(user_id: str):
    """
    Get all data needed for the Live Digital Twin dashboard.
    """
    # Load twin state
    twin_data = get_digital_twin(user_id)
    if twin_data:
        twin = DigitalTwinState(**twin_data)
    else:
        twin = DigitalTwinState()

    # Get health status
    health = get_health_status(user_id)

    # Run a baseline trajectory (no meal, just current state forward)
    trajectory = simulate(
        current_state=twin.current_state,
        params=twin.bayesian_parameters,
        duration_minutes=120,
    )

    return DashboardResponse(
        twin_state=twin,
        health_status=health,
        glucose_trajectory=trajectory,
    )
