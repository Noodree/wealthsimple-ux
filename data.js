// Demo data. Every number here is made up.
// Edit this file to change what the page shows.

const ACCOUNT_GROUPS = [
  {
    id: "cash",
    label: "Chequing & savings",
    color: "#305FAA",
    accounts: [
      { name: "Business chequing", type: "Corporate chequing", emoji: "💼", balance: 12480.55 },
      { name: "Spending", type: "Chequing", emoji: "💳", balance: 8215.9 },
      { name: "US savings", type: "USD savings", emoji: "🇺🇸", balance: 5320.0, currency: "USD" },
    ],
  },
  {
    id: "investments",
    label: "Investments",
    color: "#3B71CC",
    accounts: [
      { name: "Alex's RESP", type: "RESP", balance: 3910.42, netDeposits: 3200 },
      { name: "Sam's RESP", type: "RESP Individual", balance: 2125.18, netDeposits: 1650 },
      { name: "RRSP", type: "RRSP", emoji: "🌱", balance: 64870.33, netDeposits: 52000 },
    ],
  },
  {
    id: "property",
    label: "Real estate & valuables",
    color: "#5B88D9",
    accounts: [],
  },
  {
    id: "debts",
    label: "Debts",
    color: "#E47ECA",
    isDebt: true,
    accounts: [],
  },
];

// Daily net worth for the last year, oldest first. Generated so the
// chart has something believable to draw.
const HISTORY = (() => {
  const days = 365;
  const end = 96922.38;
  const points = [];
  let value = end * 0.86;
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < days; i++) {
    value += (end - value) * 0.004 + (rand() - 0.5) * end * 0.012;
    points.push(value);
  }
  return points;
})();
