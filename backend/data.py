vitals_data = {
    "oxygen": {
        "label": "Oxygen",
        "value": 19.5,
        "unit": "%",
        "status": "nominal",
        "note": "MOXIE output stable"
    },
    "water": {
        "label": "Water",
        "value": 87,
        "unit": "%",
        "status": "nominal",
        "note": "Recycler efficiency high"
    },
    "temperature": {
        "label": "Surface Temp",
        "value": -63,
        "unit": "°C",
        "status": "warning",
        "note": "Below safe EVA threshold"
    },
    "radiation": {
        "label": "Radiation",
        "value": 0.67,
        "unit": "mSv/hr",
        "status": "warning",
        "note": "Elevated -- limit EVA to 2hr"
    },
    "dust": {
        "label": "Dust Opacity",
        "value": 0.42,
        "unit": "tau",
        "status": "nominal",
        "note": "Visibility acceptable"
    },
    "gravity": {
        "label": "Gravity",
        "value": 3.72,
        "unit": "m/s²",
        "status": "info",
        "note": "38% of Earth gravity"
    }
}

survival_cards = [
    {
        "id": "oxygen",
        "title": "Oxygen",
        "tag": "MOXIE",
        "tag_color": "#35C5D5",
        "summary": "Produced from CO₂ in Martian atmosphere via MOXIE technology.",
        "detail": "MOXIE electrochemically splits CO₂ into O₂ and CO. Current output supports both fuel production and crew breathing. Backup O₂ canisters carried during all EVAs. Monitor suit O₂ levels every 15 minutes during excursion."
    },
    {
        "id": "food",
        "title": "Food",
        "tag": "NUTRITION",
        "tag_color": "#E76F32",
        "summary": "No resupply possible. All nutrition pre-packed for full mission duration.",
        "detail": "Astronauts carry full supply of pre-packaged calorie-dense meals. NASA research into in-habitat crop growth supplements packaged food. Each crew member requires 3,100 kcal/day during EVA days."
    },
    {
        "id": "water",
        "title": "Water",
        "tag": "RECYCLED",
        "tag_color": "#35C5D5",
        "summary": "Closed-loop recycling system recovers up to 98% of all water.",
        "detail": "ECLSS recycles urine, sweat, and cabin humidity back into drinkable water. Tested extensively on ISS. Emergency water reserves stored separately. EVA suits carry 500ml drinking supply. Current recycler efficiency: 97.3%."
    },
    {
        "id": "power",
        "title": "Power",
        "tag": "FISSION",
        "tag_color": "#FFC857",
        "summary": "Fission surface power ensures 24/7 supply regardless of dust storms.",
        "detail": "Solar panels cannot be sole source -- dust storms last months. NASA Kilopower fission reactor provides 10kW continuous output. Powers habitat life support, communications, and suit charging. Backup battery covers 72hr of essential systems."
    },
    {
        "id": "suits",
        "title": "Spacesuits",
        "tag": "EVA",
        "tag_color": "#E76F32",
        "summary": "Personal spacecraft -- full life support, comms and biometrics built in.",
        "detail": "xEMU suit provides pressurized protection against Mars atmosphere. Built-in PLSS manages O₂, CO₂ scrubbing, temperature and water. Biometric sensors relay heart rate, O₂ saturation and core temp to Mission Control. Max single EVA duration: 8 hours."
    },
    {
        "id": "comms",
        "title": "Communications",
        "tag": "LASER",
        "tag_color": "#35C5D5",
        "summary": "Laser comm system enables high-bandwidth Earth contact with 3-22 min delay.",
        "detail": "Mars-Earth communication delay ranges 3 to 22 minutes depending on orbital positions. DSOC laser system supports high-def video and large data transfers. Local crew comms on UHF radio between suits and habitat. All EVA teams maintain radio contact every 10 minutes."
    },
    {
        "id": "shelter",
        "title": "Shelter",
        "tag": "HABITAT",
        "tag_color": "#E76F32",
        "summary": "Pressurized habitat shields crew from radiation, cold and dust.",
        "detail": "Primary habitat is pre-deployed pressurized surface module. Walls provide shielding against cosmic radiation and UV. Internal pressure maintained at 101.3 kPa. Dust storm protocol: all crew return within 30 minutes of alert. Airlock cycles take 4 minutes to fully depressurize."
    }
]