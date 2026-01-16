// Wrap in IIFE to avoid re-declaration errors on multiple injections
(function () {
  // ====================== STATE ======================

  // Store state on window to persist across re-injections
  if (!window.__alignToolState) {
    window.__alignToolState = {
      selectedItems: [],
      overlay: null,
      hoverItem: null,
      boxOverlays: [],
      controlBar: null,
      sidePanel: null,
      resizeListenerAttached: false,
      scrollListenerAttached: false,
      idCounter: 1,
    };
  }

  const state = window.__alignToolState;
  const MAX_ELEMENTS = 100;

  // ====================== START / STOP ======================

  function startup() {
    createOverlay();
    addControlBar();
    addSidePanel();

    state.overlay.addEventListener("click", handleOverlayClick, true);
    state.overlay.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("keydown", handleKeydown, true);

    if (!state.resizeListenerAttached) {
      window.addEventListener("resize", handleReposition, true);
      state.resizeListenerAttached = true;
    }

    if (!state.scrollListenerAttached) {
      window.addEventListener("scroll", handleReposition, true);
      state.scrollListenerAttached = true;
    }
  }

  function shutdown() {
    state.overlay?.removeEventListener("click", handleOverlayClick, true);
    state.overlay?.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("keydown", handleKeydown, true);

    if (state.resizeListenerAttached) {
      window.removeEventListener("resize", handleReposition, true);
      state.resizeListenerAttached = false;
    }

    if (state.scrollListenerAttached) {
      window.removeEventListener("scroll", handleReposition, true);
      state.scrollListenerAttached = false;
    }

    state.overlay?.remove();
    state.boxOverlays.forEach((b) => b.remove());
    state.selectedItems.forEach((i) => i.badge?.remove());
    state.controlBar?.remove();
    state.sidePanel?.remove();

    state.overlay = null;
    state.boxOverlays = [];
    state.selectedItems = [];
    state.hoverItem = null;
    state.controlBar = null;
    state.sidePanel = null;
    state.idCounter = 1;
  }

  // ====================== UI ======================

  function createOverlay() {
    state.overlay = document.createElement("div");
    Object.assign(state.overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: 2147483647,
      pointerEvents: "auto",
      cursor: "crosshair",
    });
    document.body.appendChild(state.overlay);
  }

  function addControlBar() {
    state.controlBar = document.createElement("div");
    Object.assign(state.controlBar.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      display: "flex",
      gap: "8px",
      zIndex: 2147483647,
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "🧹 Clear";
    styleBtn(clearBtn);
    clearBtn.onclick = () => {
      state.selectedItems.forEach((i) => i.badge?.remove());
      state.selectedItems = [];
      state.idCounter = 1;
      drawAll();
    };

    const offBtn = document.createElement("button");
    offBtn.textContent = "⛔ Turn Off";
    styleBtn(offBtn);
    offBtn.onclick = () => {
      window.__alignToolActive = false;
      shutdown();
    };

    state.controlBar.appendChild(clearBtn);
    state.controlBar.appendChild(offBtn);
    document.body.appendChild(state.controlBar);
  }

  function styleBtn(btn) {
    Object.assign(btn.style, {
      padding: "6px 10px",
      fontSize: "12px",
      background: "#111",
      color: "#fff",
      border: "1px solid #333",
      borderRadius: "6px",
      cursor: "pointer",
    });
  }

  function addSidePanel() {
    state.sidePanel = document.createElement("div");
    Object.assign(state.sidePanel.style, {
      position: "fixed",
      right: "16px",
      top: "72px",
      width: "340px",
      maxHeight: "65vh",
      overflow: "auto",
      background: "#0b0b0b",
      color: "#fff",
      border: "1px solid #333",
      borderRadius: "10px",
      fontSize: "12px",
      zIndex: 2147483647,
    });

    state.sidePanel.innerHTML = `
      <div id="align-drag-handle" style="padding:10px;border-bottom:1px solid #333;font-weight:bold;cursor:move">
        Alignment Inspector (Base = Element 1)
      </div>
      <div id="align-list"></div>
    `;

    document.body.appendChild(state.sidePanel);
    makeDraggable(
      state.sidePanel,
      state.sidePanel.querySelector("#align-drag-handle")
    );
  }

  // ====================== EVENTS ======================

  function handleOverlayClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (state.selectedItems.length >= MAX_ELEMENTS) {
      alert("Max 100 elements");
      return;
    }

    const { clientX, clientY } = e;

    state.overlay.style.pointerEvents = "none";
    const target = document.elementFromPoint(clientX, clientY);
    state.overlay.style.pointerEvents = "auto";

    if (!target || target === state.overlay) return;

    const color = randomColor();

    const item = {
      el: target,
      color,
      id: state.idCounter++,
      badge: null,
      badgeOffset: { dx: 4, dy: 4, locked: false },
      lastRect: null,
    };

    item.badge = createDraggableBadge(item);

    state.selectedItems.push(item);
    drawAll();
  }

  function handleMouseMove(e) {
    const { clientX, clientY } = e;

    state.overlay.style.pointerEvents = "none";
    const target = document.elementFromPoint(clientX, clientY);
    state.overlay.style.pointerEvents = "auto";

    if (!target || target === state.overlay) return;

    state.hoverItem = target;
    drawAll();
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      state.selectedItems.forEach((i) => i.badge?.remove());
      state.selectedItems = [];
      state.idCounter = 1;
      drawAll();
    }
  }

  function handleReposition() {
    drawAll();
  }

  // ====================== GEOMETRY ======================

  function getMetrics(el) {
    const r = el.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      rect: r,
    };
  }

  // ====================== DRAW ======================

  function drawAll() {
    if (!state.overlay) return;

    state.overlay.innerHTML = "";
    state.boxOverlays.forEach((b) => b.remove());
    state.boxOverlays = [];

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.pointerEvents = "none";
    state.overlay.appendChild(svg);

    // Hover preview
    if (state.hoverItem) {
      const m = getMetrics(state.hoverItem);
      drawBoxHTML(m.rect, "rgba(0,191,255,0.8)", true);
      drawAllLines(svg, m, "rgba(0,191,255,0.6)");
    }

    const metrics = state.selectedItems.map((i) => getMetrics(i.el));

    state.selectedItems.forEach((item, i) => {
      const m = metrics[i];
      item.lastRect = m.rect; // store for relative drag
      drawBoxHTML(m.rect, softColor(item.color), false);
      drawAllLines(svg, m, item.color);
      positionBadge(item, m);
    });

    updateSidePanel(metrics);
  }

  // ====================== LINES & BOXES ======================

  function drawAllLines(svg, m, color) {
    drawLine(svg, m.cx, 0, m.cx, window.innerHeight, color);
    drawLine(svg, 0, m.cy, window.innerWidth, m.cy, color);

    drawLine(svg, m.left, 0, m.left, window.innerHeight, color);
    drawLine(svg, m.right, 0, m.right, window.innerHeight, color);
    drawLine(svg, 0, m.top, window.innerWidth, m.top, color);
    drawLine(svg, 0, m.bottom, window.innerWidth, m.bottom, color);
  }

  function drawLine(svg, x1, y1, x2, y2, color) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "1");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(line);
  }

  function drawBoxHTML(rect, color, dashed) {
    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      border: `1px ${dashed ? "dashed" : "solid"} ${color}`,
      zIndex: 2147483646,
      pointerEvents: "none",
      boxSizing: "border-box",
    });
    document.body.appendChild(box);
    state.boxOverlays.push(box);
  }

  // ====================== BADGES ======================

  function createDraggableBadge(item) {
    const badge = document.createElement("div");

    Object.assign(badge.style, {
      position: "fixed",
      fontSize: "9px",
      fontWeight: "bold",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "move",
      zIndex: 2147483647,
      userSelect: "none",
      opacity: "0.6", // a bit more transparent
    });

    document.body.appendChild(badge);
    makeDraggable(badge, badge, item);
    return badge;
  }

  function positionBadge(item, m) {
    const badge = item.badge;
    badge.textContent = item.id;

    const rect = item.lastRect || m.rect;

    const dx = item.badgeOffset.dx;
    const dy = item.badgeOffset.dy;

    // Position relative to the element rect so it sticks on scroll/zoom
    badge.style.left = rect.left + dx + "px";
    badge.style.top = rect.top + dy + "px";

    badge.style.backgroundColor = item.color;
    badge.style.color = getReadableTextColor(item.color);
  }

  // ====================== SIDE PANEL ======================

  function updateSidePanel(metrics) {
    const list = state.sidePanel.querySelector("#align-list");
    list.innerHTML = "";

    if (metrics.length < 2) {
      list.innerHTML = `<div style="padding:10px;color:#aaa">Select at least 2 elements</div>`;
      return;
    }

    const base = metrics[0];
    const tol = 0.5;

    metrics.slice(1).forEach((m, i) => {
      const dx = Math.abs(base.cx - m.cx);
      const dy = Math.abs(base.cy - m.cy);
      const dl = Math.abs(base.left - m.left);
      const dr = Math.abs(base.right - m.right);
      const dt = Math.abs(base.top - m.top);
      const db = Math.abs(base.bottom - m.bottom);

      const row = document.createElement("div");
      row.style.padding = "10px";
      row.style.borderBottom = "1px solid #222";
      row.style.cursor = "pointer";

      row.innerHTML = `
      <b>Element ${state.selectedItems[i + 1].id}</b><br>
      Center X: ${formatDelta(dx, tol)} |
      Center Y: ${formatDelta(dy, tol)}<br>
      Left: ${formatDelta(dl, tol)} |
      Right: ${formatDelta(dr, tol)}<br>
      Top: ${formatDelta(dt, tol)} |
      Bottom: ${formatDelta(db, tol)}
      `;

      row.onclick = () => {
        state.selectedItems[i + 1].el.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      };

      list.appendChild(row);
    });
  }

  // ====================== UTIL ======================

  function randomColor() {
    return `hsl(${Math.random() * 360}, 85%, 55%)`;
  }

  function softColor(color) {
    return color.replace("hsl", "hsla").replace(")", ", 0.6)");
  }

  function getReadableTextColor(hsl) {
    const match = hsl.match(/hsl\(\s*[\d.]+,\s*[\d.]+%,\s*([\d.]+)%\s*\)/);
    if (!match) return "#000";
    const lightness = parseFloat(match[1]);
    return lightness > 60 ? "#000" : "#fff";
  }

  function makeDraggable(el, handle, item = null) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX - el.offsetLeft;
      startY = e.clientY - el.offsetTop;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const x = e.clientX - startX;
      const y = e.clientY - startY;

      el.style.left = x + "px";
      el.style.top = y + "px";

      if (item) {
        // Store offset relative to element rect so it stays attached
        const rect = item.lastRect || item.el.getBoundingClientRect();
        item.badgeOffset = {
          dx: x - rect.left,
          dy: y - rect.top,
          locked: true,
        };
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  function formatDelta(value, tol) {
    return value <= tol ? "✅" : `❌ ${value.toFixed(1)}px`;
  }

  // ====================== TOGGLE ON INJECTION ======================

  if (window.__alignToolActive) {
    shutdown();
    window.__alignToolActive = false;
  } else {
    startup();
    window.__alignToolActive = true;
  }
})();
