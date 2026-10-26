// Renders the net worth page from the data in data.js.
// Add ?v=a to ?v=e to the URL to try a design for leaving accounts
// out of the net worth (see prototypes.html).

const USD_TO_CAD = 1.38;
const RANGES = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "YTD": null, "1Y": 365 };

const VARIANTS = {
  original: { label: "Original", name: "Original", hint: "The page as it is today" },
  a: { label: "A", name: "Toggle in the account panel", hint: "Open an RESP and switch off Include in net worth" },
  b: { label: "B", name: "Customize the total", hint: "Click the sliders next to the total" },
  c: { label: "C", name: "Not counted section", hint: "Use the ⋯ on an account to move it" },
  d: { label: "D", name: "Quick hide on the row", hint: "Hover a row and click the eye. On mobile, swipe left" },
  e: { label: "E", name: "Saved views", hint: "Click + New view above the total" },
};
const requested = new URLSearchParams(location.search).get("v");
const variant = VARIANTS[requested] ? requested : "original";

const state = {
  range: "1M",
  sort: "type",
  collapsed: new Set(),
  hidden: false,
  excluded: new Set(), // account names left out of the total (A to D)
  views: [{ name: "All accounts", excluded: new Set() }], // E only
  view: 0,
};

// ---------- Helpers ----------

const $ = (id) => document.getElementById(id);

const money = (n, currency = "CAD") =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  (currency === "USD" ? " USD" : "");

const inCad = (a) => (a.currency === "USD" ? a.balance * USD_TO_CAD : a.balance);

const excludedSet = () => (variant === "e" ? state.views[state.view].excluded : state.excluded);
const isCounted = (a, set = excludedSet()) => !set.has(a.name);

const groupTotal = (g, set = excludedSet()) =>
  g.accounts.reduce((sum, a) => sum + (isCounted(a, set) ? inCad(a) : 0), 0);

const netWorth = (set = excludedSet()) =>
  ACCOUNT_GROUPS.reduce((sum, g) => sum + (g.isDebt ? -1 : 1) * groupTotal(g, set), 0);

const allAccounts = () => ACCOUNT_GROUPS.flatMap((g) => g.accounts);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isMobile = () => matchMedia("(max-width: 720px)").matches;

function daysForRange(range) {
  if (RANGES[range]) return RANGES[range];
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  return Math.max(2, Math.round((now - jan1) / 86400000));
}

// Scale the demo history so its last point equals today's real total.
function historyFor(range, endValue = netWorth(), source = HISTORY) {
  const last = source[source.length - 1];
  const scale = endValue / last;
  return source.slice(-daysForRange(range)).map((v) => v * scale);
}

const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const ICONS = {
  eye: '<svg viewBox="0 0 24 24"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

// ---------- Chart ----------

function drawChart(container, values) {
  const w = 760;
  const h = 200;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => (i / (values.length - 1)) * w;
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values.length - 1;

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline class="line" vector-effect="non-scaling-stroke" points="${points.join(" ")}"/>
      <line class="hover-line" vector-effect="non-scaling-stroke" x1="0" x2="0" y1="0" y2="${h}" visibility="hidden"/>
    </svg>
    <span class="end-marker"></span>
    <span class="chart-tip money" hidden></span>`;

  // A round end dot that does not stretch with the SVG.
  const marker = container.querySelector(".end-marker");
  Object.assign(marker.style, {
    position: "absolute",
    left: `calc(${(x(last) / w) * 100}% - 4px)`,
    top: `calc(${(y(values[last]) / h) * 100}% - 4px)`,
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--chart-line)",
    boxShadow: "0 0 0 4px rgba(47,125,58,0.2)",
  });

  // Hover to read a value.
  const svg = container.querySelector("svg");
  const line = container.querySelector(".hover-line");
  const tip = container.querySelector(".chart-tip");
  svg.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = Math.round(ratio * last);
    line.setAttribute("x1", x(i));
    line.setAttribute("x2", x(i));
    line.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.style.left = `${(x(i) / w) * 100}%`;
    tip.textContent = money(values[i]);
  });
  svg.addEventListener("mouseleave", () => {
    line.setAttribute("visibility", "hidden");
    tip.hidden = true;
  });
}

function drawRanges(container, active, onPick, ranges = Object.keys(RANGES)) {
  container.innerHTML = "";
  ranges.forEach((r) => {
    const b = el(`<button class="range${r === active ? " is-active" : ""}" role="tab">${r}</button>`);
    b.addEventListener("click", () => onPick(r));
    container.append(b);
  });
}

// ---------- Sections ----------

function renderAll() {
  renderSummary();
  renderBreakdown();
  renderAccounts();
}

function renderSummary() {
  const values = historyFor(state.range);
  const total = netWorth();
  const diff = total - values[0];
  const pct = (diff / values[0]) * 100;

  $("total").textContent = money(total);
  $("total").classList.add("money");

  const change = $("change");
  change.className = "change money " + (diff >= 0 ? "up" : "down");
  change.textContent = `${diff >= 0 ? "▲" : "▼"} ${money(Math.abs(diff))} (${Math.abs(pct).toFixed(2)}%)`;

  drawChart($("chart"), values);
  drawRanges($("ranges"), state.range, (r) => {
    state.range = r;
    renderSummary();
  });

  renderTotalNote();
  if (variant === "e") renderViewBar();
}

// B: a chip under the total says how many accounts are left out.
// E: a quiet note says what the current view leaves out.
function renderTotalNote() {
  const note = $("totalNote");
  note.innerHTML = "";
  const count = excludedSet().size;
  if (!count) return;

  if (variant === "b") {
    const chip = el(`<button class="chip-btn">${ICONS.sliders}Excludes ${plural(count, "account")}</button>`);
    chip.addEventListener("click", openCustomizeSheet);
    note.append(chip);
  }
  if (variant === "e") {
    note.append(el(`<span class="note-text">This view leaves out ${plural(count, "account")}</span>`));
  }
}

function renderBreakdown() {
  const assets = ACCOUNT_GROUPS.filter((g) => !g.isDebt);
  const bar = $("bar");
  bar.innerHTML = "";
  assets.forEach((g) => {
    const total = groupTotal(g);
    if (total > 0) {
      bar.append(el(`<div class="bar-seg" title="${g.label}" style="flex-grow:${total};background:${g.color}"></div>`));
    }
  });

  const legend = $("legend");
  legend.innerHTML = "";
  ACCOUNT_GROUPS.forEach((g) => {
    legend.append(el(`
      <li><span class="dot" style="background:${g.color}"></span>${g.label}
        <span class="amount money">${money(groupTotal(g))}</span></li>`));
  });
}

function accountRow(a, { card = false } = {}) {
  const counted = isCounted(a);
  const tagText = variant === "e" ? "Not in this view" : "Not counted";
  const showTag = !counted && variant !== "c";

  const row = el(`
    <div class="account-row${card ? " card" : ""}${counted ? "" : " is-excluded"}">
      <div class="row-fg">
        <button class="account${card ? " account-card" : ""}">
          <div>
            <div class="account-name">${a.emoji ? a.emoji + " " : ""}${a.name}${showTag ? `<span class="tag">${tagText}</span>` : ""}</div>
            <div class="account-type">${a.type}</div>
          </div>
          <span class="amount money">${money(a.balance, a.currency)}</span>
        </button>
      </div>
    </div>`);

  const fg = row.querySelector(".row-fg");
  row.querySelector(".account").addEventListener("click", () => {
    if (fg.swiped) return; // the tap ended a swipe
    if (fg.open) return closeSwipe(fg);
    openDrawer(a);
  });

  if (variant === "d") {
    const label = counted ? `Leave ${a.name} out of net worth` : `Count ${a.name} in net worth`;
    const eye = el(`<button class="row-action d-eye" aria-label="${label}" title="${counted ? "Don't count" : "Count"}">${counted ? ICONS.eye : ICONS.eyeOff}</button>`);
    eye.addEventListener("click", () => setCounted(a, !counted, true));
    fg.append(eye);
    enableSwipe(row, a, counted);
  }

  if (variant === "c") {
    const more = el(`<button class="row-action always" aria-label="More for ${a.name}" aria-haspopup="menu">${ICONS.more}</button>`);
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      openMenu(more, a);
    });
    fg.append(more);
  }

  return row;
}

function renderAccounts() {
  const root = $("accounts");
  root.innerHTML = "";
  // In C, left-out accounts move to their own section instead of staying in place.
  const inPlace = (a) => variant !== "c" || isCounted(a);

  if (state.sort === "balance") {
    allAccounts()
      .filter(inPlace)
      .sort((a, b) => inCad(b) - inCad(a))
      .forEach((a) => root.append(accountRow(a, { card: true })));
    if (variant === "c") root.append(notCountedSection());
    return;
  }

  const empty = [];
  ACCOUNT_GROUPS.forEach((g) => {
    if (g.accounts.length === 0) {
      empty.push(el(`
        <div class="group-empty">${g.label}
          <button class="round-btn" aria-label="Add ${g.label}">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>`));
      return;
    }

    const collapsed = state.collapsed.has(g.id);
    const group = el(`
      <div class="card group${collapsed ? " is-collapsed" : ""}">
        <button class="group-head" aria-expanded="${!collapsed}">
          ${g.label}
          <span class="amount money">${money(groupTotal(g))}</span>
          <svg class="chev" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>
        </button>
        <div class="group-body"></div>
      </div>`);

    group.querySelector(".group-head").addEventListener("click", () => {
      collapsed ? state.collapsed.delete(g.id) : state.collapsed.add(g.id);
      renderAccounts();
    });
    const body = group.querySelector(".group-body");
    const shown = g.accounts.filter(inPlace);
    shown.forEach((a) => body.append(accountRow(a)));
    if (!shown.length) body.append(el(`<p class="group-note">All accounts here are in Not counted.</p>`));
    root.append(group);
  });

  if (variant === "c") root.append(notCountedSection());
  empty.forEach((node) => root.append(node));
}

// C: a dashed section that holds the accounts left out of the total.
function notCountedSection() {
  const out = allAccounts().filter((a) => !isCounted(a));
  const sum = out.reduce((s, a) => s + inCad(a), 0);
  const section = el(`
    <div class="not-counted">
      <div class="nc-head">
        <div>
          <div class="nc-title">Not counted</div>
          <div class="nc-sub">${out.length
            ? "Still tracked here, but left out of your net worth"
            : "Move an account here to leave it out of your net worth. Use the ⋯ on any account."}</div>
        </div>
        ${out.length ? `<span class="amount money">${money(sum)}</span>` : ""}
      </div>
    </div>`);
  out.forEach((a) => section.append(accountRow(a)));
  return section;
}

// ---------- Changing what counts ----------

function setCounted(a, counted, withUndo = false) {
  const set = excludedSet();
  counted ? set.delete(a.name) : set.add(a.name);
  renderAll();
  if (withUndo) {
    showToast(
      counted ? `${a.name} counts in your net worth again` : `${a.name} is no longer counted`,
      () => setCounted(a, !counted)
    );
  }
}

let toastTimer;
function showToast(message, undo) {
  const toast = $("toast");
  toast.innerHTML = `<span>${message}</span>`;
  if (undo) {
    const btn = el(`<button>Undo</button>`);
    btn.addEventListener("click", () => {
      toast.hidden = true;
      undo();
    });
    toast.append(btn);
  }
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 5000);
}

// ---------- D: swipe left on mobile ----------

const SWIPE_WIDTH = 110;

function closeSwipe(fg) {
  fg.open = false;
  fg.style.transform = "";
  setTimeout(() => fg.parentElement.classList.remove("show-swipe"), 200);
}

function enableSwipe(row, a, counted) {
  const fg = row.querySelector(".row-fg");
  const action = el(`<button class="swipe-action">${counted ? "Don't count" : "Count"}</button>`);
  action.addEventListener("click", () => setCounted(a, !counted, true));
  row.prepend(action);

  let startX = null;
  let offset = 0;
  fg.addEventListener("pointerdown", (e) => {
    if (!isMobile()) return;
    startX = e.clientX;
    offset = fg.open ? -SWIPE_WIDTH : 0;
    fg.swiped = false;
    fg.style.transition = "none";
  });
  fg.addEventListener("pointermove", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 6) {
      fg.swiped = true;
      row.classList.add("show-swipe");
    }
    const x = Math.max(-SWIPE_WIDTH - 30, Math.min(0, offset + dx));
    fg.style.transform = `translateX(${x}px)`;
  });
  const end = (e) => {
    if (startX === null) return;
    const x = offset + (e.clientX - startX);
    startX = null;
    fg.style.transition = "";
    fg.open = fg.swiped ? x < -SWIPE_WIDTH / 2 : fg.open;
    fg.style.transform = fg.open ? `translateX(${-SWIPE_WIDTH}px)` : "";
    if (!fg.open) setTimeout(() => row.classList.remove("show-swipe"), 200);
    setTimeout(() => (fg.swiped = false), 50);
  };
  fg.addEventListener("pointerup", end);
  fg.addEventListener("pointercancel", end);
  fg.addEventListener("pointerleave", end);
}

// ---------- C: row menu ----------

function closeMenu() {
  document.querySelector(".menu")?.remove();
}

function openMenu(button, a) {
  closeMenu();
  const counted = isCounted(a);
  const menu = el(`
    <div class="menu" role="menu">
      <button role="menuitem" data-act="move">${counted ? "Move to Not counted" : "Count in net worth"}</button>
      <button role="menuitem" data-act="open">View account</button>
    </div>`);
  document.body.append(menu);
  const r = button.getBoundingClientRect();
  menu.style.top = `${r.bottom + scrollY + 4}px`;
  menu.style.left = `${Math.max(8, r.right + scrollX - 210)}px`;
  menu.querySelector('[data-act="move"]').addEventListener("click", () => setCounted(a, !counted, true));
  menu.querySelector('[data-act="open"]').addEventListener("click", () => openDrawer(a));
  setTimeout(() => document.addEventListener("click", closeMenu, { once: true }));
}

// ---------- B and E: account picker sheet ----------

function openSheet({ title, initial, saveLabel, withName = false, nameValue = "", onSave }) {
  const draft = new Set(initial);
  const sheet = $("sheet");
  sheet.innerHTML = `
    <div class="sheet-head">
      <h3>${title}</h3>
      <button class="close-btn" data-close aria-label="Close">${ICONS.close}</button>
    </div>
    <div class="sheet-body">
      ${withName ? `
        <label class="name-field">View name
          <input id="viewName" placeholder="My money" value="${nameValue}">
        </label>
        <p class="field-error" id="nameError" hidden>Give this view a name</p>` : ""}
      <div class="sheet-preview">Net worth<strong id="sheetTotal"></strong><span id="sheetCount"></span></div>
      <div id="sheetList"></div>
    </div>
    <div class="sheet-foot">
      <button class="pill" id="sheetAll">Include all</button>
      <button class="btn-dark" id="sheetSave">${saveLabel}</button>
    </div>`;

  const list = sheet.querySelector("#sheetList");
  const update = () => {
    sheet.querySelector("#sheetTotal").textContent = money(netWorth(draft));
    sheet.querySelector("#sheetCount").textContent = draft.size ? `Leaves out ${plural(draft.size, "account")}` : "Includes every account";
    list.querySelectorAll(".check-row").forEach((row) => {
      const on = !draft.has(row.dataset.name);
      row.classList.toggle("is-off", !on);
      row.querySelector("input").checked = on;
    });
  };

  ACCOUNT_GROUPS.filter((g) => g.accounts.length).forEach((g) => {
    list.append(el(`<div class="sheet-group">${g.label}</div>`));
    g.accounts.forEach((a) => {
      const row = el(`
        <label class="check-row" data-name="${a.name}">
          <input type="checkbox">
          <span>
            <span class="account-name">${a.emoji ? a.emoji + " " : ""}${a.name}</span>
            <span class="account-type" style="display:block">${a.type}</span>
          </span>
          <span class="amount money">${money(a.balance, a.currency)}</span>
        </label>`);
      row.querySelector("input").addEventListener("change", (e) => {
        e.target.checked ? draft.delete(a.name) : draft.add(a.name);
        update();
      });
      list.append(row);
    });
  });

  sheet.querySelector("#sheetAll").addEventListener("click", () => {
    draft.clear();
    update();
  });
  sheet.querySelector("#sheetSave").addEventListener("click", () => {
    let name = "";
    if (withName) {
      name = sheet.querySelector("#viewName").value.trim();
      if (!name) {
        sheet.querySelector("#nameError").hidden = false;
        return;
      }
    }
    closeSheet();
    onSave(draft, name);
  });
  sheet.querySelector("#viewName")?.addEventListener("input", () => (sheet.querySelector("#nameError").hidden = true));

  update();
  $("sheetOverlay").hidden = false;
}

function closeSheet() {
  $("sheetOverlay").hidden = true;
}

$("sheetOverlay").addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeSheet();
});

function openCustomizeSheet() {
  openSheet({
    title: "Customize your net worth",
    initial: state.excluded,
    saveLabel: "Done",
    onSave: (set) => {
      state.excluded = set;
      renderAll();
    },
  });
}

// ---------- E: saved views ----------

function renderViewBar() {
  const bar = $("viewBar");
  bar.innerHTML = "";
  state.views.forEach((v, i) => {
    const pill = el(`<button class="view-pill${i === state.view ? " is-active" : ""}">${v.name}</button>`);
    pill.addEventListener("click", () => {
      state.view = i;
      renderAll();
    });
    bar.append(pill);
  });

  if (state.view > 0) {
    const edit = el(`<button class="view-edit">Edit view</button>`);
    edit.addEventListener("click", () => {
      const v = state.views[state.view];
      openSheet({
        title: "Edit view",
        initial: v.excluded,
        saveLabel: "Save view",
        withName: true,
        nameValue: v.name,
        onSave: (set, name) => {
          v.excluded = set;
          v.name = name;
          renderAll();
        },
      });
    });
    bar.append(edit);
  }

  const add = el(`<button class="view-pill is-new">+ New view</button>`);
  add.addEventListener("click", () =>
    openSheet({
      title: "New view",
      initial: new Set(),
      saveLabel: "Save view",
      withName: true,
      onSave: (set, name) => {
        state.views.push({ name, excluded: set });
        state.view = state.views.length - 1;
        renderAll();
        showToast(`${name} saved`);
      },
    })
  );
  bar.append(add);
}

// ---------- Drawer ----------

const overlay = $("overlay");

function openDrawer(account) {
  let range = "1M";
  const ranges = ["1M", "3M", "6M", "YTD", "1Y"];

  // Give each account its own wiggle by shifting the shared history.
  const offset = account.name.length * 11;
  const series = HISTORY.map((_, i) => HISTORY[(i + offset) % HISTORY.length]);

  const draw = () => {
    drawChart($("drawerChart"), historyFor(range, inCad(account), series));
    drawRanges($("drawerRanges"), range, (r) => { range = r; draw(); }, ranges);
  };

  $("drawerType").textContent = account.type;
  $("drawerName").textContent = account.name;
  const bal = $("drawerBalance");
  bal.textContent = money(account.balance, account.currency);
  bal.classList.add("money");

  const stats = [["Account value", money(account.balance, account.currency)]];
  if (account.netDeposits) stats.push(["Net deposits", money(account.netDeposits)]);
  $("drawerStats").innerHTML = stats
    .map(([k, v]) => `<div><dt>${k}</dt><dd class="money">${v}</dd></div>`)
    .join("");

  renderDrawerExtra(account);
  overlay.hidden = false;
  draw();
}

// A: the switch lives with the account's other details.
function renderDrawerExtra(account) {
  const extra = $("drawerExtra");
  extra.innerHTML = "";
  if (variant !== "a") return;

  const row = el(`
    <div class="include-row">
      <div>
        <div class="include-title">Include in net worth</div>
        <div class="include-sub">When off, this account stays in your list but is left out of your total, chart and breakdown.</div>
      </div>
      <button class="switch" role="switch" aria-label="Include in net worth"></button>
    </div>`);
  const sw = row.querySelector(".switch");
  sw.setAttribute("aria-checked", isCounted(account));
  sw.addEventListener("click", () => {
    setCounted(account, !isCounted(account));
    sw.setAttribute("aria-checked", isCounted(account));
  });
  extra.append(row);
}

function closeDrawer() {
  overlay.hidden = true;
}

$("closeDrawer").addEventListener("click", closeDrawer);
$("backdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeDrawer();
  closeSheet();
  closeMenu();
});

// ---------- Prototype switcher ----------

function renderSwitcher() {
  const v = VARIANTS[variant];
  $("switcher").innerHTML = `
    <div class="sw-buttons">
      ${Object.entries(VARIANTS)
        .map(([key, item]) => `<a class="sw-btn${key === variant ? " is-active" : ""}" href="?v=${key}" title="${item.name}">${item.label}</a>`)
        .join("")}
      <a class="sw-btn" href="prototypes.html" title="All prototypes">All</a>
    </div>
    <div class="sw-hint"><b>${v.name}</b>${variant === "original" ? "" : v.hint}</div>`;
}

// ---------- Controls ----------

$("hideBtn").addEventListener("click", () => {
  state.hidden = !state.hidden;
  document.body.classList.toggle("is-hidden", state.hidden);
});

$("sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  renderAccounts();
});

if (variant === "b") {
  $("customizeBtn").hidden = false;
  $("customizeBtn").addEventListener("click", openCustomizeSheet);
}

// ---------- Go ----------

renderSwitcher();
renderAll();
