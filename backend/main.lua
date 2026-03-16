local millennium = require("millennium")
local http = require("http")
local cjson = require("json")

local FACEIT_API_KEY = "8f9985f3-3cf5-43de-970c-dfe244a57fb0"
local FACEIT_HEADERS = {
    ["Accept"] = "application/json",
    ["Authorization"] = "Bearer " .. FACEIT_API_KEY
}

local LEETIFY_API_BASE = "https://api-public.cs-prod.leetify.com"

local function log(message)
    print("[FACEIT Stats Modern] " .. tostring(message))
end

local function safe_json_decode(json_str)
    if not json_str or json_str == "" then
        return nil
    end
    
    local success, result = pcall(cjson.decode, json_str)
    if success then
        return result
    else
        log("JSON decode error: " .. tostring(result))
        return nil
    end
end

-- Получение данных FACEIT по Steam ID
local function get_faceit_by_steam_id(steam_id)
    local url = string.format(
        "https://open.faceit.com/data/v4/players?game=cs2&game_player_id=%s",
        steam_id
    )
    
    local res, err = http.get(url, {
        headers = FACEIT_HEADERS,
        timeout = 10
    })
    
    if not res then
        log("FACEIT API error: " .. tostring(err))
        return nil
    end
    
    if res.status == 404 then
        return nil
    end
    
    if res.status ~= 200 then
        log("FACEIT API returned status: " .. tostring(res.status))
        return nil
    end
    
    local data = safe_json_decode(res.body)
    if not data then
        return nil
    end
    
    local cs2_data = data.games and data.games.cs2 or {}
    
    return {
        id = data.player_id or "",
        nickname = data.nickname or "Unknown",
        country = data.country or "Unknown",
        avatar = data.avatar or "",
        cover_image_url = data.cover_image or "",
        faceit_elo = tonumber(cs2_data.faceit_elo) or 0,
        skill_level = tonumber(cs2_data.skill_level) or 0
    }
end

-- Получение статистики FACEIT
local function get_faceit_stats(player_id)
    if not player_id or player_id == "" then
        return nil
    end
    
    local url = string.format(
        "https://open.faceit.com/data/v4/players/%s/stats/cs2",
        player_id
    )
    
    local res, err = http.get(url, {
        headers = FACEIT_HEADERS,
        timeout = 10
    })
    
    if not res or res.status ~= 200 then
        log("FACEIT stats error: " .. tostring(err or res.status))
        return nil
    end
    
    local data = safe_json_decode(res.body)
    if not data then
        return nil
    end
    
    local lifetime = data.lifetime or {}
    
    local function parse_number(value)
        if type(value) == "number" then
            return value
        end
        if type(value) == "string" then
            value = value:gsub("%%", ""):gsub(",", "")
            return tonumber(value) or 0
        end
        return 0
    end
    
    return {
        matches = parse_number(lifetime["Matches"]),
        avg_hs = parse_number(lifetime["Average Headshots %"]),
        avg_kd = parse_number(lifetime["Average K/D Ratio"]),
        adr = parse_number(lifetime["ADR"]),
        winrate = parse_number(lifetime["Win Rate %"]),
        current_win_streak = parse_number(lifetime["Current Win Streak"]),
        longest_win_streak = parse_number(lifetime["Longest Win Streak"])
    }
end

-- Получение профиля Leetify
local function get_leetify_profile(steam_id)
    local url = string.format("%s/v3/profile?steam64_id=%s", LEETIFY_API_BASE, steam_id)
    
    local res, err = http.get(url, {
        headers = { ["Accept"] = "application/json" },
        timeout = 10
    })
    
    if not res then
        log("Leetify API error: " .. tostring(err))
        return nil
    end
    
    if res.status == 404 then
        return nil
    end
    
    if res.status ~= 200 then
        log("Leetify API returned status: " .. tostring(res.status))
        return nil
    end
    
    local data = safe_json_decode(res.body)
    if not data then
        return nil
    end
    
    local recent_matches = data.recent_matches or {}
    local latest_match = recent_matches[1]
    
    local ranks = data.ranks or {}
    local rating = data.rating or {}
    local stats = data.stats or {}
    
    return {
        name = data.name,
        privacy_mode = data.privacy_mode,
        winrate = data.winrate,
        total_matches = data.total_matches,
        first_match_date = data.first_match_date,
        steam64_id = data.steam64_id,
        profile_url = string.format("https://leetify.com/app/profile/%s", steam_id),
        ranks = {
            leetify = ranks.leetify,
            premier = ranks.premier,
            faceit = ranks.faceit,
            faceit_elo = ranks.faceit_elo,
            wingman = ranks.wingman,
            renown = ranks.renown
        },
        rating = {
            aim = rating.aim,
            positioning = rating.positioning,
            utility = rating.utility,
            clutch = rating.clutch,
            opening = rating.opening
        },
        stats = {
            accuracy_head = stats.accuracy_head,
            reaction_time_ms = stats.reaction_time_ms,
            preaim = stats.preaim,
            spray_accuracy = stats.spray_accuracy
        },
        recent_match = latest_match and {
            map_name = latest_match.map_name,
            outcome = latest_match.outcome,
            finished_at = latest_match.finished_at,
            leetify_rating = latest_match.leetify_rating,
            score = latest_match.score,
            preaim = latest_match.preaim,
            reaction_time_ms = latest_match.reaction_time_ms,
            accuracy_head = latest_match.accuracy_head
        } or cjson.null
    }
end

-- Экспорт для фронтенда
local function get_user_by_steamId(steam_id)
    log("Fetching FACEIT data for Steam ID: " .. tostring(steam_id))
    
    local faceit_user = get_faceit_by_steam_id(steam_id)
    if not faceit_user then
        return cjson.encode(cjson.null)
    end
    
    local stats = get_faceit_stats(faceit_user.id)
    faceit_user.stats = stats or cjson.null
    
    return cjson.encode(faceit_user)
end

local function get_leetify_profile_data(steam_id)
    log("Fetching Leetify data for Steam ID: " .. tostring(steam_id))
    
    local profile = get_leetify_profile(steam_id)
    if not profile then
        return cjson.encode(cjson.null)
    end
    
    return cjson.encode(profile)
end

local function on_load()
    log("Plugin loaded successfully")
    millennium.ready()
end

return {
    on_load = on_load,
    get_user_by_steamId = get_user_by_steamId,
    get_leetify_profile = get_leetify_profile_data
}
