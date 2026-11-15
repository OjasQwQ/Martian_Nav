import math
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from html.parser import HTMLParser


MCD_CGI_URL = "https://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py"
MCD_SOURCE_URL = "https://www-mars.lmd.jussieu.fr/mcd_python/"
MCD_SCENARIO = "climatology average solar scenario"
MCD_VARIABLE_GROUPS = (
    ("tsurf", "ps", "wind", "dod"),
    ("vmr_co2", "vmr_n2", "vmr_ar", "vmr_o2"),
    ("vmr_co", "vmr_o3", "vmr_h2o", "fluxsurf_dn_sw"),
)
MARS_SOL_SECONDS = 88775.245
MARS_YEAR_SOLS = 668.6
SURVIVAL_REFERENCE_CARDS = [
    {
        "id": "oxygen",
        "title": "Oxygen & life support",
        "tag": "MOXIE",
        "tag_color": "#35C5D5",
        "summary": "The modeled outdoor atmosphere is not breathable; ambient O₂ is only a trace gas.",
        "detail": (
            "NASA's MOXIE technology demonstration produced 122 grams of oxygen in total "
            "from Perseverance's landing through its final run in August 2023. It was an "
            "intermittent rover experiment, not an operating crew oxygen plant. This map "
            "does not assume a local oxygen supply or life-support system."
        ),
        "source_url": (
            "https://science.nasa.gov/mission/mars-2020-perseverance/"
            "science-instruments/#moxie"
        ),
    },
    {
        "id": "toxins",
        "title": "Toxic gases & regolith",
        "tag": "CAUTION",
        "tag_color": "#FFC857",
        "summary": "CO and O₃ are modeled trace gases; local soil chemistry is not measured.",
        "detail": (
            "NASA's Phoenix lander detected perchlorate in soil at its own landing site. "
            "That result is not proof of perchlorate at the selected coordinate. No "
            "coordinate-specific toxic-soil assay, exposure limit, or crew safety "
            "assessment is available here."
        ),
        "source_url": "https://science.nasa.gov/mission/mars-phoenix/",
    },
    {
        "id": "water",
        "title": "Water",
        "tag": "SITE CONTEXT",
        "tag_color": "#35C5D5",
        "summary": "Atmospheric water vapor is not a drinking-water source.",
        "detail": (
            "The model's H₂O value is a gas mixing ratio. Geological evidence shown for "
            "a map feature describes past observations, not an accessible or tested "
            "water reserve at the current position."
        ),
        "source_url": MCD_SOURCE_URL,
    },
    {
        "id": "food",
        "title": "Food",
        "tag": "MISSION SUPPLY",
        "tag_color": "#E76F32",
        "summary": "No crew food stores, farms, or resupply service are mapped on Mars.",
        "detail": (
            "Food production, packaging, storage, and nutrition are mission-planning "
            "requirements. This guide has no inventory or local food-production data; "
            "it does not imply a functioning supply at the selected site."
        ),
        "source_url": None,
    },
    {
        "id": "power",
        "title": "Power",
        "tag": "MODEL INPUT",
        "tag_color": "#FFC857",
        "summary": "Modeled solar flux is an environmental estimate, not available electrical power.",
        "detail": (
            "The site model reports incident sunlight and dust climatology. Actual "
            "generation depends on hardware, orientation, season, dust accumulation, "
            "storage, and maintenance. No crew power system is present at this map "
            "coordinate."
        ),
        "source_url": MCD_SOURCE_URL,
    },
    {
        "id": "spacesuits",
        "title": "Spacesuits & EVA",
        "tag": "LIFE SUPPORT",
        "tag_color": "#E76F32",
        "summary": "The Martian surface requires a purpose-built pressure suit and life support.",
        "detail": (
            "A suit must provide a controlled pressure and breathing supply and manage "
            "heat, carbon dioxide, dust, and communications. No suit telemetry or "
            "personal life-support status is available from this map."
        ),
        "source_url": None,
    },
    {
        "id": "comms",
        "title": "Communications",
        "tag": "RELAY LINK",
        "tag_color": "#35C5D5",
        "summary": "This location has no live crew communications or coverage status.",
        "detail": (
            "Robotic Mars missions use spacecraft relays and deep-space links. "
            "Availability depends on the spacecraft, orbital geometry, and mission "
            "network; this surface map cannot promise a live link or response time."
        ),
        "source_url": "https://science.nasa.gov/mission/mars-reconnaissance-orbiter/",
    },
    {
        "id": "shelter",
        "title": "Shelter",
        "tag": "HABITAT",
        "tag_color": "#E76F32",
        "summary": "No pressurized crew habitat is present at any selected map point.",
        "detail": (
            "The map shows terrain and robotic mission records, not installed human "
            "infrastructure. A future habitat would need independent pressure, thermal, "
            "radiation, and dust protection; none is assessed or provided here."
        ),
        "source_url": None,
    },
]


class SurvivalDataUnavailable(RuntimeError):
    pass


class _ListItemParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self._in_item = False
        self._current_item = []

    def handle_starttag(self, tag, _):
        if tag == "li":
            self._in_item = True
            self._current_item = []

    def handle_endtag(self, tag):
        if tag == "li" and self._in_item:
            self.items.append(" ".join("".join(self._current_item).split()))
            self._in_item = False

    def handle_data(self, data):
        if self._in_item:
            self._current_item.append(data)


def parse_mcd_response(payload, expected_count):
    parser = _ListItemParser()
    parser.feed(payload)
    values = []
    number_pattern = re.compile(
        r"\.{3,}\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*$"
    )
    for item in parser.items:
        match = number_pattern.search(item)
        if match:
            values.append(float(match.group(1)))
    if len(values) != expected_count:
        raise SurvivalDataUnavailable("Mars Climate Database returned incomplete data")
    return values


def _julian_date(when):
    return when.timestamp() / 86400 + 2440587.5


def mars_season_and_time(when):
    julian_date = _julian_date(when)
    elapsed_sols = (julian_date - 2442765.667) * 86400 / MARS_SOL_SECONDS
    sol_of_year = elapsed_sols % MARS_YEAR_SOLS

    mean_anomaly_fraction = (sol_of_year - 485.35) / MARS_YEAR_SOLS
    mean_anomaly = 2 * math.pi * (
        mean_anomaly_fraction - math.floor(mean_anomaly_fraction + 0.5)
    )
    mean_anomaly_magnitude = abs(mean_anomaly)
    eccentricity = 0.0934
    eccentric_anomaly = (
        mean_anomaly_magnitude
        + eccentricity * math.sin(mean_anomaly_magnitude)
    )
    for _ in range(20):
        adjustment = -(
            eccentric_anomaly
            - eccentricity * math.sin(eccentric_anomaly)
            - mean_anomaly_magnitude
        ) / (1 - eccentricity * math.cos(eccentric_anomaly))
        eccentric_anomaly += adjustment
        if abs(adjustment) < 1e-10:
            break
    if mean_anomaly < 0:
        eccentric_anomaly = -eccentric_anomaly

    true_anomaly = 2 * math.atan(
        math.sqrt((1 + eccentricity) / (1 - eccentricity))
        * math.tan(eccentric_anomaly / 2)
    )
    solar_longitude = (true_anomaly - 1.90258341759902) % (2 * math.pi)
    solar_longitude_degrees = math.degrees(solar_longitude)

    mars_solar_date = (
        (julian_date - 2451549.5 + 44796.0) / 1.02749125 + 0.00096
    )
    prime_meridian_local_time = (mars_solar_date % 1) * 24
    return solar_longitude_degrees, prime_meridian_local_time


def _query_mcd_group(latitude, longitude, solar_longitude, local_time, variables):
    params = {
        "datekeyhtml": "1",
        "ls": f"{solar_longitude:.1f}",
        "localtime": f"{local_time:.2f}",
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "altitude": "0",
        "zkey": "3",
        "spacecraft": "none",
        "isfixedlt": "off",
    }
    params.update({f"var{index}": variable for index, variable in enumerate(variables, 1)})
    params.setdefault("var4", "none")
    request = urllib.request.Request(
        f"{MCD_CGI_URL}?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": "MartianNav/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read(64 * 1024 + 1)
    except (OSError, urllib.error.URLError) as error:
        raise SurvivalDataUnavailable("Mars Climate Database request failed") from error
    if len(payload) > 64 * 1024:
        raise SurvivalDataUnavailable("Mars Climate Database response was too large")
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SurvivalDataUnavailable("Mars Climate Database response was not valid UTF-8") from error
    return dict(zip(variables, parse_mcd_response(text, len(variables))))


@lru_cache(maxsize=256)
def _cached_mcd_point(latitude, longitude, solar_longitude, local_time):
    groups = []
    with ThreadPoolExecutor(max_workers=len(MCD_VARIABLE_GROUPS)) as executor:
        futures = [
            executor.submit(
                _query_mcd_group,
                latitude,
                longitude,
                solar_longitude,
                local_time,
                variables,
            )
            for variables in MCD_VARIABLE_GROUPS
        ]
        for future in futures:
            groups.append(future.result())

    return {key: value for group in groups for key, value in group.items()}


def get_site_conditions(latitude, longitude, when=None):
    when = when or datetime.now(timezone.utc)
    solar_longitude, local_time_at_zero = mars_season_and_time(when)
    model_values = _cached_mcd_point(
        round(latitude, 4),
        round(longitude, 4),
        round(solar_longitude, 1),
        round(local_time_at_zero, 2),
    )
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "model": {
            "name": "Mars Climate Database v6.2",
            "scenario": MCD_SCENARIO,
            "source": MCD_SOURCE_URL,
            "solar_longitude_deg": round(solar_longitude, 1),
            "local_time_hours": round((local_time_at_zero + longitude / 15) % 24, 2),
            "computed_at": when.astimezone(timezone.utc).isoformat(),
            "disclaimer": (
                "Seasonal climate-model estimates, not live surface measurements, "
                "a forecast, or a crew safety assessment."
            ),
        },
        "surface": {
            "temperature_c": round(model_values["tsurf"] - 273.15, 1),
            "pressure_pa": round(model_values["ps"], 1),
            "wind_speed_mps": round(model_values["wind"], 1),
            "dust_optical_depth": round(model_values["dod"], 3),
            "solar_flux_wm2": round(model_values["fluxsurf_dn_sw"], 1),
        },
        "gases": [
            {"id": "co2", "label": "CO₂", "mixing_ratio": model_values["vmr_co2"]},
            {"id": "n2", "label": "N₂", "mixing_ratio": model_values["vmr_n2"]},
            {"id": "argon", "label": "Argon", "mixing_ratio": model_values["vmr_ar"]},
            {"id": "o2", "label": "O₂", "mixing_ratio": model_values["vmr_o2"]},
            {"id": "co", "label": "CO", "mixing_ratio": model_values["vmr_co"]},
            {"id": "o3", "label": "O₃", "mixing_ratio": model_values["vmr_o3"]},
            {"id": "h2o", "label": "H₂O vapor", "mixing_ratio": model_values["vmr_h2o"]},
        ],
        "safety_note": (
            "The model does not measure local soil chemistry, perchlorates, or human "
            "exposure risk. Treat untested regolith as an unknown hazard."
        ),
    }
