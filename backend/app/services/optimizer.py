"""
Hybrid Optimization Engine — SciPy SLSQP Constrained Optimization.

Finds optimal macronutrient targets given the current digital twin state.
Uses the ODE model to evaluate each candidate macro combination and
selects the one that minimizes glucose spike while meeting nutritional needs.
"""

import numpy as np
from scipy.optimize import minimize
from app.schemas.schemas import BayesianParameters, CurrentState
from app.services.ode_model import simulate, get_peak_glucose


# ---------------------------------------------------------------------------
# Intent → Caloric targets
# ---------------------------------------------------------------------------
INTENT_TARGETS = {
    "breakfast": {"calories": (300, 500), "carb_ratio": (0.4, 0.55)},
    "lunch":     {"calories": (400, 700), "carb_ratio": (0.35, 0.50)},
    "dinner":    {"calories": (500, 800), "carb_ratio": (0.35, 0.50)},
    "snack":     {"calories": (100, 250), "carb_ratio": (0.30, 0.50)},
}

# Glucose spike target (mg/dL) — we want to stay under this
MAX_GLUCOSE_TARGET = 140.0
IDEAL_POST_MEAL_GLUCOSE = 120.0


def optimize_macros(
    current_state: CurrentState,
    params: BayesianParameters,
    intent: str = "dinner",
) -> dict:
    """
    Find optimal macro targets using constrained optimization.

    Returns dict with: carbs, protein, fat, fiber, total_calories,
    predicted_peak_glucose, optimization_note.
    """
    targets = INTENT_TARGETS.get(intent, INTENT_TARGETS["dinner"])
    cal_min, cal_max = targets["calories"]
    carb_ratio_min, carb_ratio_max = targets["carb_ratio"]

    # Adjust for current state
    glycogen_pct = current_state.estimated_glycogen
    sensitivity = current_state.insulin_sensitivity_score

    # If glycogen is depleted, allow higher carbs
    if glycogen_pct < 40:
        carb_ratio_min = min(carb_ratio_min + 0.1, 0.6)
        carb_ratio_max = min(carb_ratio_max + 0.1, 0.65)

    # If insulin sensitivity is low (poor sleep), reduce carbs
    if sensitivity < 0.8:
        carb_ratio_max = max(carb_ratio_max - 0.1, 0.25)
        cal_max = int(cal_max * 0.9)

    # Optimization: x = [carbs, protein, fat, fiber]
    # Minimize glucose spike subject to caloric and ratio constraints

    def objective(x):
        carbs, protein, fat, fiber = x
        trajectory = simulate(
            current_state=current_state,
            params=params,
            meal_carbs=carbs,
            meal_protein=protein,
            meal_fat=fat,
            meal_fiber=fiber,
            duration_minutes=180,  # 3-hour window
        )
        peak, _ = get_peak_glucose(trajectory)
        # Penalize deviations from ideal glucose and from caloric targets
        calories = carbs * 4 + protein * 4 + fat * 9
        cal_mid = (cal_min + cal_max) / 2
        glucose_penalty = max(0, peak - IDEAL_POST_MEAL_GLUCOSE) ** 2
        cal_penalty = ((calories - cal_mid) / cal_mid) ** 2 * 100
        return glucose_penalty + cal_penalty

    # Initial guess: moderate meal
    cal_mid = (cal_min + cal_max) / 2
    x0 = [
        cal_mid * ((carb_ratio_min + carb_ratio_max) / 2) / 4,  # carbs
        cal_mid * 0.25 / 4,   # protein
        cal_mid * 0.25 / 9,   # fat
        8.0,                   # fiber
    ]

    # Bounds
    bounds = [
        (10, 150),  # carbs (g)
        (10, 80),   # protein (g)
        (5, 50),    # fat (g)
        (2, 30),    # fiber (g)
    ]

    # Constraints
    def calorie_min_constraint(x):
        return (x[0] * 4 + x[1] * 4 + x[2] * 9) - cal_min

    def calorie_max_constraint(x):
        return cal_max - (x[0] * 4 + x[1] * 4 + x[2] * 9)

    constraints = [
        {"type": "ineq", "fun": calorie_min_constraint},
        {"type": "ineq", "fun": calorie_max_constraint},
    ]

    result = minimize(
        objective,
        x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 200, "ftol": 1e-6},
    )

    carbs, protein, fat, fiber = result.x
    total_calories = round(carbs * 4 + protein * 4 + fat * 9)

    # Get final predicted trajectory with optimized macros
    final_traj = simulate(
        current_state=current_state,
        params=params,
        meal_carbs=carbs,
        meal_protein=protein,
        meal_fat=fat,
        meal_fiber=fiber,
        duration_minutes=240,
    )
    peak, time_to_peak = get_peak_glucose(final_traj)

    # Build optimization note
    notes = []
    if glycogen_pct < 40:
        notes.append("Glycogen depleted — increased carb allowance.")
    if sensitivity < 0.8:
        notes.append("Reduced insulin sensitivity — lowered carb target.")
    if peak > MAX_GLUCOSE_TARGET:
        notes.append(f"Warning: predicted spike of {peak:.0f} mg/dL exceeds target.")

    return {
        "carbs": round(carbs),
        "protein": round(protein),
        "fat": round(fat),
        "fiber": round(fiber),
        "total_calories": total_calories,
        "predicted_peak_glucose": round(peak, 1),
        "time_to_peak_minutes": round(time_to_peak),
        "optimization_note": " ".join(notes) if notes else "Macros optimized for stable glucose.",
        "trajectory": final_traj,
    }
