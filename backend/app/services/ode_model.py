"""
State-Space Engine — Bergman Minimal Model ODE Solver.

Implements a system of Ordinary Differential Equations modeling:
  - G: Blood glucose concentration (mg/dL)
  - X: Remote insulin compartment (interstitial insulin action)
  - I: Plasma insulin concentration (mU/L)
  - Gut: Gut glucose absorption from a meal (mg/dL equivalent)
  - Glyc: Glycogen reserve (% of max, 0-100)

Uses scipy.integrate.solve_ivp for numerical integration.
"""

import numpy as np
from scipy.integrate import solve_ivp
from app.schemas.schemas import (
    BayesianParameters,
    CurrentState,
    GlucoseTrajectoryPoint,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASAL_GLUCOSE = 95.0   # mg/dL  — fasting equilibrium
BASAL_INSULIN = 10.0   # mU/L   — fasting equilibrium
MAX_GLYCOGEN = 500.0   # grams  — total liver + muscle glycogen capacity


def bergman_ode(t, y, params: dict, meal_input: dict):
    """
    Bergman Minimal Model extended with gut absorption and glycogen.

    State vector y = [G, X, I, Gut, Glyc]

    Parameters (from BayesianParameters):
        p1  — glucose effectiveness (rate glucose returns to basal on its own)
        p2  — rate of insulin action onset in the remote compartment
        p3  — insulin sensitivity (how strongly insulin drives glucose down)
        gastric_base — baseline gastric emptying rate
        glut4_factor — exercise-driven glucose uptake multiplier

    Meal input:
        glucose_load — effective glucose entering the gut (g)
        digestion_rate — gastric emptying modifier (scaled by fiber/fat)
        time_of_meal — time offset (min) when the meal was ingested
    """
    G, X, I, Gut, Glyc = y

    p1 = params["p1"]
    p2 = params["p2"]
    p3 = params["p3"]
    gastric_base = params["gastric_base"]
    glut4 = params.get("glut4_factor", 1.0)

    # Gastric emptying rate (modified by meal composition)
    k_gut = gastric_base * meal_input.get("digestion_rate", 1.0)

    # --- Glucose dynamics ---
    # dG/dt = -p1*(G - Gb) - X*G + gut_absorption - glycogen_uptake
    gut_absorption = k_gut * Gut  # glucose flowing from gut into blood
    glycogen_uptake = 0.002 * max(G - BASAL_GLUCOSE, 0) * (Glyc < 95)  # store excess as glycogen
    exercise_uptake = 0.001 * glut4 * G  # GLUT4-mediated uptake

    dG = -p1 * (G - BASAL_GLUCOSE) - X * G + gut_absorption - glycogen_uptake - exercise_uptake

    # --- Remote insulin action ---
    # dX/dt = -p2*X + p3*(I - Ib)
    dX = -p2 * X + p3 * max(I - BASAL_INSULIN, 0)

    # --- Insulin dynamics (simplified beta-cell response) ---
    # Insulin secretion proportional to glucose above basal, with clearance
    insulin_secretion = 0.2 * max(G - BASAL_GLUCOSE, 0)
    insulin_clearance = 0.1 * (I - BASAL_INSULIN)
    dI = insulin_secretion - insulin_clearance

    # --- Gut compartment ---
    # Gut empties into bloodstream at rate k_gut
    dGut = -k_gut * Gut

    # --- Glycogen dynamics ---
    # Increase when glucose is high, decrease during exercise/fasting
    glycogen_replenish = glycogen_uptake * (100.0 / MAX_GLYCOGEN) * 100
    glycogen_depletion = 0.005 * glut4 * Glyc  # exercise depletes glycogen
    dGlyc = glycogen_replenish - glycogen_depletion

    return [dG, dX, dI, dGut, dGlyc]


def simulate(
    current_state: CurrentState,
    params: BayesianParameters,
    meal_carbs: float = 0.0,
    meal_protein: float = 0.0,
    meal_fat: float = 0.0,
    meal_fiber: float = 0.0,
    duration_minutes: float = 240.0,
) -> list[GlucoseTrajectoryPoint]:
    """
    Run a forward ODE simulation from the current state.

    Args:
        current_state: Current physiological state
        params: Bayesian-estimated parameters
        meal_carbs/protein/fat/fiber: Macronutrient grams
        duration_minutes: Simulation duration

    Returns:
        List of trajectory points sampled every 5 minutes
    """
    # Calculate biochemical impact of the meal
    glucose_load = meal_carbs * 0.9 + meal_protein * 0.1  # ~90% of carbs become glucose
    fiber_factor = max(0.3, 1.0 - meal_fiber * 0.02)     # fiber slows digestion
    fat_factor = max(0.4, 1.0 - meal_fat * 0.01)         # fat slows gastric emptying
    digestion_rate = fiber_factor * fat_factor

    meal_input = {
        "glucose_load": glucose_load,
        "digestion_rate": digestion_rate,
    }

    # Convert parameters to dict for the ODE
    param_dict = {
        "p1": params.p1,
        "p2": params.p2,
        "p3": params.p3,
        "gastric_base": params.gastric_base,
        "glut4_factor": params.glut4_factor,
    }

    # Initial conditions [G, X, I, Gut, Glyc]
    y0 = [
        current_state.estimated_glucose,
        0.0,  # remote insulin starts at 0 (delta from basal)
        current_state.estimated_insulin,
        glucose_load,  # meal goes into gut compartment
        current_state.estimated_glycogen,
    ]

    # Time span
    t_span = (0, duration_minutes)
    t_eval = np.arange(0, duration_minutes + 1, 5)  # every 5 minutes

    # Solve
    sol = solve_ivp(
        bergman_ode,
        t_span,
        y0,
        args=(param_dict, meal_input),
        t_eval=t_eval,
        method="RK45",
        max_step=1.0,
    )

    # Build trajectory
    trajectory = []
    for i in range(len(sol.t)):
        trajectory.append(GlucoseTrajectoryPoint(
            time_minutes=float(sol.t[i]),
            glucose=max(float(sol.y[0][i]), 40.0),  # clamp to physiological range
            insulin=max(float(sol.y[2][i]), 0.0),
            glycogen=float(np.clip(sol.y[4][i], 0.0, 100.0)),
        ))

    return trajectory


def get_peak_glucose(trajectory: list[GlucoseTrajectoryPoint]) -> tuple[float, float]:
    """Return (peak_glucose, time_to_peak_minutes) from a trajectory."""
    if not trajectory:
        return (95.0, 0.0)
    peak = max(trajectory, key=lambda p: p.glucose)
    return (peak.glucose, peak.time_minutes)
