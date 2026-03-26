"""
Bayesian Parameter Estimation Service.

Adjusts the ODE model parameters based on longitudinal user data.
Uses simple exponential moving average updating (lightweight Bayesian approach)
rather than full MCMC, to keep inference fast (<50ms).
"""

from app.schemas.schemas import BayesianParameters, TelemetryEntry


# ---------------------------------------------------------------------------
# Default priors (population averages)
# ---------------------------------------------------------------------------
DEFAULT_PARAMS = BayesianParameters(
    p1=0.028,
    p2=0.025,
    p3=0.000013,
    gastric_base=0.05,
    glut4_factor=1.0,
)

# Learning rate for exponential moving average updates
ALPHA = 0.1


def update_from_telemetry(
    current_params: BayesianParameters,
    telemetry: list[TelemetryEntry],
) -> BayesianParameters:
    """
    Update Bayesian parameters based on recent telemetry data.

    Key adjustments:
    1. Sleep deprivation → lower insulin sensitivity (p3)
    2. Low HRV → lower insulin sensitivity
    3. High activity → increase GLUT4 factor
    4. Weight changes → adjust baseline parameters

    Returns updated parameters.
    """
    if not telemetry:
        return current_params

    params = current_params.model_copy()

    # Aggregate recent telemetry
    sleep_hours_list = [e.sleep_hours for e in telemetry if e.sleep_hours is not None]
    hrv_list = [e.hrv for e in telemetry if e.hrv is not None]
    active_energy_list = [e.active_energy for e in telemetry if e.active_energy is not None]
    workout_minutes_list = [e.workout_minutes for e in telemetry if e.workout_minutes is not None]

    # --- 1. Sleep → Insulin Sensitivity ---
    if sleep_hours_list:
        avg_sleep = sum(sleep_hours_list) / len(sleep_hours_list)
        # 7-9 hours is optimal; below 6 significantly reduces sensitivity
        sleep_factor = _compute_sleep_factor(avg_sleep)
        params.p3 = _ema_update(params.p3, DEFAULT_PARAMS.p3 * sleep_factor)

    # --- 2. HRV → Insulin Sensitivity ---
    if hrv_list:
        avg_hrv = sum(hrv_list) / len(hrv_list)
        # Higher HRV = better metabolic flexibility
        hrv_factor = _compute_hrv_factor(avg_hrv)
        params.p3 = _ema_update(params.p3, params.p3 * hrv_factor)

    # --- 3. Activity → GLUT4 ---
    if active_energy_list or workout_minutes_list:
        avg_energy = sum(active_energy_list) / len(active_energy_list) if active_energy_list else 0
        avg_workout = sum(workout_minutes_list) / len(workout_minutes_list) if workout_minutes_list else 0
        glut4 = _compute_glut4_factor(avg_energy, avg_workout)
        params.glut4_factor = _ema_update(params.glut4_factor, glut4)

    return params


def compute_insulin_sensitivity_score(params: BayesianParameters) -> float:
    """
    Compute a human-readable insulin sensitivity score (0-2 scale).
    1.0 = population average, >1 = more sensitive, <1 = less sensitive.
    """
    return round(params.p3 / DEFAULT_PARAMS.p3, 2)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_sleep_factor(avg_sleep_hours: float) -> float:
    """
    Map average sleep hours to insulin sensitivity factor.
    <5h → 0.6 (40% reduction)
    5-6h → 0.75
    6-7h → 0.9
    7-9h → 1.0 (optimal)
    >9h → 0.95 (slight reduction)
    """
    if avg_sleep_hours < 5:
        return 0.6
    elif avg_sleep_hours < 6:
        return 0.75
    elif avg_sleep_hours < 7:
        return 0.9
    elif avg_sleep_hours <= 9:
        return 1.0
    else:
        return 0.95


def _compute_hrv_factor(avg_hrv_ms: float) -> float:
    """
    Map HRV to insulin sensitivity modifier.
    Low HRV (<30ms) → 0.85
    Normal (30-60ms) → 1.0
    High (>60ms) → 1.1
    """
    if avg_hrv_ms < 30:
        return 0.85
    elif avg_hrv_ms <= 60:
        return 1.0
    else:
        return 1.1


def _compute_glut4_factor(avg_active_energy: float, avg_workout_minutes: float) -> float:
    """
    Compute GLUT4 activation from activity levels.
    Sedentary → 1.0
    Light activity → 1.2
    Moderate → 1.5
    Heavy → 2.0
    """
    activity_score = (avg_active_energy / 300) + (avg_workout_minutes / 60)

    if activity_score < 0.5:
        return 1.0
    elif activity_score < 1.0:
        return 1.2
    elif activity_score < 2.0:
        return 1.5
    else:
        return min(2.0, 1.0 + activity_score * 0.3)


def _ema_update(current: float, target: float) -> float:
    """Exponential moving average update."""
    return current * (1 - ALPHA) + target * ALPHA
