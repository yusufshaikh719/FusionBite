"""
Mapping Engine — FDA FoodData Central API Integration.

Translates human food into mathematical Biochemical Impact Vectors
for the State-Space Engine.
"""

import httpx
from app.config import get_settings
from app.schemas.schemas import FoodSearchResult, BiochemicalVector


# FDA nutrient IDs
NUTRIENT_IDS = {
    "calories": 1008,
    "protein": 1003,
    "fat": 1004,
    "carbs": 1005,
    "fiber": 1079,
    "sugar": 2000,
}


async def search_foods(query: str, limit: int = 10) -> list[FoodSearchResult]:
    """
    Search FDA FoodData Central for foods matching the query.
    Returns parsed results with macronutrient data.
    """
    settings = get_settings()
    url = f"{settings.fda_api_endpoint}/foods/search"
    params = {
        "api_key": settings.fda_api_key,
        "query": query,
        "pageSize": limit,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for food in data.get("foods", [])[:limit]:
        nutrients = {n["nutrientId"]: n.get("value", 0) for n in food.get("foodNutrients", [])}
        results.append(FoodSearchResult(
            fdc_id=food.get("fdcId", 0),
            description=food.get("description", ""),
            calories=nutrients.get(NUTRIENT_IDS["calories"], 0),
            carbs=nutrients.get(NUTRIENT_IDS["carbs"], 0),
            protein=nutrients.get(NUTRIENT_IDS["protein"], 0),
            fat=nutrients.get(NUTRIENT_IDS["fat"], 0),
            fiber=nutrients.get(NUTRIENT_IDS["fiber"], 0),
        ))

    return results


async def get_food_details(fdc_id: int) -> FoodSearchResult | None:
    """Fetch detailed nutrient data for a specific food by FDC ID."""
    settings = get_settings()
    url = f"{settings.fda_api_endpoint}/food/{fdc_id}"
    params = {"api_key": settings.fda_api_key}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10.0)
        if resp.status_code != 200:
            return None
        data = resp.json()

    # Try labelNutrients first (branded foods), then foodNutrients
    label = data.get("labelNutrients", {})
    if label:
        return FoodSearchResult(
            fdc_id=fdc_id,
            description=data.get("description", ""),
            calories=label.get("calories", {}).get("value", 0),
            carbs=label.get("carbohydrates", {}).get("value", 0),
            protein=label.get("protein", {}).get("value", 0),
            fat=label.get("fat", {}).get("value", 0),
            fiber=label.get("fiber", {}).get("value", 0),
        )

    # Fall back to foodNutrients array
    nutrients = {}
    for n in data.get("foodNutrients", []):
        nid = n.get("nutrient", {}).get("id") or n.get("nutrientId")
        nutrients[nid] = n.get("amount", n.get("value", 0))

    return FoodSearchResult(
        fdc_id=fdc_id,
        description=data.get("description", ""),
        calories=nutrients.get(NUTRIENT_IDS["calories"], 0),
        carbs=nutrients.get(NUTRIENT_IDS["carbs"], 0),
        protein=nutrients.get(NUTRIENT_IDS["protein"], 0),
        fat=nutrients.get(NUTRIENT_IDS["fat"], 0),
        fiber=nutrients.get(NUTRIENT_IDS["fiber"], 0),
    )


def compute_biochemical_vector(
    carbs: float, protein: float, fat: float, fiber: float, amount_grams: float = 100.0
) -> BiochemicalVector:
    """
    Translate macronutrient grams into a Biochemical Impact Vector.

    This vector tells the ODE model HOW the food will impact the body:
    - glucose_load: effective glucose entering the bloodstream
    - digestion_rate: how quickly the stomach empties (fiber/fat slow it)
    - insulin_demand: expected insulin response
    - glycemic_index_estimate: rough GI estimate
    """
    scale = amount_grams / 100.0

    # Effective glucose = most carbs become glucose, protein contributes ~10%
    glucose_load = (carbs * 0.9 + protein * 0.1) * scale

    # Gastric emptying rate: fiber and fat both slow digestion
    fiber_modifier = max(0.3, 1.0 - (fiber * scale) * 0.02)
    fat_modifier = max(0.4, 1.0 - (fat * scale) * 0.01)
    digestion_rate = fiber_modifier * fat_modifier

    # Insulin demand correlates with glucose load and speed of absorption
    insulin_demand = glucose_load * digestion_rate

    # Rough GI estimate: high fiber/fat/protein = lower GI
    base_gi = 70.0  # moderate baseline
    gi_reduction = (fiber * 2 + fat * 1.5 + protein * 0.5) * scale
    glycemic_index_estimate = max(10.0, min(100.0, base_gi - gi_reduction))

    return BiochemicalVector(
        glucose_load=round(glucose_load, 1),
        digestion_rate=round(digestion_rate, 3),
        insulin_demand=round(insulin_demand, 1),
        glycemic_index_estimate=round(glycemic_index_estimate, 1),
    )
