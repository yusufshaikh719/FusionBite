"""
Food API routes — FDA search and meal logging.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.schemas.schemas import (
    FoodSearchResult,
    FoodLogRequest,
    FoodLogResponse,
    DigitalTwinState,
    BiochemicalVector,
)
from app.services.fda_service import search_foods, get_food_details, compute_biochemical_vector
from app.services.ode_model import simulate, get_peak_glucose
from app.core.firebase import get_digital_twin, save_digital_twin, save_state_log

router = APIRouter(prefix="/api/food", tags=["food"])


@router.get("/search", response_model=list[FoodSearchResult])
async def food_search(q: str, limit: int = 10):
    """Search FDA FoodData Central for foods."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return await search_foods(q, limit=limit)


@router.post("/log", response_model=FoodLogResponse)
async def log_food(request: FoodLogRequest):
    """
    Log a food item and perturb the Digital Twin.

    1. Look up nutrition from FDA
    2. Compute Biochemical Impact Vector
    3. Run ODE simulation to predict effect
    4. Update digital twin state
    5. Save to state log
    """
    # 1. Get food nutrition
    if request.fdc_id:
        food = await get_food_details(request.fdc_id)
        if not food:
            raise HTTPException(status_code=404, detail="Food not found in FDA database")
    else:
        results = await search_foods(request.food_name, limit=1)
        if not results:
            raise HTTPException(status_code=404, detail=f"No FDA data found for '{request.food_name}'")
        food = results[0]

    # Scale to actual amount
    scale = request.amount_grams / 100.0
    carbs = food.carbs * scale
    protein = food.protein * scale
    fat = food.fat * scale
    fiber = food.fiber * scale

    # 2. Compute biochemical vector
    vector = compute_biochemical_vector(
        carbs=food.carbs, protein=food.protein,
        fat=food.fat, fiber=food.fiber,
        amount_grams=request.amount_grams,
    )

    # 3. Load twin and simulate
    twin_data = get_digital_twin(request.user_id)
    if twin_data:
        twin = DigitalTwinState(**twin_data)
    else:
        twin = DigitalTwinState()

    trajectory = simulate(
        current_state=twin.current_state,
        params=twin.bayesian_parameters,
        meal_carbs=carbs,
        meal_protein=protein,
        meal_fat=fat,
        meal_fiber=fiber,
        duration_minutes=240,
    )

    # 4. Update twin state with post-meal prediction
    if trajectory:
        # Use the 60-minute mark as "current" estimate after eating
        idx_60 = min(12, len(trajectory) - 1)  # 12 * 5min = 60min
        twin.current_state.estimated_glucose = trajectory[idx_60].glucose
        twin.current_state.estimated_glycogen = trajectory[idx_60].glycogen
        twin.current_state.timestamp = datetime.utcnow().isoformat()
        save_digital_twin(request.user_id, twin.model_dump())

    # 5. Save state log
    save_state_log(request.user_id, {
        "type": "meal",
        "timestamp": datetime.utcnow().isoformat(),
        "food_name": food.description,
        "amount_grams": request.amount_grams,
        "fda_data": {
            "fdc_id": food.fdc_id,
            "calories": round(food.calories * scale),
            "carbs": round(carbs, 1),
            "protein": round(protein, 1),
            "fat": round(fat, 1),
            "fiber": round(fiber, 1),
        },
        "vectors": vector.model_dump(),
    })

    return FoodLogResponse(
        vector=vector,
        trajectory=trajectory,
        updated_state=twin.current_state,
    )
