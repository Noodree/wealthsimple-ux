// Renders the net worth page from the data in data.js.

const USD_TO_CAD = 1.38;
const RANGES = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "YTD": null, "1Y": 365 };

const state = {
  range: "1M",
  sort: "type",
  collapsed: new Set(),
  hidden: false,
};

// ---------- Helpers ----------

const money = (n, currency = "CAD") =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  (currency === "USD" ? " USD" : "");

const inCad = (a) => (a.currency === "USD" ? a.balance * USD_TO_CAD : a.balance);
const groupTotal = (g) => g.accounts.reduce((sum, a) => sum + inCad(a), 0);

const netWorth = () =>
  ACCOUNT_GROUPS.reduce((sum, g) => sum + (g.isDebt ? -1 : 1) * groupTotal(g), 0);

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

function renderSummary() {
  const values = historyFor(state.range);
  const total = netWorth();
  const diff = total - values[0];
  const pct = (diff / values[0]) * 100;

  document.getElementById("total").textContent = money(total);
  document.getElementById("total").classList.add("money");

  const change = document.getElementById("change");
  change.className = "change money " + (diff >= 0 ? "up" : "down");
  change.textContent = `${diff >= 0 ? "▲" : "▼"} ${money(Math.abs(diff))} (${Math.abs(pct).toFixed(2)}%)`;

  drawChart(document.getElementById("chart"), values);
  drawRanges(document.getElementById("ranges"), state.range, (r) => {
    state.range = r;
    renderSummary();
  });
}

function renderBreakdown() {
  const assets = ACCOUNT_GROUPS.filter((g) => !g.isDebt);
  const bar = document.getElementById("bar");
  bar.innerHTML = "";
  assets.forEach((g) => {
    const total = groupTotal(g);
    if (total > 0) {
      bar.append(el(`<div class="bar-seg" title="${g.label}" style="flex-grow:${total};background:${g.color}"></div>`));
    }
  });

  const legend = document.getElementById("legend");
  legend.innerHTML = "";
  ACCOUNT_GROUPS.forEach((g) => {
    legend.append(el(`
      <li><span class="dot" style="background:${g.color}"></span>${g.label}
        <span class="amount money">${money(groupTotal(g))}</span></li>`));
  });
}

function accountButton(a, extraClass = "") {
  const b = el(`
    <button class="account ${extraClass}">
      <div>
        <div class="account-name">${a.emoji ? a.emoji + " " : ""}${a.name}</div>
        <div class="account-type">${a.type}</div>
      </div>
      <span class="amount money">${money(a.balance, a.currency)}</span>
    </button>`);
  b.addEventListener("click", () => openDrawer(a));
  return b;
}

function renderAccounts() {
  const root = document.getElementById("accounts");
  root.innerHTML = "";

  if (state.sort === "balance") {
    ACCOUNT_GROUPS.flatMap((g) => g.accounts)
      .sort((a, b) => inCad(b) - inCad(a))
      .forEach((a) => {
        const card = accountButton(a, "account-card card");
        root.append(card);
      });
    return;
  }

  ACCOUNT_GROUPS.forEach((g) => {
    if (g.accounts.length === 0) {
      root.append(el(`
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
    g.accounts.forEach((a) => body.append(accountButton(a)));
    root.append(group);
  });
}

// ---------- Drawer ----------

const overlay = document.getElementById("overlay");

function openDrawer(account) {
  let range = "1M";
  const ranges = ["1M", "3M", "6M", "YTD", "1Y"];

  // Give each account its own wiggle by shifting the shared history.
  const offset = account.name.length * 11;
  const series = HISTORY.map((_, i) => HISTORY[(i + offset) % HISTORY.length]);

  const draw = () => {
    drawChart(document.getElementById("drawerChart"), historyFor(range, inCad(account), series));
    drawRanges(document.getElementById("drawerRanges"), range, (r) => { range = r; draw(); }, ranges);
  };

  document.getElementById("drawerType").textContent = account.type;
  document.getElementById("drawerName").textContent = account.name;
  const bal = document.getElementById("drawerBalance");
  bal.textContent = money(account.balance, account.currency);
  bal.classList.add("money");

  const stats = [["Account value", money(account.balance, account.currency)]];
  if (account.netDeposits) stats.push(["Net deposits", money(account.netDeposits)]);
  document.getElementById("drawerStats").innerHTML = stats
    .map(([k, v]) => `<div><dt>${k}</dt><dd class="money">${v}</dd></div>`)
    .join("");

  overlay.hidden = false;
  draw();
}

function closeDrawer() {
  overlay.hidden = true;
}

document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
document.getElementById("backdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

// ---------- Controls ----------

document.getElementById("hideBtn").addEventListener("click", () => {
  state.hidden = !state.hidden;
  document.body.classList.toggle("is-hidden", state.hidden);
});

document.getElementById("sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  renderAccounts();
});

// ---------- Go ----------

renderSummary();
renderBreakdown();
renderAccounts();
