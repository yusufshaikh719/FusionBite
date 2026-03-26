"""
Telemetry Engine — Health Data Processing.

Processes incoming wearable/health data from:
  - Health Connect (Android ADK)
  - Apple HealthKit
  - Manual user input

Calculates physiological modifiers and updates the Digital Twin.
"""

from datetime import datetime
from app.schemas.schemas import (
    TelemetryEntry,
    TelemetrySyncRequest,
    HealthStatusResponse,
    BayesianParameters,
    CurrentState,
    DigitalTwinState,
)
from app.services.bayesian import update_from_telemetry, compute_insulin_sensitivity_score
from app.core.firebase import (
    save_telemetry,
    get_telemetry,
    get_digital_twin,
    save_digital_twin,
)


async def process_telemetry_sync(request: TelemetrySyncRequest) -> HealthStatusResponse:
    """
    Process a batch of telemetry data, update parameters, and return status.

    1. Save raw telemetry to Firebase
    2. Update Bayesian parameters based on new data
    3. Update Digital Twin state
    4. Return current health status
    """
    user_id = request.user_id

    # 1. Save each entry with timestamp
    for entry in request.entries:
        entry_dict = entry.model_dump(exclude_none=True)
        if not entry_dict.get("timestamp"):
            entry_dict["timestamp"] = datetime.utcnow().isoformat()
        save_telemetry(user_id, entry_dict)

    # 2. Get all recent telemetry and current twin
    all_telemetry = get_telemetry(user_id, limit=30)
    telemetry_entries = [TelemetryEntry(**t) for t in all_telemetry]

    twin_data = get_digital_twin(user_id)
    if twin_data:
        twin = DigitalTwinState(**twin_data)
    else:
        twin = DigitalTwinState()

    # 3. Update Bayesian parameters
    updated_params = update_from_telemetry(twin.bayesian_parameters, telemetry_entries)
    sensitivity_score = compute_insulin_sensitivity_score(updated_params)

    # Update twin state
    twin.bayesian_parameters = updated_params
    twin.current_state.insulin_sensitivity_score = sensitivity_score
    twin.current_state.timestamp = datetime.utcnow().isoformat()

    # 4. Save back to Firebase
    save_digital_twin(user_id, twin.model_dump())

    # 5. Build health status response
    return _build_health_status(telemetry_entries, updated_params)


def get_health_status(user_id: str) -> HealthStatusResponse:
    """Get current health telemetry summary without processing new data."""
    all_telemetry = get_telemetry(user_id, limit=30)
    telemetry_entries = [TelemetryEntry(**t) for t in all_telemetry]

    twin_data = get_digital_twin(user_id)
    if twin_data:
        twin = DigitalTwinState(**twin_data)
        params = twin.bayesian_parameters
    else:
        params = BayesianParameters()

    return _build_health_status(telemetry_entries, params)


def _build_health_status(
    entries: list[TelemetryEntry],
    params: BayesianParameters,
) -> HealthStatusResponse:
    """Build a HealthStatusResponse from telemetry data."""
    today = datetime.utcnow().date().isoformat()

    today_steps = 0
    today_energy = 0.0
    last_sleep = None
    last_hrv = None
    last_rhr = None
    last_sync = None

    for entry in entries:
        if entry.timestamp:
            last_sync = entry.timestamp

        # Aggregate today's data
        entry_date = entry.timestamp[:10] if entry.timestamp else ""
        if entry_date == today:
            today_steps += entry.steps or 0
            today_energy += entry.active_energy or 0

        # Most recent values
        if entry.sleep_hours is not None:
            last_sleep = entry.sleep_hours
        if entry.hrv is not None:
            last_hrv = entry.hrv
        if entry.resting_heart_rate is not None:
            last_rhr = entry.resting_heart_rate

    sensitivity_mod = compute_insulin_sensitivity_score(params)

    return HealthStatusResponse(
        last_sync=last_sync,
        today_steps=today_steps,
        today_active_energy=round(today_energy, 1),
        last_sleep_hours=last_sleep,
        last_hrv=last_hrv,
        resting_heart_rate=last_rhr,
        insulin_sensitivity_modifier=sensitivity_mod,
        glut4_modifier=params.glut4_factor,
    )
