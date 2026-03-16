/// <reference path="./millennium.d.ts" />

// Объявление серверного метода для вызова Python бэкенда
declare const __call_server_method__: (methodName: string, kwargs: Record<string, unknown>) => Promise<string>;

// Типы данных для статистики FACEIT
type FaceitStats = {
    matches?: number;
    avg_hs?: number;
    avg_kd?: number;
    adr?: number;
    winrate?: number;
};

type FaceitData = {
    id?: string;
    nickname?: string;
    country?: string;
    avatar?: string;
    cover_image_url?: string;
    faceit_elo?: number;
    skill_level?: number;
    stats?: FaceitStats | null;
} | null;

// Экранирование HTML для безопасности
function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeText(value: unknown, fallback = "N/A"): string {
    const text = String(value ?? "").trim();
    return text ? escapeHtml(text) : fallback;
}

// Безопасное форматирование URL
function safeUrl(value: unknown): string {
    const text = String(value ?? "").trim();
    return text ? escapeHtml(text) : "";
}

// Форматирование чисел с заданной точностью
function formatNumber(value: unknown, decimals = 0, suffix = ""): string {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numericValue)) {
        return "N/A";
    }

    return `${numericValue.toFixed(decimals)}${suffix}`;
}

// Получение базового URL профиля
function getProfileBaseUrl(): string {
    return `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, "");
}

// Загрузка XML документа с профиля Steam
async function fetchXmlDocument(url: string): Promise<Document> {
    const response = await fetch(url);
    const xmlText = await response.text();
    return new DOMParser().parseFromString(xmlText, "application/xml");
}

// Загрузка данных FACEIT через Python бэкенд
async function loadFaceitData(steamId: string): Promise<FaceitData> {
    try {
        const faceitDataRaw = await __call_server_method__("get_user_by_steamId", { steamId });
        return JSON.parse(faceitDataRaw) as FaceitData;
    } catch (error) {
        console.error("Failed to load Faceit data", error);
        return null;
    }
}

// Построение панели FACEIT с полной статистикой
function buildFaceitPanel(faceitData: FaceitData, steamId: string, memberSince: string, cs2StartDate: string, totalHours: string, recentHours: string, vacBanned: number, tradeBanState: string, isLimited: number): string {
    const steamSection = `
        <div class="fcs-section-label">STEAM</div>
        <div class="fcs-steam-section">
            <div class="fcs-steam-rows">
                <div class="fcs-steam-row">
                    <span class="fcs-steam-key">Member since</span>
                    <span class="fcs-steam-val">${safeText(memberSince)}</span>
                </div>
                <div class="fcs-steam-row">
                    <span class="fcs-steam-key">CS2 since</span>
                    <span class="fcs-steam-val">${safeText(cs2StartDate)}</span>
                </div>
            </div>
            <div class="fcs-hours-grid">
                <div class="fcs-hours-card">
                    <div class="fcs-hours-val">${safeText(totalHours, "Private")}</div>
                    <div class="fcs-hours-lbl">CS2 TOTAL</div>
                </div>
                <div class="fcs-hours-card">
                    <div class="fcs-hours-val">${safeText(recentHours, "Private")}</div>
                    <div class="fcs-hours-lbl">LAST 2 WEEKS</div>
                </div>
            </div>
            <div class="fcs-ext-row">
                <a href="https://csstats.gg/player/${encodeURIComponent(steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">CSSTATS</a>
                <a href="https://leetify.com/app/profile/${encodeURIComponent(steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">LEETIFY</a>
                <a href="https://steamid.io/lookup/${encodeURIComponent(steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">FINDER</a>
            </div>
            ${vacBanned === 0 && tradeBanState === "None" && isLimited === 0 ? `
                <div class="fcs-clean-row">
                    <span class="fcs-badge fcs-badge-clean">Clean Profile</span>
                </div>
            ` : `
                <div class="fcs-ban-row">
                    ${vacBanned !== 0 ? '<span class="fcs-badge fcs-badge-ban">VAC Ban</span>' : ""}
                    ${tradeBanState !== "None" ? '<span class="fcs-badge fcs-badge-ban">Trade Ban</span>' : ""}
                    ${isLimited !== 0 ? '<span class="fcs-badge fcs-badge-warn">Limited</span>' : ""}
                </div>
            `}
        </div>
    `;

    if (!faceitData) {
        return `
            ${steamSection}
            <div class="fcs-divider"></div>
            <div class="fcs-no-faceit">
                <strong>No FACEIT account linked to this Steam profile.</strong>
            </div>
        `;
    }

    // Формирование данных для отображения FACEIT профиля
    const nickname = safeText(faceitData.nickname, "Unknown");
    const country = safeText(faceitData.country, "default").toLowerCase();
    const avatarUrl = safeUrl(faceitData.avatar);
    const coverImageUrl = safeUrl(faceitData.cover_image_url);
    const skillLevel = Number(faceitData.skill_level ?? 0);
    const stats = faceitData.stats ?? {};
    // Путь к иконке уровня (исправлен на FaceItFinder)
    const levelIconUrl = `https://steamloopback.host/FaceItFinder/skill_level_${skillLevel}_lg.png`;

    return `
        ${steamSection}
        <div class="fcs-divider"></div>
        <div class="fcs-faceit-label">FACEIT</div>
        <div class="fcs-faceit-section">
            <div class="fcs-cover" style="background-image: url('${coverImageUrl}')"></div>
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
                        <img src="${levelIconUrl}" class="fcs-elo-level-icon" alt="Level ${formatNumber(skillLevel)}" title="FACEIT Level ${formatNumber(skillLevel)}">
                        <span class="fcs-elo-dot"></span>
                        <span class="fcs-elo-stack">
                            <span class="fcs-elo-main">${formatNumber(faceitData.faceit_elo)}</span>
                            <span class="fcs-elo-unit">ELO</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="fcs-stats-grid">
                <div class="fcs-stat">
                    <div class="fcs-stat-val">${formatNumber(stats.matches)}</div>
                    <div class="fcs-stat-lbl">MATCHES</div>
                </div>
                <div class="fcs-stat">
                    <div class="fcs-stat-val">${formatNumber(faceitData.faceit_elo)}</div>
                    <div class="fcs-stat-lbl">ELO</div>
                </div>
                <div class="fcs-stat">
                    <div class="fcs-stat-val">${formatNumber(stats.avg_kd, 2)}</div>
                    <div class="fcs-stat-lbl">K/D</div>
                </div>
                <div class="fcs-stat">
                    <div class="fcs-stat-val">${formatNumber(stats.winrate, 0, "%")}</div>
                    <div class="fcs-stat-lbl">WIN RATE</div>
                </div>
                <div class="fcs-stat">
                    <div class="fcs-stat-val">${formatNumber(stats.avg_hs, 0, "%")}</div>
                    <div class="fcs-stat-lbl">HEADSHOT</div>
                </div>
                <div class="fcs-stat">
                    <div class="fcs-stat-val">${formatNumber(stats.adr, 0)}</div>
                    <div class="fcs-stat-lbl">ADR</div>
                </div>
            </div>
        </div>
        <div class="fcs-panel-footer">
            <a href="https://www.faceit.com/en/players/${encodeURIComponent(String(faceitData.nickname ?? ""))}" target="_blank" rel="noreferrer" class="fcs-ext-btn">FACEIT Profile</a>
            <a href="https://faceittracker.net/players/${encodeURIComponent(String(faceitData.nickname ?? ""))}" target="_blank" rel="noreferrer" class="fcs-ext-btn fcs-ext-btn-secondary">Tracker</a>
        </div>
    `;
}

function buildCs2Panel(memberSince: string, cs2StartDate: string, totalHours: string, recentHours: string, steamId: string, vacBanned: number, tradeBanState: string, isLimited: number): string {
    return `
        <div class="fcs-section-label">STEAM INFO</div>
        <div class="fcs-steam-section">
            <div class="fcs-steam-rows">
                <div class="fcs-steam-row">
                    <span class="fcs-steam-key">Member since</span>
                    <span class="fcs-steam-val">${safeText(memberSince)}</span>
                </div>
                <div class="fcs-steam-row">
                    <span class="fcs-steam-key">CS2 since</span>
                    <span class="fcs-steam-val">${safeText(cs2StartDate)}</span>
                </div>
            </div>
            <div class="fcs-hours-grid">
                <div class="fcs-hours-card">
                    <div class="fcs-hours-val">${safeText(totalHours, "Private")}</div>
                    <div class="fcs-hours-lbl">CS2 TOTAL</div>
                </div>
                <div class="fcs-hours-card">
                    <div class="fcs-hours-val">${safeText(recentHours, "Private")}</div>
                    <div class="fcs-hours-lbl">LAST 2 WEEKS</div>
                </div>
            </div>
            <div class="fcs-ext-row">
                <a href="https://csstats.gg/player/${encodeURIComponent(steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">CSSTATS</a>
                <a href="https://leetify.com/app/profile/${encodeURIComponent(steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">LEETIFY</a>
                <a href="https://steamid.io/lookup/${encodeURIComponent(steamId)}" target="_blank" rel="noreferrer" class="fcs-ext-chip">FINDER</a>
            </div>
            ${vacBanned === 0 && tradeBanState === "None" && isLimited === 0 ? `
                <div class="fcs-clean-row">
                    <span class="fcs-badge fcs-badge-clean">Clean Profile</span>
                </div>
            ` : `
                <div class="fcs-ban-row">
                    ${vacBanned !== 0 ? '<span class="fcs-badge fcs-badge-ban">VAC Ban</span>' : ""}
                    ${tradeBanState !== "None" ? '<span class="fcs-badge fcs-badge-ban">Trade Ban</span>' : ""}
                    ${isLimited !== 0 ? '<span class="fcs-badge fcs-badge-warn">Limited</span>' : ""}
                </div>
            `}
        </div>
        <div class="fcs-cs2-footer">
            <div class="fcs-cs2-note">FACEIT stats are loaded in the FACEIT tab. Steam tab stays focused on profile health and playtime.</div>
        </div>
    `;
}

export default async function () {
    console.log("FaceIt Stats loaded.");

    const rightCol = await Millennium.findElement(document, ".profile_rightcol");
    if (rightCol.length === 0) {
        console.error('Parent container ".profile_rightcol" not found');
        return;
    }

    if (rightCol[0].querySelector(".fcs-root")) {
        return;
    }

    try {
        const profileBaseUrl = getProfileBaseUrl();
        const [profileDoc, gamesDoc, statsDoc] = await Promise.all([
            fetchXmlDocument(`${profileBaseUrl}/?xml=1`),
            fetchXmlDocument(`${profileBaseUrl}/games?tab=all&xml=1`),
            fetchXmlDocument(`${profileBaseUrl}/stats/CSGO?xml=1`),
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

        const faceitData = await loadFaceitData(steamId);

        const container = document.createElement("div");
        container.innerHTML = `
            <div class="fcs-root">
                <div class="fcs-topbar">
                    <div class="fcs-topbar-title">FACEIT STATS</div>
                    <button class="fcs-refresh-btn" type="button">Refresh</button>
                </div>
                <div class="fcs-tabs">
                    <div class="fcs-tab fcs-tab-active" data-tab="faceit">
                        <span class="fcs-tab-icon">FACEIT</span>
                    </div>
                    <div class="fcs-tab" data-tab="cs2">
                        <span class="fcs-tab-icon">STEAM</span>
                    </div>
                </div>
                <div class="fcs-panel fcs-panel-faceit">
                    ${buildFaceitPanel(faceitData, steamId, memberSince, cs2StartDate, totalHours, recentHours, vacBanned, tradeBanState, isLimited)}
                </div>
                <div class="fcs-panel fcs-panel-cs2" style="display: none;">
                    ${buildCs2Panel(memberSince, cs2StartDate, totalHours, recentHours, steamId, vacBanned, tradeBanState, isLimited)}
                </div>
            </div>
        `;

        rightCol[0].insertBefore(container, rightCol[0].children[1] ?? null);

        const tabs = container.querySelectorAll(".fcs-tab");
        const faceitPanel = container.querySelector(".fcs-panel-faceit") as HTMLElement | null;
        const cs2Panel = container.querySelector(".fcs-panel-cs2") as HTMLElement | null;

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                const tabName = tab.getAttribute("data-tab");
                tabs.forEach((item) => item.classList.remove("fcs-tab-active"));
                tab.classList.add("fcs-tab-active");

                if (!faceitPanel || !cs2Panel) {
                    return;
                }

                faceitPanel.style.display = tabName === "faceit" ? "block" : "none";
                cs2Panel.style.display = tabName === "cs2" ? "block" : "none";
            });
        });

        const refreshBtn = container.querySelector(".fcs-refresh-btn");
        refreshBtn?.addEventListener("click", () => {
            window.location.reload();
        });
    } catch (error) {
        console.error(error);
    }
}
