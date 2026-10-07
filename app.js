// -------------------------------------------------------------
// APP.JS - ANA YÖNETİM, VERİTABANI, TEMA VE YEDEK MOTORU
// -------------------------------------------------------------
const IDB_NAME = "OtoTakipProMax_DB";
const IDB_VERSION = 1;
let dbInstance = null;

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

async function saveDocToDB(id, dataUri) {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction("documents", "readwrite");
    tx.objectStore("documents").put({ id, dataUri });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

async function getDocFromDB(id) {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readonly");
    const req = tx.objectStore("documents").get(id);
    req.onsuccess = () => resolve(req.result ? req.result.dataUri : null);
    req.onerror = () => resolve(null);
  });
}

async function deleteDocFromDB(id) {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readwrite");
    tx.objectStore("documents").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function getAllDocsFromDB() {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readonly");
    const req = tx.objectStore("documents").getAll();
    req.onsuccess = () => {
      let map = {};
      (req.result || []).forEach(item => { map[item.id] = item.dataUri; });
      resolve(map);
    };
    req.onerror = () => resolve({});
  });
}

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(() => {});
}

function getNowLocalISO(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeLabel(isoStr) {
  if (!isoStr) return "";
  if (isoStr.includes("T")) {
    const [d, t] = isoStr.split("T");
    return `${d} ${t.substring(0, 5)}`;
  }
  return isoStr;
}

const STORAGE_PREFIX = "ototakip_promax_";

function getPersistedData(key, legacyKeys, defaultValue) {
  let data = localStorage.getItem(STORAGE_PREFIX + key);
  if (data) { try { return JSON.parse(data); } catch(e) {} }
  for (let lk of legacyKeys) {
    let legacyData = localStorage.getItem(lk);
    if (legacyData) {
      try {
        let parsed = JSON.parse(legacyData);
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(parsed));
        return parsed;
      } catch(e) {}
    }
  }
  return defaultValue;
}

const defaultProfile = { name: "Carveri", desc: "", fuelTank: 50, hasLpg: false, lpgTank: 40 };
let carProfile = getPersistedData("profile", ["ototakip_profile", "oto_profile_v2"], defaultProfile);
let lastBackupTimestamp = localStorage.getItem(STORAGE_PREFIX + "last_backup") || null;

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
  if (tIco) tIco.innerText = themeMeta[userThemePref].icon;

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
    if (userThemePref === "auto") {
      applyCurrentTheme();
    }
  });
}

const fontSizes = { small: { size: '14px', label: '%100' }, medium: { size: '16px', label: '%115' }, large: { size: '18px', label: '%130' } };
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
      btn.className = matches ? "py-2.5 rounded-xl bg-blue-600 text-white font-black shadow-md transition-all" : "py-2.5 rounded-xl custom-card border text-[11px] font-bold shadow-sm custom-muted";
    }
  });
}
function setFontSize(key) { applyFontSize(key); }

const tabsList = ["dashboard", "fuel", "expenses", "tires", "backup"];

function switchTab(tab) {
  tabsList.forEach(t => {
    const el = document.getElementById("tab" + t.charAt(0).toUpperCase() + t.slice(1));
    const btn = document.getElementById("nav" + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.add("hidden");
    if (btn) {
      btn.className = "nav-btn flex flex-col items-center py-1.5 px-3 rounded-2xl custom-muted font-medium transition-all cursor-pointer";
    }
  });
  const activeEl = document.getElementById("tab" + tab.charAt(0).toUpperCase() + tab.slice(1));
  const activeBtn = document.getElementById("nav" + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (activeEl) activeEl.classList.remove("hidden");
  if (activeBtn) {
    activeBtn.className = "nav-btn flex flex-col items-center py-1.5 px-3 rounded-2xl bg-blue-600/20 text-cyan-600 dark:text-cyan-400 font-black transition-all cursor-pointer";
  }
}

function openModalDirectly(id) {
  document.getElementById(id).classList.remove("hidden");
  const nav = document.getElementById("bottomNavigationBar");
  if (nav) nav.classList.add("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
  const anyOpen = Array.from(document.querySelectorAll('.modal-backdrop')).some(el => !el.classList.contains('hidden'));
  if (!anyOpen) {
    const nav = document.getElementById("bottomNavigationBar");
    if (nav) nav.classList.remove("hidden");
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
      if (!anyOpen) nav.classList.remove("hidden");
    }
  });
}

function getLatestVehicleKm() {
  let maxKm = 0;
  if (window.fuels) window.fuels.forEach(f => { if (f.km > maxKm) maxKm = f.km; });
  if (window.odoLogs) window.odoLogs.forEach(o => { if (o.km > maxKm) maxKm = o.km; });
  if (typeof expenses !== 'undefined') expenses.forEach(e => { if (e.maintenanceKm && e.maintenanceKm > maxKm) maxKm = e.maintenanceKm; });
  return maxKm;
}

const currentSystemYear = new Date().getFullYear().toString();
let selectedYear = localStorage.getItem(STORAGE_PREFIX + "selected_year") || currentSystemYear;

function populateYearSelector() {
  const yearSelect = document.getElementById("globalYearSelect");
  const yearsSet = new Set();

  if (window.fuels) {
    window.fuels.forEach(f => { if (f.date && f.date.length >= 4) yearsSet.add(f.date.substring(0, 4)); });
  }
  if (window.odoLogs) {
    window.odoLogs.forEach(o => { if (o.date && o.date.length >= 4) yearsSet.add(o.date.substring(0, 4)); });
  }
  if (typeof expenses !== 'undefined') {
    expenses.forEach(e => { if (e.date && e.date.length >= 4) yearsSet.add(e.date.substring(0, 4)); });
  }

  if (yearsSet.size === 0) {
    yearsSet.add(currentSystemYear);
  }

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

function applyCarProfile() {
  const liveKm = getLatestVehicleKm();
  document.getElementById("headerCarName").innerText = carProfile.name || "Carveri";
  document.getElementById("headerCarDesc").innerText = `${carProfile.desc || 'Model'} • ${liveKm > 0 ? liveKm.toLocaleString('tr-TR') + ' KM' : 'KM Yok'}`;
  document.getElementById("cfgCarName").value = carProfile.name || "";
  document.getElementById("cfgCarDesc").value = carProfile.desc || "";
  document.getElementById("cfgFuelTank").value = carProfile.fuelTank || 50;
  document.getElementById("cfgHasLpg").checked = !!carProfile.hasLpg;
  document.getElementById("cfgLpgTank").value = carProfile.lpgTank || 40;
  toggleLpgConfigField();
  if (typeof updateLpgVisibilityInApp === 'function') updateLpgVisibilityInApp();
}

function toggleLpgConfigField() { 
  document.getElementById("lpgConfigField").classList.toggle("hidden", !document.getElementById("cfgHasLpg").checked); 
}
function toggleProfileAccordion() { 
  document.getElementById("profileAccordionBody").classList.toggle("hidden"); 
}

function saveCarProfile() {
  carProfile = {
    name: document.getElementById("cfgCarName").value.trim() || "Carveri",
    desc: document.getElementById("cfgCarDesc").value.trim(),
    fuelTank: parseFloat(document.getElementById("cfgFuelTank").value) || 50,
    hasLpg: document.getElementById("cfgHasLpg").checked,
    lpgTank: parseFloat(document.getElementById("cfgLpgTank").value) || 40
  };
  persistAllData();
  applyCarProfile();
  renderAll();
  toggleProfileAccordion();
  alert("Araç profili güncellendi!");
}

async function exportJSON() {
  try {
    const nowStr = new Date().toLocaleString('tr-TR');
    lastBackupTimestamp = nowStr;
    localStorage.setItem(STORAGE_PREFIX + "last_backup", nowStr);
    const badge = document.getElementById("lastBackupTimeBadge");
    if (badge) badge.innerText = `Son Yedek: ${nowStr}`;

    const allDocs = await getAllDocsFromDB();
    
    const safeFuels = (window.fuels && Array.isArray(window.fuels)) ? window.fuels : getPersistedData("fuels", [], []);
    const safeOdoLogs = (window.odoLogs && Array.isArray(window.odoLogs)) ? window.odoLogs : getPersistedData("odologs", [], []);
    const safeExpenses = (typeof expenses !== 'undefined' && Array.isArray(expenses)) ? expenses : getPersistedData("expenses", [], []);
    
    const fallbackTires = (typeof defaultTireData !== 'undefined') ? defaultTireData : { activeSet: "summer", summer: {}, winter: {} };
    const safeTires = (typeof tireData !== 'undefined') ? tireData : getPersistedData("tires", [], fallbackTires);
    const safeProfile = (typeof carProfile !== 'undefined') ? carProfile : getPersistedData("profile", [], defaultProfile);
    const safeRoute = (window.activeRoute !== 'undefined') ? window.activeRoute : getPersistedData("active_route", [], null);
    const safePaymentMethods = (typeof customPaymentMethods !== 'undefined') ? customPaymentMethods : getPersistedData("payment_methods", [], ["Nakit"]);
    const safeCardRewards = (typeof cardRewards !== 'undefined') ? cardRewards : getPersistedData("card_rewards", [], {});

    const backupData = {
      fuels: safeFuels,
      odoLogs: safeOdoLogs,
      expenses: safeExpenses,
      tires: safeTires,
      profile: safeProfile,
      activeRoute: safeRoute,
      paymentMethods: safePaymentMethods,
      cardRewards: safeCardRewards,
      documents: allDocs
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Carveri_Yedek_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
  } catch (err) {
    alert("Yedekleme sırasında bir hata oluştu: " + err.message);
  }
}

function exportCSV() {
  try {
    const safeFuels = (window.fuels && Array.isArray(window.fuels)) ? window.fuels : getPersistedData("fuels", [], []);
    let csv = "Tarih,Km,Tur,Istasyon,Sube,Litre,ToplamTL,BirimFiyat,DolumSeviyesi,Odeme\n";
    
    safeFuels.forEach(f => {
      const unitP = (f.liters > 0) ? (f.total / f.liters).toFixed(2) : "0.00";
      csv += `${f.date || ''},${f.km || ''},${f.fuelType || 'Benzin/Dizel'},${f.station || ''},"${f.branch || ''}",${f.liters || 0},${f.total || 0},${unitP},${f.isFull ? 'Tam' : 'Kısmi'},${f.paymentMethod || 'Nakit'}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Carveri_Yakit_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
  } catch (err) {
    alert("CSV dışa aktarma hatası: " + err.message);
  }
}

async function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      let rawText = ev.target.result;
      if (typeof rawText !== "string") {
        throw new Error("Dosya metin formatında okunamadı.");
      }

      rawText = rawText.trim();
      if (rawText.charCodeAt(0) === 0xFEFF) {
        rawText = rawText.slice(1);
      }

      let p;
      try {
        p = JSON.parse(rawText);
      } catch (jsonErr) {
        throw new Error("JSON formatı hatalı: " + jsonErr.message);
      }

      window.fuels = Array.isArray(p.fuels) ? p.fuels : [];
      window.odoLogs = Array.isArray(p.odoLogs) ? p.odoLogs : [];
      window.expenses = Array.isArray(p.expenses) ? p.expenses : [];
      
      const safeDefaultTires = (typeof defaultTireData !== 'undefined') ? defaultTireData : {};
      const safeDefaultProfile = (typeof defaultProfile !== 'undefined') ? defaultProfile : {};
      const safeDefaultPayments = (typeof defaultPaymentMethods !== 'undefined') ? defaultPaymentMethods : ["Nakit", "Bonus", "Maximum", "World"];

      window.tireData = p.tires || safeDefaultTires;
      window.carProfile = p.profile || safeDefaultProfile;
      window.activeRoute = p.activeRoute || null;
      window.customPaymentMethods = Array.isArray(p.paymentMethods) ? p.paymentMethods : safeDefaultPayments;
      window.cardRewards = (p.cardRewards && typeof p.cardRewards === 'object') ? p.cardRewards : {};

      if (p.documents && typeof p.documents === 'object') {
        for (let [dId, dUri] of Object.entries(p.documents)) {
          if (dUri && typeof saveDocToDB === 'function') await saveDocToDB(dId, dUri);
        }
      }

      for (let f of window.fuels) {
        if (f.docData && !f.docId) {
          const nid = "doc_fuel_" + f.id + "_" + Math.random().toString(36).substring(2, 6);
          if (typeof saveDocToDB === 'function') await saveDocToDB(nid, f.docData);
          f.docId = nid;
          delete f.docData;
        }
      }

      for (let exp of window.expenses) {
        if (exp.docData && !exp.docId) {
          const nid = "doc_exp_" + exp.id + "_" + Math.random().toString(36).substring(2, 6);
          if (typeof saveDocToDB === 'function') await saveDocToDB(nid, exp.docData);
          exp.docId = nid;
          delete exp.docData;
        }
      }

      if (typeof persistAllData === 'function') persistAllData();
      if (typeof persistPaymentMethods === 'function') persistPaymentMethods();
      if (typeof populateYearSelector === 'function') populateYearSelector();
      if (typeof renderTiresTab === 'function') renderTiresTab();
      if (typeof renderAll === 'function') renderAll();

      alert("✓ Yedek başarıyla yüklendi!");
      e.target.value = "";
    } catch (err) {
      alert("Yükleme Hatası:\n" + err.message);
    }
  };

  reader.onerror = () => {
    alert("Dosya okunamadı. Lütfen dosyayı tekrar seçin.");
  };

  reader.readAsText(file, "UTF-8");
}

function wipeAllDataSecurely() {
  if ((document.getElementById("wipeConfirmInput").value || "").trim().toUpperCase() !== "EVET") return alert("Silmek için EVET yazın.");
  if (confirm("Tüm veriler kalıcı olarak silinecek. Emin misiniz?")) {
    window.fuels = []; window.odoLogs = []; expenses = []; window.activeRoute = null;
    tireData = (typeof defaultTireData !== 'undefined') ? defaultTireData : {};
    carProfile = defaultProfile;
    customPaymentMethods = (typeof defaultPaymentMethods !== 'undefined') ? [...defaultPaymentMethods] : ["Nakit"];
    cardRewards = {};
    persistAllData();
    persistPaymentMethods();
    renderAll();
    alert("Sıfırlandı!");
    switchTab("dashboard");
  }
}

function persistAllData() {
  localStorage.setItem(STORAGE_PREFIX + "fuels", JSON.stringify(window.fuels));
  localStorage.setItem(STORAGE_PREFIX + "odologs", JSON.stringify(window.odoLogs));
  localStorage.setItem(STORAGE_PREFIX + "expenses", JSON.stringify(expenses));
  localStorage.setItem(STORAGE_PREFIX + "tires", JSON.stringify(tireData));
  localStorage.setItem(STORAGE_PREFIX + "profile", JSON.stringify(carProfile));
  localStorage.setItem(STORAGE_PREFIX + "active_route", JSON.stringify(window.activeRoute));
}

function renderAll() {
  applyCarProfile();
  populatePaymentSelects();

  const ff = window.fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
  const fe = expenses.filter(e => selectedYear === "all" || (e.date && e.date.startsWith(selectedYear)));
  const cf = calculateFuelMetrics(ff);

  document.getElementById("dashPeriodTitle").innerText = `Dönem: ${selectedYear === "all" ? "Tüm Zamanlar" : selectedYear}`;
  document.getElementById("fuelPeriodIndicator").innerText = `Gösterilen: ${selectedYear === "all" ? "Tüm Zamanlar" : selectedYear}`;
  document.getElementById("dashTotalEntries").innerText = `${ff.length + fe.length} Kayıt`;

  let tfc = 0, tl = 0;
  ff.forEach(f => { tfc += f.total; tl += f.liters; });

  let fc = 0, vc = tfc;
  fe.forEach(e => {
    if (EXPENSE_TYPES.FIXED.includes(e.type)) fc += e.amount;
    else vc += e.amount;
  });

  document.getElementById("statFuelExpense").innerText = `₺${Math.round(tfc).toLocaleString('tr-TR')}`;
  document.getElementById("statFuelVolume").innerText = `Hacim: ${tl.toFixed(1)} L`;
  document.getElementById("statTotalOwnership").innerText = `₺${Math.round(fc + vc).toLocaleString('tr-TR')}`;
  document.getElementById("statFixedExpense").innerText = `₺${Math.round(fc).toLocaleString('tr-TR')}`;
  document.getElementById("statVariableExpense").innerText = `₺${Math.round(vc).toLocaleString('tr-TR')}`;

  const sbd = cf.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentAvgCons = null;

  if (sbd.length >= 2) {
    let dK = sbd[sbd.length - 1].km - sbd[0].km;
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

  updateRangeEstimate(currentAvgCons);
  updateActiveRouteBanner();
  renderFuelCards(getFilteredCombinedLogs());
  renderExpenseCards();
  if (typeof renderCharts === 'function') renderCharts(cf);
}

// GÜVENLİ BAŞLATICI: Wszystkie modüle hazır olunca tek seferde çalıştır
window.addEventListener('DOMContentLoaded', () => {
  initIndexedDB().then(() => {
    applyCurrentTheme();
    applyFontSize(currentFontSizeKey);
    populateYearSelector();
    if (typeof renderTiresTab === 'function') renderTiresTab();
    renderAll();
  });
});
