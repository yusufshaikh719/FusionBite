# --- START OF FILE backend/llm_agent.py ---
import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_AI_API_KEY")
client = genai.Client(api_key=API_KEY)

def generate_recipe(profile, optimal_macros):
    prompt = f"""
    You are a biomedical nutrition digital twin assistant.
    The SciPy optimization engine has determined the user requires EXACTLY the following macros 
    right now to maintain a stable blood glucose state-space:
    - Carbs: {optimal_macros['carbs']}g
    - Protein: {optimal_macros['protein']}g
    - Fat: {optimal_macros['fat']}g
    
    User Constraints:
    - Diet: {profile.diet}
    - Allergies: {profile.allergies}
    - Medical Conditions: {profile.medicalConditions}

    Generate a recipe that strictly adheres to these macro boundaries.
    Respond ONLY with a valid JSON object in this exact format:
    {{
      "name": "Meal Name",
      "ingredients": [
        {{"item": "ingredient1", "amount": 100, "unit": "g"}}
      ],
      "directions": [
        "Step 1", "Step 2"
      ],
      "nutrition": {{
         "calories": {optimal_macros['calories']},
         "protein": {optimal_macros['protein']},
         "carbs": {optimal_macros['carbs']},
         "fat": {optimal_macros['fat']}
      }}
    }}
    """
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    
    text_response = response.text.replace('```json', '').replace('```', '').strip()
    return json.loads(text_response)
# --- END OF FILE backend/llm_agent.py ---