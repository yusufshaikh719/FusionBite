"""
Gemini Recipe Generation Service.

Takes optimized macro constraints from SciPy and generates
a natural-language recipe via Google Gemini API with strict JSON output.
"""

import json
import google.generativeai as genai
from app.config import get_settings
from app.schemas.schemas import RecipeResponse, Ingredient


def _init_gemini():
    settings = get_settings()
    genai.configure(api_key=settings.google_ai_api_key)


async def generate_recipe(
    target_macros: dict,
    user_profile: dict | None = None,
    dietary_restrictions: list[str] | None = None,
    intent: str = "dinner",
) -> RecipeResponse:
    """
    Generate a recipe using Gemini that matches the SciPy-optimized macro targets.

    Args:
        target_macros: dict with carbs, protein, fat, fiber keys (in grams)
        user_profile: optional user profile with allergies, diet, etc.
        dietary_restrictions: additional restrictions
        intent: meal type (breakfast/lunch/dinner/snack)

    Returns:
        RecipeResponse with structured recipe data
    """
    _init_gemini()

    # Build context from user profile
    profile_context = ""
    if user_profile:
        restrictions = []
        if user_profile.get("diet"):
            restrictions.append(f"Diet type: {user_profile['diet']}")
        if user_profile.get("allergies") and user_profile["allergies"].lower() != "none":
            restrictions.append(f"Allergies: {user_profile['allergies']}")
        if dietary_restrictions:
            restrictions.extend(dietary_restrictions)
        if restrictions:
            profile_context = f"\n  Dietary restrictions: {', '.join(restrictions)}"

    prompt = f"""Generate a {intent} recipe with the following EXACT macronutrient targets:
  - Carbohydrates: {target_macros['carbs']}g
  - Protein: {target_macros['protein']}g
  - Fat: {target_macros['fat']}g
  - Fiber: {target_macros['fiber']}g
  - Total Calories: approximately {target_macros.get('total_calories', 'calculate from macros')} kcal
{profile_context}

  Requirements:
  - Use whole, real food ingredients that are commonly available
  - Prioritize high-fiber ingredients to slow glucose absorption
  - The recipe should be practical and delicious
  - Match the macros as closely as possible (within 10% tolerance)
  - The meal name should describe the main ingredients

  Respond ONLY with a JSON object in this exact format, no markdown:
  {{
    "name": "Descriptive Meal Name",
    "ingredients": [
      {{"item": "ingredient name", "amount": 100, "unit": "g"}},
      {{"item": "ingredient name", "amount": 150, "unit": "g"}}
    ],
    "directions": [
      "Step 1 with cooking details",
      "Step 2 with temperature and time",
      "Step 3 with presentation"
    ]
  }}"""

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)

    # Parse JSON response
    text = response.text.strip()
    # Remove markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    recipe_data = json.loads(text)

    return RecipeResponse(
        name=recipe_data["name"],
        ingredients=[Ingredient(**ing) for ing in recipe_data["ingredients"]],
        directions=recipe_data["directions"],
        target_macros=target_macros,
        nutrition={
            "calories": target_macros.get("total_calories", 0),
            "carbs": target_macros["carbs"],
            "protein": target_macros["protein"],
            "fat": target_macros["fat"],
            "fiber": target_macros["fiber"],
        },
    )
