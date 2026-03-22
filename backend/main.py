# --- START OF FILE backend/main.py ---
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from metabolic_engine import optimize_meal_macros, calibrate_maml_model
from llm_agent import generate_recipe
import uvicorn

app = FastAPI(title="FusionBite Digital Twin API")

# Pydantic models for structured data exchange
class UserBiometrics(BaseModel):
    age: int
    gender: str
    height: float
    weight: float
    activityLevel: str
    fastingGlucose: float
    fastingInsulin: float
    hba1c: float
    diet: str
    allergies: str
    medicalConditions: str

class MealLog(BaseModel):
    timestamp: str  # ISO 8601
    carbs: float
    protein: float
    fat: float

class MealOptimizationRequest(BaseModel):
    user_profile: UserBiometrics
    recent_meals: List[MealLog]

@app.post("/calibrate_metabolism")
async def calibrate_metabolism(profile: UserBiometrics):
    """
    Endpoint to run few-shot MAML on the user's base 3-5 data points.
    Updates the user's specific insulin sensitivity weights.
    """
    try:
        user_weights = calibrate_maml_model(profile)
        return {"status": "success", "calibrated_weights": user_weights}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_optimal_meal")
async def generate_optimal_meal(request: MealOptimizationRequest):
    """
    1. Runs the state-space ODE to find current blood glucose.
    2. Runs SciPy Constrained Optimization to find exact macros needed.
    3. Calls LLM with SciPy constraints to generate the recipe.
    """
    try:
        # Step 1 & 2: SciPy Constrained Optimization
        optimal_macros = optimize_meal_macros(request.user_profile, request.recent_meals)
        
        # Step 3: LLM Recipe Generation based on strict SciPy bounds
        recipe = generate_recipe(request.user_profile, optimal_macros)
        
        return {
            "status": "success",
            "optimal_macros": optimal_macros,
            "recipe": recipe
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
# --- END OF FILE backend/main.py ---