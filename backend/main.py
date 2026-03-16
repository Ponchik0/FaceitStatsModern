import Millennium, PluginUtils  # type: ignore
import json
import os
import shutil
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PLUGIN_NAME = "faceit_stats"

FACEIT_HEADERS = {
    "Accept": "application/json",
    "Authorization": "Bearer 8f9985f3-3cf5-43de-970c-dfe244a57fb0",
}

LOGGER = PluginUtils.Logger()
REQUEST_TIMEOUT = 10
PROFILE_URL_REGEX = r"^https://steamcommunity\.com/(id|profiles)/.*"
LEETIFY_API_BASE = "https://api-public.cs-prod.leetify.com"
LEETIFY_API_KEY = os.getenv("LEETIFY_API_KEY", "").strip()
PLUGIN_DIR_CACHE = None
DEFAULT_SETTINGS = {
    "layout_mode": "full",
    "show_faceit_background": True,
    "colorize_metrics": True,
    "show_last_match": True,
    "default_tab": "faceit",
}


def parse_int(value, default=0):
    try:
        return int(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def parse_float(value, default=0.0):
    try:
        return float(str(value).replace("%", "").replace(",", ".").strip())
    except (TypeError, ValueError):
        return default


def fetch_json(url, headers=None):
    request = Request(url, headers=headers or {})

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = response.read().decode("utf-8")
            return response.getcode(), json.loads(payload)
    except HTTPError as exc:
        if exc.code == 404:
            return 404, None

        LOGGER.log(f"HTTP error while fetching {url}: {exc}")
    except URLError as exc:
        LOGGER.log(f"Network error while fetching {url}: {exc}")
    except json.JSONDecodeError as exc:
        LOGGER.log(f"Invalid JSON returned by {url}: {exc}")

    return None, None


def get_settings_path():
    return os.path.join(GetPluginDir(), "user_settings.json")


def sanitize_settings(settings):
    merged = dict(DEFAULT_SETTINGS)
    if isinstance(settings, dict):
        merged.update(settings)

    merged["layout_mode"] = "compact" if merged.get("layout_mode") == "compact" else "full"
    merged["show_faceit_background"] = bool(merged.get("show_faceit_background", True))
    merged["colorize_metrics"] = bool(merged.get("colorize_metrics", True))
    merged["show_last_match"] = bool(merged.get("show_last_match", True))
    merged["default_tab"] = "leetify" if merged.get("default_tab") == "leetify" else "faceit"
    return merged


def load_widget_settings():
    millennium_settings = load_millennium_widget_settings()
    if isinstance(millennium_settings, dict):
        return sanitize_settings(millennium_settings)

    settings_path = get_settings_path()

    if not os.path.exists(settings_path):
        return dict(DEFAULT_SETTINGS)

    try:
        with open(settings_path, "r", encoding="utf-8") as handle:
            return sanitize_settings(json.load(handle))
    except Exception as exc:
        LOGGER.log(f"Failed to read widget settings: {exc}")
        return dict(DEFAULT_SETTINGS)


def save_widget_settings(settings):
    sanitized = sanitize_settings(settings)

    if persist_millennium_widget_settings(sanitized):
        return sanitized

    settings_path = get_settings_path()

    try:
        with open(settings_path, "w", encoding="utf-8") as handle:
            json.dump(sanitized, handle, indent=2)
    except Exception as exc:
        LOGGER.log(f"Failed to save widget settings fallback file: {exc}")

    return sanitized


def _try_call(obj, fn_name, *args, **kwargs):
    fn = getattr(obj, fn_name, None)
    if not callable(fn):
        return None

    try:
        return fn(*args, **kwargs)
    except TypeError:
        return None
    except Exception as exc:
        LOGGER.log(f"Error calling {obj.__name__}.{fn_name}: {exc}") if hasattr(obj, "__name__") else LOGGER.log(
            f"Error calling {fn_name}: {exc}"
        )
        return None


def _coerce_settings_payload(payload):
    if payload is None:
        return None

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            return None

    if isinstance(payload, dict):
        return payload

    return None


def load_millennium_widget_settings():
    """
    Prefer Millennium's native configuration store (plugin.json `data`) when available.
    Falls back to our legacy user_settings.json when Millennium APIs aren't available in this runtime.
    """

    candidates = [
        (Millennium, ["get_plugin_settings", "GetPluginSettings", "get_plugin_data", "GetPluginData", "get_config", "GetConfig"]),
        (PluginUtils, ["get_plugin_settings", "GetPluginSettings", "get_plugin_data", "GetPluginData", "get_config", "GetConfig"]),
    ]

    for obj, fn_names in candidates:
        for fn_name in fn_names:
            for args in ((PLUGIN_NAME,), tuple()):
                result = _try_call(obj, fn_name, *args)
                settings = _coerce_settings_payload(result)
                if isinstance(settings, dict) and settings:
                    return settings

    return None


def persist_millennium_widget_settings(settings):
    candidates = [
        (Millennium, ["set_plugin_settings", "SetPluginSettings", "set_plugin_data", "SetPluginData", "set_config", "SetConfig"]),
        (PluginUtils, ["set_plugin_settings", "SetPluginSettings", "set_plugin_data", "SetPluginData", "set_config", "SetConfig"]),
    ]

    for obj, fn_names in candidates:
        for fn_name in fn_names:
            for args in (
                (PLUGIN_NAME, settings),
                (settings,),
            ):
                result = _try_call(obj, fn_name, *args)
                if result is None:
                    continue

                # Some APIs return the persisted dict/string; some return True/None.
                persisted = _coerce_settings_payload(result)
                if isinstance(persisted, dict):
                    return True

                if isinstance(result, bool) and result:
                    return True

                # If it didn't error, assume success.
                return True

    return False


class FaceItUser:
    class UserStats:
        def __init__(self, matches: int, avg_hs: float, avg_kd: float, adr: float, winrate: float, current_win_streak: int, longest_win_streak: int):
            self.matches = matches
            self.avg_hs = avg_hs
            self.avg_kd = avg_kd
            self.adr = adr
            self.winrate = winrate
            self.current_win_streak = current_win_streak
            self.longest_win_streak = longest_win_streak

        def to_dict(self):
            return {
                "matches": self.matches,
                "avg_hs": self.avg_hs,
                "avg_kd": self.avg_kd,
                "adr": self.adr,
                "winrate": self.winrate,
                "current_win_streak": self.current_win_streak,
                "longest_win_streak": self.longest_win_streak,
            }

    def __init__(self, id: str, nickname: str, country: str, avatar: str, cover_image_url: str, faceit_elo: int, skill_level: int):
        self.id = id
        self.nickname = nickname
        self.country = country
        self.avatar = avatar
        self.cover_image_url = cover_image_url
        self.faceit_elo = faceit_elo
        self.skill_level = skill_level
        self.stats = self.get_user_stats()

    @staticmethod
    def get_user_by_steamId(steamId: str):
        url = f"https://open.faceit.com/data/v4/players?game=cs2&game_player_id={steamId}"
        status_code, data = fetch_json(url, FACEIT_HEADERS)

        if status_code == 404:
            return None

        if not data:
            LOGGER.log(f"Failed to fetch Faceit user for Steam ID {steamId}")
            return None

        cs2_data = data.get("games", {}).get("cs2", {})

        return FaceItUser(
            id=data.get("player_id", ""),
            nickname=data.get("nickname", "Unknown"),
            country=data.get("country", "Unknown"),
            avatar=data.get("avatar", ""),
            cover_image_url=data.get("cover_image", ""),
            faceit_elo=parse_int(cs2_data.get("faceit_elo")),
            skill_level=parse_int(cs2_data.get("skill_level")),
        )

    def get_user_stats(self):
        stats_url = f"https://open.faceit.com/data/v4/players/{self.id}/stats/cs2"
        _, data = fetch_json(stats_url, FACEIT_HEADERS)

        if not data:
            LOGGER.log(f"Failed to fetch Faceit stats for player {self.id}")
            return None

        lifetime_stats = data.get("lifetime", {})

        return self.UserStats(
            matches=parse_int(lifetime_stats.get("Matches")),
            avg_hs=parse_float(lifetime_stats.get("Average Headshots %")),
            avg_kd=parse_float(lifetime_stats.get("Average K/D Ratio")),
            adr=parse_float(lifetime_stats.get("ADR")),
            winrate=parse_float(lifetime_stats.get("Win Rate %")),
            current_win_streak=parse_int(lifetime_stats.get("Current Win Streak")),
            longest_win_streak=parse_int(lifetime_stats.get("Longest Win Streak")),
        )

    def to_dict(self):
        return {
            "id": self.id,
            "nickname": self.nickname,
            "country": self.country,
            "avatar": self.avatar,
            "cover_image_url": self.cover_image_url,
            "faceit_elo": self.faceit_elo,
            "skill_level": self.skill_level,
            "stats": self.stats.to_dict() if self.stats else None,
        }


def get_user_by_steamId(steamId):
    try:
        user = FaceItUser.get_user_by_steamId(steamId)
        return json.dumps(user.to_dict() if user else None)
    except Exception as exc:
        LOGGER.log(f"Error in get_user_by_steamId: {exc}")
        return json.dumps(None)


def get_leetify_profile(steamId):
    headers = {
        "Accept": "application/json",
    }

    if LEETIFY_API_KEY:
        headers["Authorization"] = f"Bearer {LEETIFY_API_KEY}"

    query = urlencode({"steam64_id": str(steamId)})
    url = f"{LEETIFY_API_BASE}/v3/profile?{query}"

    try:
        status_code, data = fetch_json(url, headers)
        if status_code == 404:
            return json.dumps(None)

        if not data:
            LOGGER.log(f"Failed to fetch Leetify profile for Steam ID {steamId}")
            return json.dumps(None)

        recent_matches = data.get("recent_matches") or []
        latest_match = recent_matches[0] if recent_matches else None

        response = {
            "name": data.get("name"),
            "privacy_mode": data.get("privacy_mode"),
            "winrate": data.get("winrate"),
            "total_matches": data.get("total_matches"),
            "first_match_date": data.get("first_match_date"),
            "steam64_id": data.get("steam64_id"),
            "profile_url": f"https://leetify.com/app/profile/{steamId}",
            "ranks": {
                "leetify": (data.get("ranks") or {}).get("leetify"),
                "premier": (data.get("ranks") or {}).get("premier"),
                "faceit": (data.get("ranks") or {}).get("faceit"),
                "faceit_elo": (data.get("ranks") or {}).get("faceit_elo"),
                "wingman": (data.get("ranks") or {}).get("wingman"),
                "renown": (data.get("ranks") or {}).get("renown"),
            },
            "rating": {
                "aim": (data.get("rating") or {}).get("aim"),
                "positioning": (data.get("rating") or {}).get("positioning"),
                "utility": (data.get("rating") or {}).get("utility"),
                "clutch": (data.get("rating") or {}).get("clutch"),
                "opening": (data.get("rating") or {}).get("opening"),
            },
            "stats": {
                "accuracy_head": (data.get("stats") or {}).get("accuracy_head"),
                "reaction_time_ms": (data.get("stats") or {}).get("reaction_time_ms"),
                "preaim": (data.get("stats") or {}).get("preaim"),
                "spray_accuracy": (data.get("stats") or {}).get("spray_accuracy"),
            },
            "recent_match": {
                "map_name": latest_match.get("map_name"),
                "outcome": latest_match.get("outcome"),
                "finished_at": latest_match.get("finished_at"),
                "leetify_rating": latest_match.get("leetify_rating"),
                "score": latest_match.get("score"),
                "preaim": latest_match.get("preaim"),
                "reaction_time_ms": latest_match.get("reaction_time_ms"),
                "accuracy_head": latest_match.get("accuracy_head"),
            } if latest_match else None,
        }

        return json.dumps(response)
    except Exception as exc:
        LOGGER.log(f"Error in get_leetify_profile: {exc}")
        return json.dumps(None)


def get_widget_settings(*_args, **_kwargs):
    return json.dumps(load_widget_settings())


def update_widget_settings(settings=None, *_args, **kwargs):
    payload = settings

    if payload is None and "settings" in kwargs:
        payload = kwargs.get("settings")

    if payload is None and kwargs:
        payload = kwargs

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    if not isinstance(payload, dict):
        payload = {}

    return json.dumps(save_widget_settings(payload))


def GetPluginDir():
    global PLUGIN_DIR_CACHE

    if PLUGIN_DIR_CACHE:
        return PLUGIN_DIR_CACHE

    module_path = os.path.abspath(__file__)
    backend_dir = module_path if os.path.isdir(module_path) else os.path.dirname(module_path)
    plugin_dir = backend_dir

    if os.path.basename(backend_dir).lower() == "backend":
        plugin_dir = os.path.dirname(backend_dir)

    if not os.path.isdir(os.path.join(plugin_dir, "static")):
        search_dir = backend_dir
        for _ in range(4):
            if os.path.isdir(os.path.join(search_dir, "static")):
                plugin_dir = search_dir
                break

            parent_dir = os.path.dirname(search_dir)
            if parent_dir == search_dir:
                break
            search_dir = parent_dir

    PLUGIN_DIR_CACHE = plugin_dir
    return plugin_dir


class Plugin:
    def __init__(self):
        self.css_module_id = 0
        self.js_module_id = 0

    def copy_frontend_files(self):
        plugin_dir = GetPluginDir()
        css_source = os.path.join(plugin_dir, "static", "faceit_stats.css")
        js_source = os.path.join(plugin_dir, "static", "faceit_stats.js")
        static_source = os.path.join(plugin_dir, "static")

        LOGGER.log(f"Plugin dir: {plugin_dir}")
        LOGGER.log(f"CSS source: {css_source}")

        if not os.path.exists(static_source):
            LOGGER.log(f"Static folder not found: {static_source}")
            return

        png_source = [f for f in os.listdir(static_source) if f.endswith(".png")]

        steamui_dest = os.path.join(Millennium.steam_path(), "steamui")
        faceit_finder_dest = os.path.join(steamui_dest, "FaceItFinder")
        os.makedirs(faceit_finder_dest, exist_ok=True)

        try:
            if os.path.exists(css_source):
                shutil.copy(css_source, steamui_dest)
                LOGGER.log(f"Copied CSS to {steamui_dest}")
            else:
                LOGGER.log(f"CSS not found: {css_source}")

            if os.path.exists(js_source):
                shutil.copy(js_source, steamui_dest)
                LOGGER.log(f"Copied JS to {steamui_dest}")
            else:
                LOGGER.log(f"JS not found: {js_source}")

            for png_file in png_source:
                png_file_path = os.path.join(static_source, png_file)
                if os.path.exists(png_file_path):
                    shutil.copy(png_file_path, faceit_finder_dest)
                    LOGGER.log(f"Copied {png_file}")
        except Exception as exc:
            LOGGER.log(f"Error copying files: {exc}")

    def _front_end_loaded(self):
        LOGGER.log("The front end has loaded!")

    def _load(self):
        LOGGER.log(f"Bootstrapping FaceItStats, Millennium {Millennium.version()}")
        self.copy_frontend_files()
        self.css_module_id = Millennium.add_browser_css("faceit_stats.css", PROFILE_URL_REGEX)
        self.js_module_id = Millennium.add_browser_js("faceit_stats.js", PROFILE_URL_REGEX)
        Millennium.ready()

    def _unload(self):
        LOGGER.log("Unloading")
        if self.css_module_id:
            Millennium.remove_browser_module(self.css_module_id)
            self.css_module_id = 0
        if self.js_module_id:
            Millennium.remove_browser_module(self.js_module_id)
            self.js_module_id = 0
