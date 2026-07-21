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
    { id: "travel", name: "Traveling Expense", budget: 600 },
    { id: "gas", name: "Gas Expense", budget: 400 }
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
  return { income: null, paid: {}, entries: {} };
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
    data.asNeededCategories.forEach((cat) => {
      if (!state.entries[cat.id]) state.entries[cat.id] = [];
    });

    const incomeInput = document.getElementById("income");
    if (state.income != null) incomeInput.value = state.income;
    incomeInput.addEventListener("input", () => {
      state.income = incomeInput.value === "" ? null : Number(incomeInput.value);
      saveState();
      renderSummary();
    });

    document.getElementById("resetMonthBtn").addEventListener("click", () => {
      if (!confirm("Reset all paid checkmarks and as-needed expense entries for a new month?")) return;
      state.paid = {};
      state.entries = {};
      data.asNeededCategories.forEach((cat) => { state.entries[cat.id] = []; });
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

  billsData.asNeededCategories.forEach((cat) => {
    const entries = state.entries[cat.id] || [];
    const spent = entries.reduce((sum, e) => sum + e.amount, 0);
    const pct = cat.budget > 0 ? Math.min(100, (spent / cat.budget) * 100) : 0;
    const over = spent > cat.budget;

    const card = document.createElement("div");
    card.className = "as-needed-card";

    const entryRows = entries.length
      ? entries.map((e) => `
          <li class="entry-row" data-entry-id="${e.id}">
            <span class="entry-desc">${e.desc || cat.name}</span>
            <span class="entry-date">${e.date}</span>
            <span class="entry-amount">${fmt(e.amount)}</span>
            <button class="entry-remove" data-remove-id="${e.id}" title="Remove">&times;</button>
          </li>`).join("")
      : '<li class="empty-note">No expenses logged yet</li>';

    card.innerHTML = `
      <h2>${cat.name}</h2>
      <div class="as-needed-budget">Budget ${fmt(cat.budget)} &middot; Spent ${fmt(spent)} ${over ? '<span style="color:var(--red)">(over budget)</span>' : ""}</div>
      <div class="as-needed-progress"><div class="as-needed-progress-bar ${over ? "over" : ""}" style="width:${pct}%"></div></div>
      <form class="entry-form" data-cat-id="${cat.id}">
        <input type="text" placeholder="Description (optional)" class="entry-desc-input">
        <input type="number" placeholder="Amount" step="0.01" min="0" class="entry-amount-input" required>
        <button type="submit" class="btn btn-small">Add</button>
      </form>
      <ul class="entry-list">${entryRows}</ul>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("form.entry-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const catId = form.getAttribute("data-cat-id");
      const descInput = form.querySelector(".entry-desc-input");
      const amountInput = form.querySelector(".entry-amount-input");
      const amount = Number(amountInput.value);
      if (!amount || amount <= 0) return;

      const entry = {
        id: "e" + Date.now() + Math.random().toString(16).slice(2),
        desc: descInput.value.trim(),
        amount: amount,
        date: new Date().toISOString().slice(0, 10)
      };
      state.entries[catId] = state.entries[catId] || [];
      state.entries[catId].push(entry);
      saveState();
      renderAsNeeded();
      renderSummary();
    });
  });

  container.querySelectorAll("button[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const removeId = btn.getAttribute("data-remove-id");
      Object.keys(state.entries).forEach((catId) => {
        state.entries[catId] = state.entries[catId].filter((e) => e.id !== removeId);
      });
      saveState();
      renderAsNeeded();
      renderSummary();
    });
  });
}

function renderSummary() {
  const totalFixed = billsData.weeklyBills.reduce((sum, b) => sum + b.amount, 0);
  const totalAsNeeded = Object.values(state.entries).reduce(
    (sum, list) => sum + list.reduce((s, e) => s + e.amount, 0), 0
  );
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
