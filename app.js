// ---- Fallback data (used if bills.json can't be fetched, e.g. opened via file://) ----
const FALLBACK_DATA = {
  weeklyBills: [
    { id: "horizon-w1", name: "Horizon Insurance", amount: 800, week: 1 },
    { id: "horizon-w2", name: "Horizon Insurance", amount: 800, week: 2 },
    { id: "zakat-w3", name: "Zakat", amount: 500, week: 3 },
    { id: "allowance-w3", name: "Allowance", amount: 100, week: 3 },
    { id: "creditcard-w4", name: "Credit Card Payment", amount: 400, week: 4 }
  ],
  asNeededCategories: [
    { id: "travel", name: "Traveling Expense", amount: 600 },
    { id: "gas", name: "Gas Expense", amount: 400 }
  ]
};

const STORAGE_KEY = "budgetTrackerState_v1";
const fmt = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let billsData = null;
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt state */ }
  return { income: null, paid: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadBillsData() {
  try {
    const res = await fetch("bills.json");
    if (!res.ok) throw new Error("fetch failed");
    return await res.json();
  } catch (e) {
    return FALLBACK_DATA;
  }
}

function init() {
  loadBillsData().then((data) => {
    billsData = data;

    const incomeInput = document.getElementById("income");
    if (state.income != null) incomeInput.value = state.income;
    incomeInput.addEventListener("input", () => {
      state.income = incomeInput.value === "" ? null : Number(incomeInput.value);
      saveState();
      renderSummary();
    });

    document.getElementById("resetMonthBtn").addEventListener("click", () => {
      if (!confirm("Reset all paid checkmarks for a new month?")) return;
      state.paid = {};
      saveState();
      renderWeeks();
      renderAsNeeded();
      renderSummary();
    });

    renderWeeks();
    renderAsNeeded();
    renderSummary();
  });
}

function renderWeeks() {
  const container = document.getElementById("weeksContainer");
  container.innerHTML = "";

  const weekNumbers = [1, 2, 3, 4];
  weekNumbers.forEach((weekNum) => {
    const billsForWeek = billsData.weeklyBills.filter((b) => b.week === weekNum);
    const card = document.createElement("div");
    card.className = "week-card";

    const weekTotal = billsForWeek.reduce((sum, b) => sum + b.amount, 0);

    let rowsHtml = "";
    if (billsForWeek.length === 0) {
      rowsHtml = '<div class="empty-note">No bills this week</div>';
    } else {
      rowsHtml = billsForWeek.map((b) => {
        const isPaid = !!state.paid[b.id];
        return `
          <div class="bill-row ${isPaid ? "paid" : ""}" data-id="${b.id}">
            <input type="checkbox" ${isPaid ? "checked" : ""} data-bill-id="${b.id}">
            <div class="bill-info">
              <span class="bill-name">${b.name}</span>
            </div>
            <span class="bill-amount">${fmt(b.amount)}</span>
          </div>`;
      }).join("");
    }

    card.innerHTML = `
      <h2>Week ${weekNum}</h2>
      <div class="week-total">Total: ${fmt(weekTotal)}</div>
      ${rowsHtml}
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("input[data-bill-id]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-bill-id");
      state.paid[id] = e.target.checked;
      saveState();
      renderWeeks();
      renderSummary();
    });
  });
}

function renderAsNeeded() {
  const container = document.getElementById("asNeededContainer");
  container.innerHTML = "";

  const categories = billsData.asNeededCategories;
  const card = document.createElement("div");
  card.className = "week-card";

  const catTotal = categories.reduce((sum, c) => sum + c.amount, 0);

  const rowsHtml = categories.length
    ? categories.map((cat) => {
        const isPaid = !!state.paid[cat.id];
        return `
          <div class="bill-row ${isPaid ? "paid" : ""}" data-id="${cat.id}">
            <input type="checkbox" ${isPaid ? "checked" : ""} data-bill-id="${cat.id}">
            <div class="bill-info">
              <span class="bill-name">${cat.name}</span>
            </div>
            <span class="bill-amount">${fmt(cat.amount)}</span>
          </div>`;
      }).join("")
    : '<div class="empty-note">No as-needed expenses</div>';

  card.innerHTML = `
    <h2>As Needed</h2>
    <div class="week-total">Total: ${fmt(catTotal)}</div>
    ${rowsHtml}
  `;
  container.appendChild(card);

  container.querySelectorAll("input[data-bill-id]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-bill-id");
      state.paid[id] = e.target.checked;
      saveState();
      renderAsNeeded();
      renderSummary();
    });
  });
}

function renderSummary() {
  const totalFixed = billsData.weeklyBills.reduce((sum, b) => sum + b.amount, 0);
  const totalAsNeeded = billsData.asNeededCategories.reduce((sum, c) => sum + c.amount, 0);
  const totalAll = totalFixed + totalAsNeeded;
  const income = state.income;
  const remaining = income != null ? income - totalAll : null;

  document.getElementById("totalFixed").textContent = fmt(totalFixed);
  document.getElementById("totalAsNeeded").textContent = fmt(totalAsNeeded);
  document.getElementById("totalAll").textContent = fmt(totalAll);

  const remainingEl = document.getElementById("totalRemaining");
  if (remaining == null) {
    remainingEl.textContent = "Enter income";
    remainingEl.classList.remove("negative");
  } else {
    remainingEl.textContent = fmt(remaining);
    remainingEl.classList.toggle("negative", remaining < 0);
  }
}

init();
