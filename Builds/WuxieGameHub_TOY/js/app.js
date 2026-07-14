(function () {
  const STORAGE_KEYS = {
    clicks: "wuxie-game-hub:clicks",
    recent: "wuxie-game-hub:recent"
  };

  const MAX_RECENT = 5;
  const statusMap = {
    playable: "可试玩",
    developing: "开发中"
  };

  const state = {
    filter: "all",
    games: [],
    clicks: readStorage(STORAGE_KEYS.clicks, {}),
    recent: readStorage(STORAGE_KEYS.recent, []),
    selfTestMode: new URLSearchParams(window.location.search).get("selftest") === "1"
  };

  const elements = {
    randomButton: document.getElementById("random-play-button"),
    fallback: document.getElementById("load-fallback"),
    heroStats: document.getElementById("hero-inline-stats"),
    filterRow: document.getElementById("filter-row"),
    gamesGrid: document.getElementById("games-grid"),
    emptyState: document.getElementById("empty-state"),
    statusCounters: document.getElementById("status-counters"),
    recentPlayCount: document.getElementById("recent-play-count"),
    recentPlayList: document.getElementById("recent-play-list"),
    topClickSummary: document.getElementById("top-click-summary"),
    topClickHighlight: document.getElementById("top-click-highlight")
  };

  try {
    const incomingGames = Array.isArray(window.WUXIE_GAMES) ? window.WUXIE_GAMES.slice() : [];
    state.games = sortGamesByReleaseDate(incomingGames);
    initialize();
  } catch (error) {
    handleFatalError(error);
  }

  function initialize() {
    bindStaticActions();

    if (!state.games.length) {
      renderFailure("游戏数据暂时没有成功加载。页面主框架仍然可用，请检查 `js/games.js` 是否存在并刷新。");
      return;
    }

    renderFilters();
    renderAll();
    setFallbackMessage("作品目录加载成功。你可以筛选类型、随机开始，页面会记录最近游玩和点击习惯。");
    runSelfTestIfNeeded();
  }

  function bindStaticActions() {
    if (elements.randomButton) {
      elements.randomButton.addEventListener("click", handleRandomPlay);
    }

    document.querySelectorAll("[data-action='open-space']").forEach(function (button) {
      button.addEventListener("click", function () {
        const mid = button.getAttribute("data-space-mid");
        if (mid) {
          openSpaceProfile(mid);
        }
      });
    });

    document.querySelectorAll("[data-scroll-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        const targetId = button.getAttribute("data-scroll-target");
        const target = targetId ? document.getElementById(targetId) : null;

        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function renderAll() {
    renderHeroStats();
    renderStatusPanel();
    renderGames();
    syncRandomButton();
    syncDiagnostics();
  }

  function renderFilters() {
    const types = Array.from(
      new Set(
        state.games
          .map(function (game) {
            return game.type;
          })
          .filter(Boolean)
      )
    );

    const buttons = ['<button class="filter-chip is-active" type="button" data-filter="all">全部</button>']
      .concat(
        types.map(function (type) {
          return '<button class="filter-chip" type="button" data-filter="' + escapeHtml(type) + '">' + escapeHtml(type) + "</button>";
        })
      )
      .join("");

    elements.filterRow.innerHTML = buttons;
    elements.filterRow.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.filter = button.getAttribute("data-filter") || "all";
        elements.filterRow.querySelectorAll("[data-filter]").forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        renderGames();
        syncDiagnostics();
      });
    });
  }

  function renderHeroStats() {
    const total = state.games.length;
    const playable = getPlayableGames().length;
    const types = new Set(
      state.games.map(function (game) {
        return game.type;
      })
    ).size;

    elements.heroStats.innerHTML = [
      "<span>已收录 " + total + " 款作品</span>",
      "<span>当前可试玩 " + playable + " 款</span>",
      "<span>类型分布 " + types + " 类</span>"
    ].join("");
  }

  function renderStatusPanel() {
    const total = state.games.length;
    const playable = getPlayableGames().length;
    const developing = state.games.filter(function (game) {
      return game.status === "developing";
    }).length;

    elements.statusCounters.innerHTML = [
      createStatusCounter("已收录", total),
      createStatusCounter("可试玩", playable),
      createStatusCounter("开发中", developing)
    ].join("");

    renderRecentList();
    renderTopClicks();
  }

  function renderGames() {
    const filteredGames = getFilteredGames();

    if (!filteredGames.length) {
      elements.gamesGrid.innerHTML = "";
      elements.emptyState.hidden = false;
      syncDiagnostics();
      return;
    }

    elements.emptyState.hidden = true;
    elements.gamesGrid.innerHTML = filteredGames.map(renderGameCard).join("");

    elements.gamesGrid.querySelectorAll("[data-action='play']").forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-id");
        const game = findGame(id);

        if (!game || !game.toyUrl) {
          showToast("这款游戏暂时没有可用的试玩地址。");
          return;
        }

        incrementClick(id);
        rememberRecentPlay(id);
        openExternalLink(game.toyUrl);
        renderStatusPanel();
        renderGames();
        syncDiagnostics();
      });
    });

    elements.gamesGrid.querySelectorAll("[data-action='video']").forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-id");
        const game = findGame(id);

        if (!game || !game.videoUrl) {
          showToast("这款作品还没有配置视频入口。");
          return;
        }

        incrementClick(id);
        openVideoEntry(game);
        renderStatusPanel();
        renderGames();
        syncDiagnostics();
      });
    });

    syncDiagnostics();
  }

  function renderGameCard(game) {
    const clickCount = Number(state.clicks[game.id] || 0);
    const recentEntry = state.recent.find(function (entry) {
      return entry.id === game.id;
    });
    const recentText = recentEntry ? formatDateTime(recentEntry.playedAt) : "尚未游玩";
    const isPlayable = game.status === "playable" && Boolean(game.toyUrl);
    const buttonDisabled = isPlayable ? "" : " disabled";
    const statusClass = game.status === "developing" ? "status-pill is-building" : "status-pill";

    return [
      '<article class="game-card">',
      renderCover(game),
      '<div class="game-card__body">',
      '<div class="game-card__heading">',
      '<div class="game-card__heading-top">',
      '<h3 class="game-card__title">' + escapeHtml(game.title) + "</h3>",
      '<span class="' + statusClass + '">' + escapeHtml(game.statusText || statusMap[game.status] || "未知状态") + "</span>",
      "</div>",
      '<div class="card-meta">',
      '<span class="meta-pill">' + escapeHtml(game.type) + "</span>",
      '<span class="meta-pill">上线 ' + escapeHtml(game.releasedAt || "待定") + "</span>",
      "</div>",
      "</div>",
      "<p>" + escapeHtml(game.description || "暂无简介") + "</p>",
      '<div class="tag-row">' + renderTags(game.tags) + "</div>",
      '<div class="game-card__stats">',
      "<span>点击 " + clickCount + " 次</span>",
      "<span>最近游玩 " + escapeHtml(recentText) + "</span>",
      "</div>",
      '<div class="card-actions">',
      '<button class="card-button card-button--primary" type="button" data-action="play" data-id="' + escapeHtml(game.id) + '"' + buttonDisabled + ">开始游戏</button>",
      '<button class="card-button" type="button" data-action="video" data-id="' + escapeHtml(game.id) + '">查看视频</button>',
      "</div>",
      "</div>",
      "</article>"
    ].join("");
  }

  function renderCover(game) {
    const primary = game.palette && game.palette.primary ? game.palette.primary : "#ffb84d";
    const secondary = game.palette && game.palette.secondary ? game.palette.secondary : "#78f2cf";
    const glow = game.palette && game.palette.glow ? game.palette.glow : "rgba(255, 216, 133, 0.32)";
    const coverImage = game.coverImage ? encodeURI(game.coverImage) : "";
    const coverStyle = [
      "background:",
      "radial-gradient(circle at 20% 20%, " + glow + ", transparent 34%),",
      "linear-gradient(135deg, " + primary + ", " + secondary + ");"
    ].join(" ");

    return [
      '<div class="game-card__cover' + (coverImage ? " has-image" : "") + '" style="' + escapeHtml(coverStyle) + '">',
      coverImage
        ? '<img class="game-card__cover-image" src="' + escapeHtml(coverImage) + '" alt="' + escapeHtml(game.title) + ' 封面" loading="lazy" decoding="async">'
        : '<strong class="game-card__cover-fallback">' + escapeHtml(game.title) + "</strong>",
      "</div>"
    ].join("");
  }

  function renderTags(tags) {
    if (!Array.isArray(tags) || !tags.length) {
      return '<span class="tag">待补充</span>';
    }

    return tags
      .map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + "</span>";
      })
      .join("");
  }

  function renderRecentList() {
    if (!state.recent.length) {
      elements.recentPlayCount.textContent = "0 条记录";
      elements.recentPlayList.innerHTML = "<li>还没有游玩记录，先点一款试试。</li>";
      return;
    }

    const recentGames = state.recent
      .map(function (entry) {
        const game = findGame(entry.id);
        if (!game) {
          return "";
        }

        return "<li>" + escapeHtml(game.title) + " · " + escapeHtml(formatDateTime(entry.playedAt)) + "</li>";
      })
      .filter(Boolean);

    elements.recentPlayCount.textContent = recentGames.length + " 条记录";
    elements.recentPlayList.innerHTML = recentGames.join("");
  }

  function renderTopClicks() {
    const clickEntries = Object.keys(state.clicks)
      .map(function (id) {
        return {
          id: id,
          count: Number(state.clicks[id] || 0)
        };
      })
      .filter(function (entry) {
        return entry.count > 0;
      })
      .sort(function (left, right) {
        return right.count - left.count;
      });

    if (!clickEntries.length) {
      elements.topClickSummary.textContent = "等待统计";
      elements.topClickHighlight.textContent = "点击任意卡片后，这里会记录你的偏好。";
      return;
    }

    const topEntry = clickEntries[0];
    const topGame = findGame(topEntry.id);

    if (!topGame) {
      elements.topClickSummary.textContent = "数据待刷新";
      elements.topClickHighlight.textContent = "当前最高频游戏记录无法匹配到作品数据。";
      return;
    }

    elements.topClickSummary.textContent = "最高 " + topEntry.count + " 次";
    elements.topClickHighlight.innerHTML = [
      "<strong>" + escapeHtml(topGame.title) + "</strong>",
      "<br>",
      "<span>目前是你的点击冠军，类型为 " + escapeHtml(topGame.type) + "。</span>"
    ].join("");
  }

  function syncRandomButton() {
    const playableGames = getPlayableGames();
    const isDisabled = !playableGames.length;

    if (!elements.randomButton) {
      return;
    }

    elements.randomButton.disabled = isDisabled;
    if (isDisabled) {
      elements.randomButton.textContent = "暂无可试玩作品";
    }
  }

  function handleRandomPlay() {
    const playableGames = getPlayableGames();

    if (!playableGames.length) {
      showToast("当前没有状态为可试玩的游戏。");
      return;
    }

    const selected = playableGames[Math.floor(Math.random() * playableGames.length)];
    incrementClick(selected.id);
    rememberRecentPlay(selected.id);
    openExternalLink(selected.toyUrl);
    renderStatusPanel();
    renderGames();
    syncDiagnostics();
  }

  async function openSpaceProfile(mid) {
    const spaceMid = String(mid || "").trim();
    if (!spaceMid) {
      showToast("作者主页暂时不可用。");
      return;
    }

    try {
      if (
        window.toy &&
        typeof window.toy.isSupport === "function" &&
        typeof window.toy.navigate === "function"
      ) {
        const supported = await window.toy.isSupport("navigate");
        if (supported) {
          await window.toy.navigate({
            type: "space",
            id: spaceMid,
            extra: { from: "toy" }
          });
          return;
        }
      }
    } catch (error) {
      console.error(error);
    }

    openExternalLink("https://space.bilibili.com/" + encodeURIComponent(spaceMid));
  }

  async function openVideoEntry(game) {
    const videoBvid = getVideoBvid(game);

    try {
      if (
        videoBvid &&
        window.toy &&
        typeof window.toy.isSupport === "function" &&
        typeof window.toy.navigate === "function"
      ) {
        const supported = await window.toy.isSupport("navigate");
        if (supported) {
          await window.toy.navigate({
            type: "video",
            id: videoBvid,
            extra: { from: "toy" }
          });
          return;
        }
      }
    } catch (error) {
      console.error(error);
    }

    if (game && game.videoUrl) {
      openExternalLink(game.videoUrl);
      return;
    }

    showToast("这款作品还没有配置视频入口。");
  }

  function getVideoBvid(game) {
    if (!game) {
      return "";
    }

    if (game.videoBvid) {
      return String(game.videoBvid).trim();
    }

    const matched = String(game.videoUrl || "").match(/\/video\/(BV[0-9A-Za-z]+)/i);
    return matched ? matched[1] : "";
  }

  function getPlayableGames() {
    return state.games.filter(function (game) {
      return game.status === "playable" && Boolean(game.toyUrl);
    });
  }

  function sortGamesByReleaseDate(games) {
    return games
      .map(function (game, index) {
        return {
          game: game,
          index: index,
          timestamp: getReleaseTimestamp(game.releasedAt)
        };
      })
      .sort(function (left, right) {
        if (right.timestamp !== left.timestamp) {
          return right.timestamp - left.timestamp;
        }

        return left.index - right.index;
      })
      .map(function (entry) {
        return entry.game;
      });
  }

  function getReleaseTimestamp(value) {
    if (!value) {
      return Number.NEGATIVE_INFINITY;
    }

    const matched = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!matched) {
      return Number.NEGATIVE_INFINITY;
    }

    return Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  }

  function getFilteredGames() {
    return state.games.filter(function (game) {
      if (state.filter === "all") {
        return true;
      }

      return game.type === state.filter;
    });
  }

  function findGame(id) {
    return state.games.find(function (game) {
      return game.id === id;
    });
  }

  function incrementClick(id) {
    state.clicks[id] = Number(state.clicks[id] || 0) + 1;
    writeStorage(STORAGE_KEYS.clicks, state.clicks);
  }

  function rememberRecentPlay(id) {
    const timestamp = new Date().toISOString();
    const nextRecent = [{ id: id, playedAt: timestamp }]
      .concat(
        state.recent.filter(function (entry) {
          return entry.id !== id;
        })
      )
      .slice(0, MAX_RECENT);

    state.recent = nextRecent;
    writeStorage(STORAGE_KEYS.recent, state.recent);
  }

  function openExternalLink(url) {
    try {
      const nextWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!nextWindow) {
        window.location.href = url;
      }
    } catch (error) {
      showToast("外部页面打开失败，请稍后重试。");
      console.error(error);
    }
  }

  function setFallbackMessage(message) {
    if (!elements.fallback) {
      return;
    }

    elements.fallback.innerHTML = "<strong>页面已经点亮。</strong><span>" + escapeHtml(message) + "</span>";
  }

  function renderFailure(message) {
    setFallbackMessage(message);
    elements.heroStats.innerHTML = "<span>目录读取失败，但页面主框架仍可见</span>";
    elements.gamesGrid.innerHTML = "";
    elements.emptyState.hidden = false;
    elements.emptyState.querySelector("h3").textContent = "作品目录暂时不可用";
    elements.emptyState.querySelector("p").textContent = "请检查脚本或资源路径，然后刷新页面重新载入。";
    syncRandomButton();
    syncDiagnostics();
  }

  function handleFatalError(error) {
    renderFailure("页面逻辑初始化失败，但没有白屏。请检查控制台报错并刷新。");
    console.error(error);
    syncDiagnostics();
  }

  function runSelfTestIfNeeded() {
    if (!state.selfTestMode) {
      return;
    }

    try {
      const openCalls = [];
      window.open = function (url) {
        openCalls.push(url);
        return { closed: false };
      };

      state.filter = "音乐节奏";
      const rhythmCount = getFilteredGames().length;
      state.filter = "all";
      handleRandomPlay();

      const runtime = window.__WUXIE_RUNTIME__;
      if (runtime) {
        runtime.selfTest = {
          rhythmCount: rhythmCount,
          clickStorage: window.localStorage.getItem(STORAGE_KEYS.clicks),
          recentStorage: window.localStorage.getItem(STORAGE_KEYS.recent),
          topClickText: elements.topClickHighlight ? elements.topClickHighlight.textContent.trim() : "",
          recentListText: elements.recentPlayList ? elements.recentPlayList.textContent.trim() : "",
          openCalls: openCalls
        };
      }
      syncDiagnostics();
    } catch (error) {
      const runtime = window.__WUXIE_RUNTIME__;
      if (runtime) {
        runtime.selfTest = {
          failed: true,
          message: error && error.message ? error.message : String(error)
        };
      }
      syncDiagnostics();
    }
  }

  function createStatusCounter(label, value) {
    return [
      '<article class="status-chip">',
      '<span class="status-chip__label">' + escapeHtml(label) + "</span>",
      "<strong>" + escapeHtml(String(value)) + "</strong>",
      "</article>"
    ].join("");
  }

  function formatDateTime(value) {
    if (!value) {
      return "未知时间";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "时间待定";
    }

    const parts = [
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ];
    const time = [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0")
    ];

    return parts.join("-") + " " + time.join(":");
  }

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("Failed to read localStorage", error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Failed to write localStorage", error);
    }
  }

  function showToast(message) {
    const existing = document.querySelector(".toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    window.setTimeout(function () {
      toast.remove();
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function syncDiagnostics() {
    const runtime = window.__WUXIE_RUNTIME__;

    if (!runtime) {
      return;
    }

    runtime.ready = Boolean(state.games.length);
    runtime.totalGames = state.games.length;
    runtime.playableGames = getPlayableGames().length;
    runtime.renderedGames = elements.gamesGrid ? elements.gamesGrid.querySelectorAll(".game-card").length : 0;
    runtime.activeFilter = state.filter;
    runtime.emptyStateVisible = elements.emptyState ? !elements.emptyState.hidden : false;
    runtime.storage = {
      clickEntries: Object.keys(state.clicks).length,
      recentEntries: state.recent.length
    };
    runtime.viewport = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };

    if (typeof window.__WUXIE_SYNC_DIAGNOSTICS__ === "function") {
      window.__WUXIE_SYNC_DIAGNOSTICS__();
    }
  }
})();
