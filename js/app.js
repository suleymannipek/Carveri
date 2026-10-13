// --- APP.JS: TEMA, SEKME GEÇİŞLERİ VE ANA BAŞLATICI ---

const themeMeta = { 
  auto: { name: "Otomatik", icon: "⚙️", color: "#0b1329" },
  midnight: { name: "Gece", icon: "🔵", color: "#0b1329" }, 
  oled: { name: "OLED", icon: "🌑", color: "#000000" }, 
  light: { name: "Gündüz", icon: "☀️", color: "#f1f5f9" }
};

function getSystemTheme() {
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? "midnight" : "light";
}

let userThemePref = localStorage.getItem(STORAGE_PREFIX + "theme_pref") || "auto";

function applyCurrentTheme() {
  let activeTheme = userThemePref === "auto" ? getSystemTheme() : userThemePref;
  document.documentElement.setAttribute("data-theme", activeTheme);
  const mCol = document.getElementById("metaThemeColor");
  const tIco = document.getElementById("themeIcon");
  if (mCol && themeMeta[activeTheme]) mCol.setAttribute("content", themeMeta[activeTheme].color);
  if (tIco && themeMeta[userThemePref]) tIco.innerText = themeMeta[userThemePref].icon;
  if (typeof renderAll === "function") renderAll();
}

function cycleTheme() {
  const order = ["auto", "midnight", "oled", "light"];
  let idx = order.indexOf(userThemePref);
  userThemePref = order[(idx + 1) % order.length];
  localStorage.setItem(STORAGE_PREFIX + "theme_pref", userThemePref);
  applyCurrentTheme();
}

function toggleFullScreen() { 
  if (!document.fullscreenElement) { 
    document.documentElement.requestFullscreen().catch(() => {}); 
  } else { 
    if (document.exitFullscreen) document.exitFullscreen(); 
  } 
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (userThemePref === "auto") applyCurrentTheme();
  });
}

const fontSizes = { 
  small: { size: '14px', label: '%100' }, 
  medium: { size: '16px', label: '%115' }, 
  large: { size: '18px', label: '%130' } 
};
let currentFontSizeKey = localStorage.getItem(STORAGE_PREFIX + "font_size") || "small";

function applyFontSize(key) {
  if (!fontSizes[key]) key = "small";
  currentFontSizeKey = key;
  document.documentElement.style.fontSize = fontSizes[key].size;
  localStorage.setItem(STORAGE_PREFIX + "font_size", key);
  const badge = document.getElementById("currentFontSizeBadge");
  if (badge) badge.innerText = fontSizes[key].label;
  ['Small', 'Med', 'Lg'].forEach(k => {
    const btn = document.getElementById("btnFont" + k);
    if (btn) {
      const matches = (k === 'Small' && key === 'small') || (k === 'Med' && key === 'medium') || (k === 'Lg' && key === 'large');
      btn.className = matches 
        ? "py-2.5 rounded-xl bg-blue-600 text-white font-black shadow-md transition-all" 
        : "py-2.5 rounded-xl custom-card border text-[11px] font-bold shadow-sm custom-muted";
    }
  });
}

function setFontSize(key) { 
  applyFontSize(key); 
}

const tabsList = ["dashboard", "fuel", "expenses", "tires", "backup"];

function switchTab(tab) {
  tabsList.forEach(t => {
    const tabKey = t.charAt(0).toUpperCase() + t.slice(1);
    const el = document.getElementById("tab" + tabKey);
    const btn = document.getElementById("nav" + tabKey);
    if (el) el.classList.add("hidden");
    if (btn) {
      btn.className = "nav-btn flex flex-col items-center py-1.5 px-3 rounded-2xl custom-muted font-medium transition-all cursor-pointer";
    }
  });

  const activeKey = tab.charAt(0).toUpperCase() + tab.slice(1);
  const activeEl = document.getElementById("tab" + activeKey);
  const activeBtn = document.getElementById("nav" + activeKey);
  if (activeEl) activeEl.classList.remove("hidden");
  if (activeBtn) {
    activeBtn.className = "nav-btn flex flex-col items-center py-1.5 px-3 rounded-2xl bg-blue-600/20 text-cyan-600 dark:text-cyan-400 font-black transition-all cursor-pointer";
  }

  if (tab === 'fuel') renderFuelCards(getFilteredCombinedLogs());
  if (tab === 'expenses') renderExpenseCards();
  if (tab === 'tires') renderTiresTab();
}

function openModalDirectly(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    el.style.display = "flex";
  }
  const nav = document.getElementById("bottomNavigationBar");
  if (nav) nav.classList.add("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    el.style.display = "none";
  }
  const anyOpen = Array.from(document.querySelectorAll('.modal-backdrop')).some(m => !m.classList.contains('hidden'));
  if (!anyOpen) {
    const nav = document.getElementById("bottomNavigationBar");
    if (nav) {
      nav.classList.remove("hidden");
      nav.style.display = "block";
    }
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    const nav = document.getElementById("bottomNavigationBar");
    if (!nav) return;
    if (window.visualViewport.height < window.innerHeight * 0.75) {
      nav.classList.add("hidden");
    } else {
      const anyOpen = Array.from(document.querySelectorAll('.modal-backdrop')).some(el => !el.classList.contains('hidden'));
      if (!anyOpen) {
        nav.classList.remove("hidden");
        nav.style.display = "block";
      }
    }
  });
}

const currentSystemYear = new Date().getFullYear().toString();
let selectedYear = localStorage.getItem(STORAGE_PREFIX + "selected_year") || currentSystemYear;

function populateYearSelector() {
  const yearSelect = document.getElementById("globalYearSelect");
  if (!yearSelect) return;
  const yearsSet = new Set();
  if (window.fuels) window.fuels.forEach(f => { if (f.date && f.date.length >= 4) yearsSet.add(f.date.substring(0, 4)); });
  if (window.odoLogs) window.odoLogs.forEach(o => { if (o.date && o.date.length >= 4) yearsSet.add(o.date.substring(0, 4)); });
  if (window.expenses) window.expenses.forEach(e => { if (e.date && e.date.length >= 4) yearsSet.add(e.date.substring(0, 4)); });
  if (yearsSet.size === 0) yearsSet.add(currentSystemYear);

  yearSelect.innerHTML = "";
  const optAll = document.createElement("option"); 
  optAll.value = "all"; 
  optAll.innerText = "Tüm Zamanlar";
  if (selectedYear === "all") optAll.selected = true;
  yearSelect.appendChild(optAll);

  Array.from(yearsSet).sort().reverse().forEach(y => {
    const opt = document.createElement("option"); 
    opt.value = y; 
    opt.innerText = y;
    if (y === selectedYear) opt.selected = true;
    yearSelect.appendChild(opt);
  });
}

function changeActiveYear(year) {
  selectedYear = year;
  localStorage.setItem(STORAGE_PREFIX + "selected_year", year);
  renderAll();
}

function toggleUpdatesAccordion() {
  const b = document.getElementById("updatesAccordionBody");
  const icon = document.getElementById("updatesAccordionIcon");
  if (!b) return;
  b.classList.toggle("hidden");
  if (!b.classList.contains("hidden")) {
    b.style.display = "block";
    if (icon) icon.innerText = "▲ Gizle";
  } else {
    b.style.display = "none";
    if (icon) icon.innerText = "▼ Göster";
  }
}

// --- TÜM EKRANLARI GÜNCELLEYEN ANA DÖNGÜ ---
function renderAll() {
  applyCarProfile(); 
  populatePaymentSelects();

  const ff = window.fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
  const fe = window.expenses.filter(e => selectedYear === "all" || (e.date && e.date.startsWith(selectedYear)));
  const cf = calculateFuelMetrics(ff);

  const dashPeriodEl = document.getElementById("dashPeriodTitle");
  const fuelPeriodEl = document.getElementById("fuelPeriodIndicator");
  const dashTotalEl = document.getElementById("dashTotalEntries");

  if (dashPeriodEl) dashPeriodEl.innerText = `Dönem: ${selectedYear === "all" ? "Tüm Zamanlar" : selectedYear}`;
  if (fuelPeriodEl) fuelPeriodEl.innerText = `Gösterilen: ${selectedYear === "all" ? "Tüm Zamanlar" : selectedYear}`;
  if (dashTotalEl) dashTotalEl.innerText = `${ff.length + fe.length} Kayıt`;

  let tfc = 0, tl = 0; 
  ff.forEach(f => { tfc += f.total; tl += f.liters; });
  let fc = 0, vc = tfc; 
  fe.forEach(e => { if (EXPENSE_TYPES.FIXED.includes(e.type)) fc += e.amount; else vc += e.amount; });

  const statFuelExpEl = document.getElementById("statFuelExpense");
  const statFuelVolEl = document.getElementById("statFuelVolume");
  const statTotalOwnerEl = document.getElementById("statTotalOwnership");
  const fixEl = document.getElementById("statFixedExpenseVal");
  const statVarExpEl = document.getElementById("statVariableExpense");

  if (statFuelExpEl) statFuelExpEl.innerText = `₺${Math.round(tfc).toLocaleString('tr-TR')}`;
  if (statFuelVolEl) statFuelVolEl.innerText = `Hacim: ${tl.toFixed(1)} L`;
  if (statTotalOwnerEl) statTotalOwnerEl.innerText = `₺${Math.round(fc + vc).toLocaleString('tr-TR')}`;
  if (fixEl) fixEl.innerText = `₺${Math.round(fc).toLocaleString('tr-TR')}`;
  if (statVarExpEl) statVarExpEl.innerText = `₺${Math.round(vc).toLocaleString('tr-TR')}`;

  const sbd = cf.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentAvgCons = null;
  let dK = 0;

  if (sbd.length >= 2) {
    dK = sbd[sbd.length - 1].km - sbd[0].km;
    document.getElementById("statTotalDistance").innerText = `Mesafe: ${dK > 0 ? dK.toLocaleString('tr-TR') : 0} km`;
    document.getElementById("statCostPerKm").innerText = dK > 0 ? (tfc / dK).toFixed(2) : "--";
    let vcL = cf.filter(f => f.consumption).map(f => parseFloat(f.consumption));
    if (vcL.length) {
      document.getElementById("statLatestCons").innerText = vcL[vcL.length - 1].toFixed(2);
      currentAvgCons = (vcL.reduce((a, b) => a + b, 0) / vcL.length);
      document.getElementById("statAvgCons").innerText = `Dönem Ort: ${currentAvgCons.toFixed(2)} L`;
    }
  } else {
    document.getElementById("statLatestCons").innerText = "--"; 
    document.getElementById("statAvgCons").innerText = "Dönem Ort: -- L";
    document.getElementById("statCostPerKm").innerText = "--"; 
    document.getElementById("statTotalDistance").innerText = "Mesafe: 0 km";
  }

  // Yol Bilgisayarı Sapma Analizi (NaN Korumalı)
  let diffSum = 0, diffCount = 0;
  cf.forEach(f => {
    if (f.consumption && (f.isFull !== undefined ? f.isFull : (f.fillLevel === 'full'))) {
      const pumpVal = parseFloat(f.consumption);
      const dashVal = (f.dashL100 !== null && f.dashL100 !== undefined) ? parseFloat(f.dashL100) : NaN;
      if (!isNaN(pumpVal) && pumpVal > 0 && !isNaN(dashVal) && dashVal > 0) {
        diffSum += (pumpVal - dashVal);
        diffCount++;
      }
    }
  });

  const biasValEl = document.getElementById("statDashBiasVal");
  const biasDescEl = document.getElementById("statDashBiasDesc");
  if (diffCount > 0) {
    const avgDiff = diffSum / diffCount;
    const sign = avgDiff >= 0 ? "+" : "";
    biasValEl.innerText = `${sign}${avgDiff.toFixed(2)} L/100km`;
    biasDescEl.innerText = avgDiff >= 0 
      ? `Ekran ort. %${((avgDiff / (currentAvgCons || 6.5)) * 100).toFixed(1)} iyimser` 
      : `Ekran ort. %${((Math.abs(avgDiff) / (currentAvgCons || 6.5)) * 100).toFixed(1)} kötümser`;
  } else {
    biasValEl.innerText = "--";
    biasDescEl.innerText = "Yeterli karşılaştırma yok";
  }

  // Yıllık Kullanım Temposu ve Projeksiyon
  const paceValEl = document.getElementById("statUsagePaceVal");
  const projDescEl = document.getElementById("statUsageProjDesc");
  const now = new Date();
  const isCurYear = (selectedYear === now.getFullYear().toString());
  
  const allYearEvents = [...ff, ...window.odoLogs.filter(o => selectedYear === "all" || (o.date && o.date.startsWith(selectedYear)))].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (allYearEvents.length >= 2) {
    const firstEvent = allYearEvents[0];
    const lastEvent = allYearEvents[allYearEvents.length - 1];
    const netYKm = lastEvent.km - firstEvent.km;

    const d1 = new Date(firstEvent.date);
    const d2 = new Date(lastEvent.date);
    const daySpan = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

    const dailyAvg = netYKm / daySpan;
    const monthlyAvg = Math.round(dailyAvg * 30.4);

    if (isCurYear) {
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      const remainingDays = Math.max(0, Math.ceil((endOfYear - d2) / (1000 * 60 * 60 * 24)));
      const projectedKm = Math.round(lastEvent.km + (dailyAvg * remainingDays));

      paceValEl.innerText = `~${monthlyAvg.toLocaleString('tr-TR')} km/ay`;
      projDescEl.innerText = `${daySpan} güne göre yıl sonu tahmini: ~${projectedKm.toLocaleString('tr-TR')} KM`;
    } else if (selectedYear !== "all") {
      paceValEl.innerText = `~${monthlyAvg.toLocaleString('tr-TR')} km/ay`;
      projDescEl.innerText = `Dönem içi toplam: ${netYKm.toLocaleString('tr-TR')} KM (${daySpan} gün)`;
    } else {
      paceValEl.innerText = `${netYKm.toLocaleString('tr-TR')} KM`;
      projDescEl.innerText = `Tüm zamanlar toplam yol (${daySpan} gün)`;
    }
  } else {
    paceValEl.innerText = "-- km/ay";
    projDescEl.innerText = "En az 2 sayaç kaydı gerekli";
  }

  updateRangeEstimate(currentAvgCons); 
  updateActiveRouteBanner(); 
  renderFuelCards(getFilteredCombinedLogs()); 
  renderExpenseCards();
  if (typeof renderCharts === 'function') renderCharts(cf);
  renderCompletedRoutes();
}

// Uygulama Başlatıcı
window.addEventListener('DOMContentLoaded', () => {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(() => {});
  }

  initIndexedDB().then(() => {
    applyCurrentTheme();
    applyFontSize(currentFontSizeKey);
    populateYearSelector();
    renderTiresTab();
    renderLiveFuelCard();
    fetchLiveFuelPrices();
    renderAll();
  });
});
