# --- START OF FILE backend/metabolic_engine.py ---
import numpy as np
from scipy.integrate import odeint
from scipy.optimize import minimize
import torch
import torch.nn as nn

# --- 1. MAML Scaffolding (Few-Shot Calibration) ---
class MetabolicPriorNet(nn.Module):
    def __init__(self):
        super(MetabolicPriorNet, self).__init__()
        # Predicting Insulin Sensitivity (Si) and Glucose Effectiveness (Sg)
        self.fc = nn.Sequential(
            nn.Linear(3, 16), # Inputs: Fasting Glu, Fasting Ins, HbA1c
            nn.ReLU(),
            nn.Linear(16, 2)  # Outputs: Si, Sg
        )

    def forward(self, x):
        return self.fc(x)

def calibrate_maml_model(profile):
    """
    In a full MAML pipeline, you'd calculate inner-loop gradients here
    using the 3-5 data points to fine-tune the global prior model.
    """
    model = MetabolicPriorNet()
    # Mocking input tensor: [Fasting Glucose, Fasting Insulin, HbA1c]
    x = torch.tensor([[profile.fastingGlucose, profile.fastingInsulin, profile.hba1c]], dtype=torch.float32)
    
    with torch.no_grad():
        params = model(x).numpy()[0]
    
    return {"Si": float(params[0]), "Sg": float(params[1])}

# --- 2. ODE Solver (Bergman Minimal Model representation) ---
def bergman_ode(y, t, p, meal_carbs):
    """
    y[0] = G (Plasma Glucose)
    y[1] = X (Insulin action)
    y[2] = I (Plasma Insulin)
    """
    G, X, I = y
    p1, p2, p3, n, Gb, Ib = p
    
    # Simple gut absorption rate (Ra) mock
    Ra = (meal_carbs / 10.0) * np.exp(-0.05 * t) if t > 0 else 0

    dG_dt = -(p1 + X)*G + p1*Gb + Ra
    dX_dt = -p2*X + p3*(I - Ib)
    dI_dt = n*(G - Gb) - n*(I - Ib) # Simplified
    
    return [dG_dt, dX_dt, dI_dt]

# --- 3. SciPy Constrained Optimization ---
def optimize_meal_macros(profile, recent_meals):
    """
    Uses SciPy minimize to find the perfect macro balance to keep 
    AUC (Area Under Curve) of Glucose < 140 mg/dL.
    """
    # Baseline constraints based on profile
    cal_target = 2000 if profile.gender == 'Male' else 1600
    
    # Objective function: Minimize glucose spikes
    def objective(macros):
        carbs, protein, fat = macros
        # Initial conditions (Mocking state vector)
        y0 = [profile.fastingGlucose, 0, profile.fastingInsulin] 
        t = np.linspace(0, 120, 120) # Simulate 2 hours post-meal
        p = [0.028, 0.025, 0.00013, 0.26, profile.fastingGlucose, profile.fastingInsulin]
        
        # Solve ODE
        sol = odeint(bergman_ode, y0, t, args=(p, carbs))
        glucose_curve = sol[:, 0]
        
        # Penalty for glucose > 140
        spike_penalty = np.sum(np.maximum(0, glucose_curve - 140)**2)
        # Penalty for deviating from healthy macro ratios
        balance_penalty = (carbs - 40)**2 + (protein - 30)**2 + (fat - 15)**2
        
        return spike_penalty + balance_penalty * 0.1

    # Constraints (e.g., minimum 20g protein, max 80g carbs)
    bounds = ((10, 80), (20, 60), (5, 30))
    initial_guess = [40, 30, 15]

    result = minimize(objective, initial_guess, bounds=bounds, method='SLSQP')
    
    opt_c, opt_p, opt_f = result.x
    opt_calories = (opt_c * 4) + (opt_p * 4) + (opt_f * 9)
    
    return {
        "carbs": round(opt_c, 1),
        "protein": round(opt_p, 1),
        "fat": round(opt_f, 1),
        "calories": round(opt_calories, 1)
    }
# --- END OF FILE backend/metabolic_engine.py ---