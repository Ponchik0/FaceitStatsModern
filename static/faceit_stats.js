(function () {
    const pluginName = "faceit_stats";
    const FACEIT_LEVELS = [
        { level: 1, min: 1, next: 501 },
        { level: 2, min: 501, next: 751 },
        { level: 3, min: 751, next: 901 },
        { level: 4, min: 901, next: 1051 },
        { level: 5, min: 1051, next: 1201 },
        { level: 6, min: 1201, next: 1351 },
        { level: 7, min: 1351, next: 1531 },
        { level: 8, min: 1531, next: 1751 },
        { level: 9, min: 1751, next: 2001 },
        { level: 10, min: 2001, next: null },
    ];
    const DEFAULT_SETTINGS = {
        layout_mode: "full",
        show_faceit_background: true,
        colorize_metrics: true,
        show_last_match: true,
        default_tab: "faceit",
    };

    if (!window.PLUGIN_LIST) {
        window.PLUGIN_LIST = {};
    }

    if (!window.PLUGIN_LIST[pluginName]) {
        window.PLUGIN_LIST[pluginName] = {};
    }

    const callServerMethod = (methodName, kwargs) =>
        Millennium.callServerMethod(pluginName, methodName, kwargs);

    function mergeSettings(settings) {
        const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
        merged.layout_mode = merged.layout_mode === "compact" ? "compact" : "full";
        merged.show_faceit_background = Boolean(merged.show_faceit_background);
        merged.colorize_metrics = Boolean(merged.colorize_metrics);
        merged.show_last_match = Boolean(merged.show_last_match);
        merged.default_tab = merged.default_tab === "leetify" ? "leetify" : "faceit";
        return merged;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function safeText(value, fallback = "N/A") {
        const text = String(value ?? "").trim();
        return text ? escapeHtml(text) : fallback;
    }

    function safeUrl(value) {
        const text = String(value ?? "").trim();
        return text ? escapeHtml(text) : "";
    }

    function formatNumber(value, decimals = 0, suffix = "") {
        if (value === null || value === undefined || value === "") {
            return "N/A";
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "N/A";
        }

        return `${numericValue.toFixed(decimals)}${suffix}`;
    }

    function formatSignedNumber(value, decimals = 2) {
        if (value === null || value === undefined || value === "") {
            return "N/A";
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "N/A";
        }

        return `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(decimals)}`;
    }

    function formatPercent(value, decimals = 0, isFraction = false) {
        if (value === null || value === undefined || value === "") {
            return "N/A";
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "N/A";
        }

        const percentValue = isFraction ? numericValue * 100 : numericValue;
        return `${percentValue.toFixed(decimals)}%`;
    }

    function formatDate(value, fallback = "N/A") {
        if (!value) {
            return fallback;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return fallback;
        }

        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function getMetricTone(metricKey, value, settings) {
        if (!settings.colorize_metrics) {
            return "neutral";
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "neutral";
        }

        switch (metricKey) {
            case "faceit_elo":
                return numericValue >= 1751 ? "good" : numericValue >= 1051 ? "warn" : "bad";
            case "faceit_kd":
                return numericValue >= 1.2 ? "good" : numericValue >= 1.0 ? "warn" : "bad";
            case "faceit_winrate":
                return numericValue >= 55 ? "good" : numericValue >= 48 ? "warn" : "bad";
            case "faceit_hs":
                return numericValue >= 50 ? "good" : numericValue >= 40 ? "warn" : "bad";
            case "faceit_adr":
                return numericValue >= 90 ? "good" : numericValue >= 75 ? "warn" : "bad";
            case "leetify":
                return numericValue >= 2 ? "good" : numericValue >= 0 ? "warn" : "bad";
            case "premier":
                return numericValue >= 20000 ? "good" : numericValue >= 15000 ? "warn" : "bad";
            case "score_100":
                return numericValue >= 60 ? "good" : numericValue >= 45 ? "warn" : "bad";
            case "percent":
                return numericValue >= 50 ? "good" : numericValue >= 40 ? "warn" : "bad";
            case "reaction":
                return numericValue <= 500 ? "good" : numericValue <= 650 ? "warn" : "bad";
            case "recent_rating":
                return numericValue >= 0.03 ? "good" : numericValue >= -0.01 ? "warn" : "bad";
            default:
                return "neutral";
        }
    }

    function metricClass(tone) {
        return tone && tone !== "neutral" ? `fcs-metric-${tone}` : "";
    }

    function isPrivateValue(value) {
        return String(value ?? "").trim().toLowerCase() === "private";
    }

    function getPremierTierClass(value, settings) {
        if (!settings.colorize_metrics) {
            return "";
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "";
        }

        if (numericValue >= 30000) {
            return "fcs-premier-tier-gold";
        }

        if (numericValue >= 25000) {
            return "fcs-premier-tier-red";
        }

        if (numericValue >= 20000) {
            return "fcs-premier-tier-pink";
        }

        if (numericValue >= 15000) {
            return "fcs-premier-tier-purple";
        }

        if (numericValue >= 10000) {
            return "fcs-premier-tier-blue";
        }

        if (numericValue >= 5000) {
            return "fcs-premier-tier-cyan";
        }

        return "fcs-premier-tier-gray";
    }

    function getStreakClass(value, settings) {
        if (!settings.colorize_metrics) {
            return "fcs-faceit-streak-neutral";
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return "fcs-faceit-streak-neutral";
        }

        if (numericValue >= 5) {
            return "fcs-faceit-streak-hot";
        }

        if (numericValue >= 3) {
            return "fcs-faceit-streak-warm";
        }

        return "fcs-faceit-streak-live";
    }

    function buildMetricCard(valueMarkup, label, tone, extraClass = "") {
        return `
            <div class="fcs-stat ${extraClass} ${metricClass(tone)}">
                <div class="fcs-stat-val">${valueMarkup}</div>
                <div class="fcs-stat-lbl">${label}</div>
            </div>
        `;
    }

    function buildLeetifyCard(valueMarkup, label, tone, extraClass = "") {
        return `
            <div class="fcs-leetify-card ${metricClass(tone)} ${extraClass}">
                <div class="fcs-leetify-val">${valueMarkup}</div>
                <div class="fcs-leetify-lbl">${label}</div>
            </div>
        `;
    }

    function buildHoursCard(label, value, note = "", extraClass = "") {
        const isPrivate = isPrivateValue(value);
        const valueClass = String(value ?? "").length > 12 ? "fcs-hours-val-small" : "";
        return `
            <div class="fcs-hours-card ${isPrivate ? "fcs-hours-card-private" : ""} ${extraClass}">
                <div class="fcs-hours-val ${valueClass}">${isPrivate ? "PRIVATE" : safeText(value, "Private")}</div>
                <div class="fcs-hours-lbl">${label}</div>
                ${isPrivate ? '<div class="fcs-hours-note">Steam playtime hidden</div>' : note ? `<div class="fcs-hours-note">${safeText(note)}</div>` : ""}
            </div>
        `;
    }

    function getProfileBaseUrl() {
        return `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, "");
    }

    function getFaceitProgress(skillLevel, elo) {
        const numericLevel = Number(skillLevel);
        const numericElo = Number(elo);
        const fallbackLevel =
            FACEIT_LEVELS.find((item) => numericElo >= item.min && (item.next === null || numericElo < item.next))?.level || 0;
        const resolvedLevel = numericLevel || fallbackLevel;
        const bracket = FACEIT_LEVELS.find((item) => item.level === resolvedLevel);

        if (!bracket || !Number.isFinite(numericElo)) {
            return null;
        }

        if (bracket.next === null) {
            return {
                percent: 100,
                detail: "Level 10 cap reached",
                rangeLabel: "2001+ ELO bracket",
                currentElo: numericElo,
                minElo: bracket.min,
                nextElo: null,
                nextLevel: null,
            };
        }

        const span = bracket.next - bracket.min;
        const rawProgress = ((numericElo - bracket.min) / span) * 100;
        const percent = Math.min(100, Math.max(0, rawProgress));
        const remaining = Math.max(0, bracket.next - numericElo);

        return {
            percent,
            detail: `${remaining} ELO to Level ${bracket.level + 1}`,
            rangeLabel: `${bracket.min}-${bracket.next - 1} ELO bracket`,
            currentElo: numericElo,
            minElo: bracket.min,
            nextElo: bracket.next,
            nextLevel: bracket.level + 1,
        };
    }

    async function fetchXmlDocument(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        const xmlText = await response.text();
        return new DOMParser().parseFromString(xmlText, "application/xml");
    }

    async function loadFaceitData(steamId) {
        try {
            const faceitDataRaw = await callServerMethod("get_user_by_steamId", { steamId });
            return JSON.parse(faceitDataRaw);
        } catch (error) {
            console.error("[Faceit Stats] Failed to load Faceit data", error);
            return null;
        }
    }

    async function loadLeetifyData(steamId) {
        try {
            const leetifyDataRaw = await callServerMethod("get_leetify_profile", { steamId });
            return JSON.parse(leetifyDataRaw);
        } catch (error) {
            console.error("[Faceit Stats] Failed to load Leetify data", error);
            return null;
        }
    }

    async function loadWidgetSettings() {
        try {
            const settingsRaw = await callServerMethod("get_widget_settings", {});
            return mergeSettings(JSON.parse(settingsRaw));
        } catch (error) {
            console.error("[Faceit Stats] Failed to load widget settings", error);
            return { ...DEFAULT_SETTINGS };
        }
    }

    async function persistWidgetSettings(settings) {
        try {
            const updatedSettingsRaw = await callServerMethod("update_widget_settings", { settings });
            return mergeSettings(JSON.parse(updatedSettingsRaw));
        } catch (error) {
            console.error("[Faceit Stats] Failed to save widget settings", error);
            return mergeSettings(settings);
        }
    }

    function buildSteamSection(data) {
        return `
            <div class="fcs-section-label">STEAM</div>
            <div class="fcs-steam-section">
                <div class="fcs-steam-rows">
                    <div class="fcs-steam-row">
                        <span class="fcs-steam-key">Member since</span>
                        <span class="fcs-steam-val">${safeText(data.memberSince)}</span>
                    </div>
                    <div class="fcs-steam-row">
                        <span class="fcs-steam-key">CS2 since</span>
                        <span class="fcs-steam-val">${safeText(data.cs2StartDate)}</span>
                    </div>
                </div>
                <div class="fcs-ext-row">
                    <a href="https://csstats.gg/player/${encodeURIComponent(data.steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">CSSTATS</a>
                    <a href="https://leetify.com/app/profile/${encodeURIComponent(data.steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">LEETIFY</a>
                    <a href="https://steamid.io/lookup/${encodeURIComponent(data.steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">FINDER</a>
                </div>
                ${data.vacBanned === 0 && data.tradeBanState === "None" && data.isLimited === 0 ? `
                    <div class="fcs-clean-row">
                        <span class="fcs-badge fcs-badge-clean">Clean Profile</span>
                    </div>
                ` : `
                    <div class="fcs-ban-row">
                        ${data.vacBanned !== 0 ? '<span class="fcs-badge fcs-badge-ban">VAC Ban</span>' : ""}
                        ${data.tradeBanState !== "None" ? '<span class="fcs-badge fcs-badge-ban">Trade Ban</span>' : ""}
                        ${data.isLimited !== 0 ? '<span class="fcs-badge fcs-badge-warn">Limited</span>' : ""}
                    </div>
                `}
            </div>
        `;
    }

    function buildFaceitPanel(state) {
        const data = state.profile;
        const settings = state.settings;
        const faceitData = state.faceitData;

        if (!faceitData) {
            return `
                <div class="fcs-no-faceit">
                    <strong>No FACEIT account linked to this Steam profile.</strong>
                </div>
                <div class="fcs-divider"></div>
                ${buildSteamSection(data)}
            `;
        }

        const nickname = safeText(faceitData.nickname, "Unknown");
        const country = safeText(faceitData.country, "default").toLowerCase();
        const avatarUrl = safeUrl(faceitData.avatar);
        const coverImageUrl = safeUrl(faceitData.cover_image_url);
        const skillLevel = Number(faceitData.skill_level ?? 0);
        const stats = faceitData.stats ?? {};
        const progress = getFaceitProgress(skillLevel, faceitData.faceit_elo);
        const currentStreak = Number(stats.current_win_streak ?? 0);
        const streakClass = getStreakClass(currentStreak, settings);
        const levelIconUrl = `https://steamloopback.host/FaceItFinder/skill_level_${skillLevel}_lg.png`;

        return `
            <div class="fcs-faceit-label">FACEIT</div>
            <div class="fcs-faceit-section ${settings.show_faceit_background ? "" : "fcs-faceit-section-no-bg"}">
                ${settings.show_faceit_background ? `<div class="fcs-cover" style="background-image: url('${coverImageUrl}')"></div>` : ""}
                <div class="fcs-faceit-header">
                    <div class="fcs-avatar-wrap">
                        <img src="${avatarUrl}" class="fcs-avatar" alt="Avatar">
                    </div>
                    <div class="fcs-faceit-info">
                        <a href="https://www.faceit.com/en/players/${encodeURIComponent(String(faceitData.nickname ?? ""))}" target="_blank" rel="noreferrer" class="fcs-nick">
                            <img src="https://faceitfinder.com/resources/flags/svg/${country}.svg" class="fcs-flag" width="20" height="15" alt="Flag">
                            ${nickname}
                        </a>
                        <div class="fcs-elo-row">
                            <img
                                src="${levelIconUrl}"
                                class="fcs-elo-level-icon fcs-elo-level-icon-inline"
                                alt="Level ${formatNumber(skillLevel)}"
                                title="FACEIT Level ${formatNumber(skillLevel)}"
                            >
                            <span class="fcs-elo-stack">
                                <span class="fcs-elo-main">${formatNumber(faceitData.faceit_elo)}</span>
                                <span class="fcs-elo-unit">ELO</span>
                            </span>
                        </div>
                        <div class="fcs-faceit-meta-row">
                            <span class="fcs-faceit-streak ${streakClass}">
                                <span class="fcs-faceit-streak-label">STREAK</span>
                                <span class="fcs-faceit-streak-val">${formatNumber(currentStreak)}W</span>
                            </span>
                        </div>
                    </div>
                </div>
                ${progress ? `
                    <div class="fcs-progress-wrap">
                        <div class="fcs-progress-meta">
                            <span class="fcs-progress-range">${progress.rangeLabel}</span>
                            <span class="fcs-progress-detail">${progress.detail}</span>
                        </div>
                        <div class="fcs-progress-scale">
                            <span class="fcs-progress-tick fcs-progress-tick-start">
                                <span class="fcs-progress-tick-label">Start</span>
                                <span class="fcs-progress-tick-value">${formatNumber(progress.minElo)} ELO</span>
                            </span>
                            <span class="fcs-progress-tick fcs-progress-tick-end">
                                <span class="fcs-progress-tick-label">${progress.nextLevel ? `Level ${formatNumber(progress.nextLevel)}` : "Cap"}</span>
                                <span class="fcs-progress-tick-value">${progress.nextElo ? `${formatNumber(progress.nextElo)} ELO` : "Level 10"}</span>
                            </span>
                        </div>
                        <div class="fcs-progress-track">
                            <div class="fcs-progress-fill" style="width: ${progress.percent.toFixed(2)}%;"></div>
                            <div class="fcs-progress-glow" style="width: ${progress.percent.toFixed(2)}%;"></div>
                            <div class="fcs-progress-dot" style="left: ${progress.percent.toFixed(2)}%;">
                                <span class="fcs-progress-dot-core"></span>
                            </div>
                        </div>
                        <div class="fcs-progress-current">${formatNumber(progress.currentElo)} current ELO</div>
                    </div>
                ` : ""}
                <div class="fcs-stats-grid">
                    ${buildMetricCard(formatNumber(stats.matches), "MATCHES", "neutral")}
                    ${buildMetricCard(formatNumber(faceitData.faceit_elo), "ELO", getMetricTone("faceit_elo", faceitData.faceit_elo, settings))}
                    ${buildMetricCard(formatNumber(stats.avg_kd, 2), "K/D", getMetricTone("faceit_kd", stats.avg_kd, settings))}
                    ${buildMetricCard(formatPercent(stats.winrate), "WIN RATE", getMetricTone("faceit_winrate", stats.winrate, settings))}
                    ${buildMetricCard(formatPercent(stats.avg_hs), "HEADSHOT", getMetricTone("faceit_hs", stats.avg_hs, settings))}
                    ${buildMetricCard(formatNumber(stats.adr, 0), "ADR", getMetricTone("faceit_adr", stats.adr, settings))}
                </div>
            </div>
            <div class="fcs-panel-footer">
                <a href="https://www.faceit.com/en/players/${encodeURIComponent(String(faceitData.nickname ?? ""))}" target="_blank" rel="noreferrer" class="fcs-ext-btn">FACEIT Profile</a>
                <a href="https://faceittracker.net/players/${encodeURIComponent(String(faceitData.nickname ?? ""))}" target="_blank" rel="noreferrer" class="fcs-ext-btn fcs-ext-btn-secondary">Tracker</a>
            </div>
            <div class="fcs-divider"></div>
            ${buildSteamSection(data)}
        `;
    }

    function buildLastMatch(recentMatch, settings) {
        if (!recentMatch || !settings.show_last_match) {
            return "";
        }

        const outcome = safeText(recentMatch.outcome, "Unknown").toLowerCase();
        const recentScore = Array.isArray(recentMatch.score) ? recentMatch.score.join(" : ") : "N/A";

        return `
            <div class="fcs-recent-card">
                <div class="fcs-recent-topline">
                    <div>
                        <div class="fcs-recent-kicker">Latest match</div>
                        <div class="fcs-recent-map">${safeText(recentMatch.map_name)}</div>
                    </div>
                    <span class="fcs-recent-outcome fcs-outcome-${outcome}">${safeText(recentMatch.outcome, "Unknown")}</span>
                </div>
                <div class="fcs-recent-score">${safeText(recentScore)}</div>
                <div class="fcs-recent-date">${formatDate(recentMatch.finished_at)}</div>
                <div class="fcs-recent-grid">
                    <div class="fcs-recent-item ${metricClass(getMetricTone("recent_rating", recentMatch.leetify_rating, settings))}">
                        <span class="fcs-recent-k">Leetify</span>
                        <span class="fcs-recent-v">${formatSignedNumber(recentMatch.leetify_rating)}</span>
                    </div>
                    <div class="fcs-recent-item ${metricClass(getMetricTone("reaction", recentMatch.reaction_time_ms, settings))}">
                        <span class="fcs-recent-k">Reaction</span>
                        <span class="fcs-recent-v">${formatNumber(recentMatch.reaction_time_ms, 0, " ms")}</span>
                    </div>
                    <div class="fcs-recent-item ${metricClass(getMetricTone("percent", recentMatch.accuracy_head, settings))}">
                        <span class="fcs-recent-k">Headshot</span>
                        <span class="fcs-recent-v">${formatPercent(recentMatch.accuracy_head, 0)}</span>
                    </div>
                    <div class="fcs-recent-item ${metricClass(getMetricTone("score_100", recentMatch.preaim, settings))}">
                        <span class="fcs-recent-k">Preaim</span>
                        <span class="fcs-recent-v">${formatNumber(recentMatch.preaim, 0)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function buildLeetifyHero(leetifyData) {
        return `
            <div class="fcs-leetify-hero">
                <div>
                    <div class="fcs-leetify-kicker">Leetify profile</div>
                    <div class="fcs-leetify-name">${safeText(leetifyData.name, "Unknown player")}</div>
                </div>
                <div class="fcs-leetify-meta">
                    <span>${safeText(leetifyData.privacy_mode, "unknown")}</span>
                    <span>Tracked since ${formatDate(leetifyData.first_match_date)}</span>
                </div>
            </div>
        `;
    }

    function buildLeetifyPanel(state) {
        const settings = state.settings;
        const leetifyData = state.leetifyData;

        if (!leetifyData) {
            return `
                <div class="fcs-section-label">LEETIFY</div>
                <div class="fcs-leetify-empty">
                    <strong>No public Leetify data available for this profile.</strong>
                    <div class="fcs-private-copy">The player may not use Leetify or their public data may be restricted.</div>
                    <div class="fcs-data-source">
                        <span class="fcs-data-note">Data Provided by Leetify</span>
                        <a href="https://leetify.com/app/profile/${encodeURIComponent(state.profile.steamId)}" target="_blank" rel="noreferrer" class="fcs-data-link">View on Leetify</a>
                    </div>
                </div>
            `;
        }

        const ranks = leetifyData.ranks ?? {};
        const rating = leetifyData.rating ?? {};
        const stats = leetifyData.stats ?? {};
        const privacyMode = safeText(leetifyData.privacy_mode, "unknown");

        return `
            <div class="fcs-section-label">LEETIFY</div>
            <div class="fcs-leetify-section">
                ${buildLeetifyHero(leetifyData)}
                <div class="fcs-leetify-grid">
                    ${buildLeetifyCard(formatNumber(ranks.premier), "PREMIER", "neutral", getPremierTierClass(ranks.premier, settings))}
                    ${buildLeetifyCard(formatSignedNumber(ranks.leetify), "LEETIFY", getMetricTone("leetify", ranks.leetify, settings))}
                    ${buildLeetifyCard(formatNumber(leetifyData.total_matches), "MATCHES", "neutral")}
                    ${buildLeetifyCard(formatPercent(leetifyData.winrate, 0, true), "WIN RATE", getMetricTone("faceit_winrate", Number(leetifyData.winrate) * 100, settings))}
                </div>
                <div class="fcs-leetify-grid">
                    ${buildLeetifyCard(formatNumber(rating.aim, 0), "AIM", getMetricTone("score_100", rating.aim, settings))}
                    ${buildLeetifyCard(formatNumber(rating.positioning, 0), "POSITION", getMetricTone("score_100", rating.positioning, settings))}
                    ${buildLeetifyCard(formatNumber(rating.utility, 0), "UTILITY", getMetricTone("score_100", rating.utility, settings))}
                    ${buildLeetifyCard(formatPercent(stats.accuracy_head, 0), "HEADSHOT", getMetricTone("percent", stats.accuracy_head, settings))}
                </div>
                ${buildLastMatch(leetifyData.recent_match, settings)}
                <div class="fcs-data-source">
                    <span class="fcs-data-note">Data Provided by Leetify | privacy: ${privacyMode}</span>
                    <a href="https://leetify.com/app/profile/${encodeURIComponent(state.profile.steamId)}" target="_blank" rel="noreferrer" class="fcs-data-link">View on Leetify</a>
                </div>
            </div>
        `;
    }

    function buildTopbar() {
        return `
            <div class="fcs-topbar">
                <div class="fcs-topbar-title">FACEIT STATS</div>
                <div class="fcs-topbar-actions">
                    <button class="fcs-refresh-btn" type="button">Refresh</button>
                </div>
            </div>
        `;
    }

    function buildLoadingMarkup() {
        return `
            <div class="fcs-root fcs-loading-root">
                <div class="fcs-topbar">
                    <div class="fcs-topbar-title">FACEIT STATS</div>
                    <div class="fcs-loading-pill">Loading</div>
                </div>
                <div class="fcs-tabs">
                    <div class="fcs-tab fcs-tab-active"><span class="fcs-tab-icon">FACEIT</span></div>
                    <div class="fcs-tab"><span class="fcs-tab-icon">Leetify</span></div>
                </div>
                <div class="fcs-loading-shell">
                    <div class="fcs-spinner"></div>
                    <div class="fcs-loading-copy">Loading FACEIT and Leetify stats...</div>
                    <div class="fcs-loading-subcopy">Fetching Steam XML, FACEIT profile, and Leetify CS2 data.</div>
                    <div class="fcs-skeleton-grid">
                        <div class="fcs-skeleton-card"></div>
                        <div class="fcs-skeleton-card"></div>
                        <div class="fcs-skeleton-card"></div>
                        <div class="fcs-skeleton-card"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildErrorMarkup(message) {
        return `
            <div class="fcs-root">
                <div class="fcs-topbar">
                    <div class="fcs-topbar-title">FACEIT STATS</div>
                    <button class="fcs-refresh-btn" type="button">Refresh</button>
                </div>
                <div class="fcs-error-box">
                    <div class="fcs-error-title">Failed to load profile stats</div>
                    <div class="fcs-error-copy">${safeText(message, "Unknown error")}</div>
                </div>
            </div>
        `;
    }

    function buildWidgetMarkup(state) {
        const rootClasses = ["fcs-root"];
        if (state.settings.layout_mode === "compact") {
            rootClasses.push("fcs-compact");
        }

        return `
                <div class="${rootClasses.join(" ")}">
                ${buildTopbar()}
                <div class="fcs-tabs">
                    <button type="button" class="fcs-tab ${state.activeTab === "faceit" ? "fcs-tab-active" : ""}" data-action="set-tab" data-value="faceit">
                        <span class="fcs-tab-icon">FACEIT</span>
                    </button>
                    <button type="button" class="fcs-tab ${state.activeTab === "leetify" ? "fcs-tab-active" : ""}" data-action="set-tab" data-value="leetify">
                        <span class="fcs-tab-icon">LEETIFY</span>
                    </button>
                </div>
                <div class="fcs-panel fcs-panel-faceit" style="display: ${state.activeTab === "faceit" ? "block" : "none"};">
                    ${buildFaceitPanel(state)}
                </div>
                <div class="fcs-panel fcs-panel-leetify" style="display: ${state.activeTab === "leetify" ? "block" : "none"};">
                    ${buildLeetifyPanel(state)}
                </div>
            </div>
        `;
    }

    function renderWidget(mount, state) {
        mount.innerHTML = buildWidgetMarkup(state);
        attachInteractions(mount, state);
    }

    function attachInteractions(container, state) {
        container.querySelector(".fcs-refresh-btn")?.addEventListener("click", () => {
            window.location.reload();
        });

        container.querySelectorAll('[data-action="set-tab"]').forEach((button) => {
            button.addEventListener("click", () => {
                state.activeTab = button.getAttribute("data-value") || "faceit";
                renderWidget(container, state);
            });
        });
    }

    async function loadProfileState() {
        const profileBaseUrl = getProfileBaseUrl();
        const [profileDoc, gamesDoc, statsDoc, settings] = await Promise.all([
            fetchXmlDocument(`${profileBaseUrl}/?xml=1`),
            fetchXmlDocument(`${profileBaseUrl}/games?tab=all&xml=1`),
            fetchXmlDocument(`${profileBaseUrl}/stats/CSGO?xml=1`),
            loadWidgetSettings(),
        ]);

        const steamId = profileDoc.querySelector("steamID64")?.textContent?.trim() || "0";
        const memberSince = profileDoc.querySelector("memberSince")?.textContent?.trim() || "N/A";
        const vacBanned = parseInt(profileDoc.querySelector("vacBanned")?.textContent || "0", 10);
        const tradeBanState = profileDoc.querySelector("tradeBanState")?.textContent?.trim() || "Unknown";
        const isLimited = parseInt(profileDoc.querySelector("isLimitedAccount")?.textContent || "0", 10);

        const cs2Game = Array.from(gamesDoc.querySelectorAll("game")).find(
            (game) => game.querySelector("appID")?.textContent === "730"
        );
        const totalHours = cs2Game?.querySelector("hoursOnRecord")?.textContent?.trim() || "Private";
        const recentHours = cs2Game?.querySelector("hoursLast2Weeks")?.textContent?.trim() || "Private";

        const achievementTimestamp = statsDoc.querySelector("achievement > unlockTimestamp")?.textContent ?? null;
        const cs2StartDate = achievementTimestamp
            ? new Date(parseInt(achievementTimestamp, 10) * 1000).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
              })
            : "None";

        const [faceitData, leetifyData] = await Promise.all([
            loadFaceitData(steamId),
            loadLeetifyData(steamId),
        ]);

        return {
            profile: {
                steamId,
                memberSince,
                vacBanned,
                tradeBanState,
                isLimited,
                totalHours,
                recentHours,
                cs2StartDate,
            },
            settings,
            activeTab: settings.default_tab,
            faceitData,
            leetifyData,
        };
    }

    async function injectWidget() {
        if (!/^\/(id|profiles)\//.test(window.location.pathname)) {
            return;
        }

        console.log("[Faceit Stats] Webkit module loading...");

        const rightCols = await Millennium.findElement(document, ".profile_rightcol");
        const rightCol = rightCols[0];

        if (!rightCol) {
            console.error('[Faceit Stats] Parent container ".profile_rightcol" not found');
            return;
        }

        if (rightCol.querySelector(".fcs-root")) {
            return;
        }

        const mount = document.createElement("div");
        mount.innerHTML = buildLoadingMarkup();
        rightCol.insertBefore(mount, rightCol.children[1] ?? null);

        try {
            const state = await loadProfileState();
            renderWidget(mount, state);
            console.log("[Faceit Stats] Widget injected successfully.");
        } catch (error) {
            console.error("[Faceit Stats] Failed to inject widget", error);
            mount.innerHTML = buildErrorMarkup(error?.message || "Unknown error");

            const refreshBtn = mount.querySelector(".fcs-refresh-btn");
            refreshBtn?.addEventListener("click", () => {
                window.location.reload();
            });
        }
    }

    injectWidget().catch((error) => {
        console.error("[Faceit Stats] Failed to inject widget", error);
    });
})();
