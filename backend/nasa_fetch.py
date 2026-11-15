import requests
from config import NASA_API_KEY

def fetch_nasa_weather():
    try:
        url = f"https://api.nasa.gov/insight_weather/?api_key={NASA_API_KEY}&feedtype=json&ver=1.0"
        res = requests.get(url, timeout=10)
        raw = res.json()
        sol_keys = raw.get('sol_keys', [])
        if not sol_keys:
            return None, None

        latest_sol = sol_keys[-1]
        sol_data = raw[latest_sol]

        vitals = {
    "oxygen": {
        "label": "Oxygen",
        "value": 19.5,
        "unit": "%",
        "status": "nominal",
        "note": "MOXIE output stable",
        "source": "sim"
    },
    "water": {
        "label": "Water",
        "value": 87,
        "unit": "%",
        "status": "nominal",
        "note": "Recycler efficiency high",
        "source": "sim"
    },
    "temperature": {
        "label": "Surface Temp",
        "value": round(sol_data['AT']['av'], 1),
        "unit": "°C",
        "status": "warning" if sol_data['AT']['av'] < -50 else "nominal",
        "note": f"Min: {round(sol_data['AT']['mn'], 1)}°C Max: {round(sol_data['AT']['mx'], 1)}°C",
        "source": "nasa"
    },
    "pressure": {
        "label": "Pressure",
        "value": round(sol_data['PRE']['av'], 1),
        "unit": "Pa",
        "status": "nominal",
        "note": f"Min: {round(sol_data['PRE']['mn'], 1)} Max: {round(sol_data['PRE']['mx'], 1)}",
        "source": "nasa"
    },
    "wind": {
        "label": "Wind Speed",
        "value": round(sol_data['HWS']['av'], 1),
        "unit": "m/s",
        "status": "nominal" if sol_data['HWS']['av'] < 10 else "warning",
        "note": f"Max gust: {round(sol_data['HWS']['mx'], 1)} m/s",
        "source": "nasa"
    },
    "gravity": {
        "label": "Gravity",
        "value": 3.72,
        "unit": "m/s²",
        "status": "info",
        "note": "38% of Earth gravity",
        "source": "sim"
    }
}

        charts = {
            "sol": latest_sol,
            "temperature": {
                "avg": round(sol_data['AT']['av'], 1),
                "min": round(sol_data['AT']['mn'], 1),
                "max": round(sol_data['AT']['mx'], 1)
            },
            "pressure": {
                "avg": round(sol_data['PRE']['av'], 1),
                "min": round(sol_data['PRE']['mn'], 1),
                "max": round(sol_data['PRE']['mx'], 1)
            },
            "wind": {
                "avg": round(sol_data['HWS']['av'], 1),
                "min": round(sol_data['HWS']['mn'], 1),
                "max": round(sol_data['HWS']['mx'], 1)
            },
            "all_sols": []
        }
        for sol in sol_keys:
            if 'AT' in raw[sol] and 'PRE' in raw[sol]:
                charts['all_sols'].append({
                    "sol": sol,
                    "temp": round(raw[sol]['AT']['av'], 1),
                    "pressure": round(raw[sol]['PRE']['av'], 1),
                    "wind": round(raw[sol]['HWS']['av'], 1) if 'HWS' in raw[sol] else 0
                })

        return vitals, charts

    except Exception as e:
        print(f"NASA API error: {e}")
        return None, None