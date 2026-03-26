"""
Meal Generation API routes — Hybrid Optimization Engine.
"""

from fastapi import APIRouter, HTTPException
from app.schemas.schemas import (
    MealGenerationRequest,
    MealGenerationResponse,
    DigitalTwinState,
)
from app.services.optimizer import optimize_macros
from app.services.gemini_service import generate_recipe
from app.core.firebase import get_digital_twin, get_user_profile

router = APIRouter(prefix="/api", tags=["generation"])


@router.post("/generate-meal", response_model=MealGenerationResponse)
async def generate_optimal_meal(request: MealGenerationRequest):
    """
    Full meal generation pipeline:
    1. Read current Digital Twin state from Firebase
    2. Run SciPy optimizer to find ideal macro targets
    3. Send targets to Gemini for recipe generation
    4. Return recipe + predicted glucose trajectory
    """
    # 1. Load twin state
    twin_data = get_digital_twin(request.user_id)
    if twin_data:
        twin = DigitalTwinState(**twin_data)
    else:
        twin = DigitalTwinState()

    # 2. Load user profile for dietary restrictions
    profile = get_user_profile(request.user_id)

    # 3. Optimize macros
    optimization = optimize_macros(
        current_state=twin.current_state,
        params=twin.bayesian_parameters,
        intent=request.intent,
    )

    target_macros = {
        "carbs": optimization["carbs"],
        "protein": optimization["protein"],
        "fat": optimization["fat"],
        "fiber": optimization["fiber"],
        "total_calories": optimization["total_calories"],
    }

    # 4. Generate recipe via Gemini
    recipe = await generate_recipe(
        target_macros=target_macros,
        user_profile=profile,
        dietary_restrictions=request.dietary_restrictions,
        intent=request.intent,
    )

    return MealGenerationResponse(
        recipe=recipe,
        trajectory=optimization["trajectory"],
        peak_glucose=optimization["predicted_peak_glucose"],
        optimization_summary=optimization["optimization_note"],
    )
