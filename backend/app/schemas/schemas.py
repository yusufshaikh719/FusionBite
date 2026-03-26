"""
Pydantic models for the FusionBite API.
Defines request/response schemas for all endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ---------------------------------------------------------------------------
# Bayesian / Digital Twin
# ---------------------------------------------------------------------------

class BayesianParameters(BaseModel):
    """Estimated physiological parameters for the ODE model."""
    p1: float = Field(0.028, description="Glucose effectiveness (min^-1)")
    p2: float = Field(0.025, description="Insulin action rate (min^-1)")
    p3: float = Field(0.000013, description="Insulin sensitivity (mU/L/min^-2)")
    gastric_base: float = Field(0.05, description="Baseline gastric emptying rate (min^-1)")
    glut4_factor: float = Field(1.0, description="GLUT4 activation multiplier (1.0 = resting)")


class CurrentState(BaseModel):
    """Current estimated physiological state."""
    timestamp: str = ""
    estimated_glucose: float = Field(95.0, description="Estimated blood glucose (mg/dL)")
    estimated_insulin: float = Field(10.0, description="Estimated plasma insulin (mU/L)")
    estimated_glycogen: float = Field(80.0, description="Estimated glycogen reserve (%)")
    insulin_sensitivity_score: float = Field(1.0, description="Relative insulin sensitivity (0-2)")


class DigitalTwinState(BaseModel):
    """Full digital twin snapshot stored in Firebase."""
    bayesian_parameters: BayesianParameters = Field(default_factory=BayesianParameters)
    current_state: CurrentState = Field(default_factory=CurrentState)


# ---------------------------------------------------------------------------
# Telemetry
# ---------------------------------------------------------------------------

class TelemetryEntry(BaseModel):
    """A single telemetry data point from Health Connect / Apple Health."""
    timestamp: str = ""
    sleep_hours: Optional[float] = None
    sleep_score: Optional[float] = None
    active_energy: Optional[float] = None  # kcal
    resting_heart_rate: Optional[float] = None  # bpm
    hrv: Optional[float] = None  # ms
    steps: Optional[int] = None
    workout_minutes: Optional[float] = None
    workout_type: Optional[str] = None  # e.g. "running", "cycling"
    weight: Optional[float] = None  # kg


class TelemetrySyncRequest(BaseModel):
    """Batch sync of telemetry data from health apps."""
    user_id: str
    entries: list[TelemetryEntry]
    source: str = "manual"  # "health_connect" | "apple_health" | "manual"


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

class GlucoseTrajectoryPoint(BaseModel):
    """A single point on the glucose prediction curve."""
    time_minutes: float
    glucose: float
    insulin: float
    glycogen: float


class SimulationRequest(BaseModel):
    """Request to run a forward ODE simulation."""
    user_id: str
    duration_minutes: float = 240.0  # 4 hours default
    meal_carbs: float = 0.0
    meal_protein: float = 0.0
    meal_fat: float = 0.0
    meal_fiber: float = 0.0


class SimulationResponse(BaseModel):
    """Response from ODE simulation."""
    trajectory: list[GlucoseTrajectoryPoint]
    peak_glucose: float
    time_to_peak_minutes: float
    final_glucose: float
    current_state: CurrentState


# ---------------------------------------------------------------------------
# Food / Mapping Engine
# ---------------------------------------------------------------------------

class BiochemicalVector(BaseModel):
    """The mathematical representation of a food's impact."""
    glucose_load: float = Field(description="Effective glucose load (g)")
    digestion_rate: float = Field(description="Gastric emptying rate modifier")
    insulin_demand: float = Field(description="Expected insulin demand")
    glycemic_index_estimate: float = Field(description="Estimated GI (0-100)")


class FoodSearchResult(BaseModel):
    """A single FDA food search result."""
    fdc_id: int
    description: str
    calories: float = 0.0
    carbs: float = 0.0
    protein: float = 0.0
    fat: float = 0.0
    fiber: float = 0.0


class FoodLogRequest(BaseModel):
    """Request to log a food item and perturb the digital twin."""
    user_id: str
    food_name: str
    amount_grams: float = 100.0
    fdc_id: Optional[int] = None


class FoodLogResponse(BaseModel):
    """Response after logging food."""
    vector: BiochemicalVector
    trajectory: list[GlucoseTrajectoryPoint]
    updated_state: CurrentState


# ---------------------------------------------------------------------------
# Meal Generation / Optimization Engine
# ---------------------------------------------------------------------------

class Ingredient(BaseModel):
    """A recipe ingredient."""
    item: str
    amount: float
    unit: str = "g"


class RecipeResponse(BaseModel):
    """A generated recipe from Gemini."""
    name: str
    ingredients: list[Ingredient]
    directions: list[str]
    target_macros: dict
    nutrition: dict


class MealGenerationRequest(BaseModel):
    """Request to generate an optimal meal."""
    user_id: str
    intent: str = "dinner"  # "breakfast", "lunch", "dinner", "snack"
    dietary_restrictions: Optional[list[str]] = None


class MealGenerationResponse(BaseModel):
    """Full meal generation response with recipe + trajectory."""
    recipe: RecipeResponse
    trajectory: list[GlucoseTrajectoryPoint]
    peak_glucose: float
    optimization_summary: str


# ---------------------------------------------------------------------------
# Health Status
# ---------------------------------------------------------------------------

class HealthStatusResponse(BaseModel):
    """Current health telemetry summary."""
    last_sync: Optional[str] = None
    today_steps: int = 0
    today_active_energy: float = 0.0
    last_sleep_hours: Optional[float] = None
    last_hrv: Optional[float] = None
    resting_heart_rate: Optional[float] = None
    insulin_sensitivity_modifier: float = 1.0
    glut4_modifier: float = 1.0


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardResponse(BaseModel):
    """All data needed for the Live Digital Twin dashboard."""
    twin_state: DigitalTwinState
    health_status: HealthStatusResponse
    glucose_trajectory: list[GlucoseTrajectoryPoint]
