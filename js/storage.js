// --- STORAGE.JS: VERİ DEPOLAMA, PROFİL VE YEDEKLEME ---

const STORAGE_PREFIX = "ototakip_promax_";

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

function getPersistedData(key, legacyKeys, defaultValue) {
  let data = localStorage.getItem(STORAGE_PREFIX + key);
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
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

const defaultProfile = { name: "Carveri", desc: "", fuelTank: 50, fuelType: "benzin", hasLpg: false, lpgTank: 40 };

window.fuels = getPersistedData("fuels", ["ototakip_fuels", "oto_fuels_v8"], []);
window.odoLogs = getPersistedData("odologs", ["ototakip_odologs", "oto_odologs_v8"], []);
window.expenses = getPersistedData("expenses", ["ototakip_expenses", "oto_expenses_v8"], []);
window.activeRoute = getPersistedData("active_route", [], null);
window.completedRoutes = getPersistedData("completed_routes", [], []);
window.customPaymentMethods = getPersistedData("payment_methods", ["ototakip_payment_methods"], ["Nakit", "Bonus", "Maximum", "World", "Axess", "Bankkart"]);
window.cardRewards = getPersistedData("card_rewards", ["ototakip_card_rewards"], {});
window.liveFuelData = getPersistedData("live_fuel_prices", [], null);
window.carProfile = getPersistedData("profile", ["ototakip_profile", "oto_profile_v2"], defaultProfile);
window.vehicleNotes = localStorage.getItem(STORAGE_PREFIX + "vehicle_notes") || "";
window.defaultTireData = { 
  activeSet: "summer", 
  summer: { sol_on: { status: "Sorunsuz", history: [] }, sag_on: { status: "Sorunsuz", history: [] }, sol_arka: { status: "Sorunsuz", history: [] }, sag_arka: { status: "Sorunsuz", history: [] }, mountedKm: 0, mountedDate: "" }, 
  winter: { sol_on: { status: "Sorunsuz", history: [] }, sag_on: { status: "Sorunsuz", history: [] }, sol_arka: { status: "Sorunsuz", history: [] }, sag_arka: { status: "Sorunsuz", history: [] }, mountedKm: 0, mountedDate: "" } 
};
window.tireData = getPersistedData("tires", ["ototakip_tires", "oto_tires_v8"], window.defaultTireData);

let lastBackupTimestamp = localStorage.getItem(STORAGE_PREFIX + "last_backup") || null;

function persistAllData() {
  localStorage.setItem(STORAGE_PREFIX + "fuels", JSON.stringify(window.fuels || []));
  localStorage.setItem(STORAGE_PREFIX + "odologs", JSON.stringify(window.odoLogs || []));
  localStorage.setItem(STORAGE_PREFIX + "expenses", JSON.stringify(window.expenses || []));
  localStorage.setItem(STORAGE_PREFIX + "tires", JSON.stringify(window.tireData || window.defaultTireData));
  localStorage.setItem(STORAGE_PREFIX + "profile", JSON.stringify(window.carProfile || defaultProfile));
  localStorage.setItem(STORAGE_PREFIX + "vehicle_notes", window.vehicleNotes || "");
  localStorage.setItem(STORAGE_PREFIX + "active_route", JSON.stringify(window.activeRoute || null));
  localStorage.setItem(STORAGE_PREFIX + "completed_routes", JSON.stringify(window.completedRoutes || []));
}

function persistPaymentMethods() {
  localStorage.setItem(STORAGE_PREFIX + "payment_methods", JSON.stringify(window.customPaymentMethods));
  localStorage.setItem(STORAGE_PREFIX + "card_rewards", JSON.stringify(window.cardRewards));
  if (typeof populatePaymentSelects === 'function') populatePaymentSelects();
  if (typeof renderPaymentBreakdown === 'function') renderPaymentBreakdown();
}

function getLatestVehicleKm() {
  let maxKm = 0;
  if (window.fuels) window.fuels.forEach(f => { if (f.km > maxKm) maxKm = f.km; });
  if (window.odoLogs) window.odoLogs.forEach(o => { if (o.km > maxKm) maxKm = o.km; });
  if (window.expenses) window.expenses.forEach(e => { if (e.maintenanceKm && e.maintenanceKm > maxKm) maxKm = e.maintenanceKm; });
  return maxKm;
}

function applyCarProfile() {
  const liveKm = getLatestVehicleKm();
  const nameEl = document.getElementById("headerCarName");
  const descEl = document.getElementById("headerCarDesc");
  if (nameEl) nameEl.innerText = window.carProfile.name || "Carveri";
  if (descEl) descEl.innerText = `${window.carProfile.desc || 'Model'} • ${liveKm > 0 ? liveKm.toLocaleString('tr-TR') + ' KM' : 'KM Yok'}`;

  const cfgName = document.getElementById("cfgCarName");
  const cfgDesc = document.getElementById("cfgCarDesc");
  const cfgTank = document.getElementById("cfgFuelTank");
  const cfgType = document.getElementById("cfgFuelType");
  const cfgHasLpg = document.getElementById("cfgHasLpg");
  const cfgLpgTank = document.getElementById("cfgLpgTank");

  if (cfgName) cfgName.value = window.carProfile.name || "";
  if (cfgDesc) cfgDesc.value = window.carProfile.desc || "";
  if (cfgTank) cfgTank.value = window.carProfile.fuelTank || 50;
  if (cfgType) cfgType.value = window.carProfile.fuelType || "benzin";
  if (cfgHasLpg) cfgHasLpg.checked = !!window.carProfile.hasLpg;
  if (cfgLpgTank) cfgLpgTank.value = window.carProfile.lpgTank || 40;

  const notesEl = document.getElementById("appVehicleNotes");
  if (notesEl && notesEl.value !== window.vehicleNotes) {
    notesEl.value = window.vehicleNotes || "";
  }

  toggleLpgConfigField();
  highlightActiveFuelBox();
  updateLpgVisibilityInApp();
}

function toggleLpgConfigField() {
  const lpgField = document.getElementById("lpgConfigField");
  const cfgHasLpg = document.getElementById("cfgHasLpg");
  if (lpgField && cfgHasLpg) {
    lpgField.classList.toggle("hidden", !cfgHasLpg.checked);
  }
}

function toggleProfileAccordion() {
  const b = document.getElementById("profileAccordionBody");
  if (!b) return;
  b.classList.toggle("hidden");
  if (!b.classList.contains("hidden")) b.style.display = "block";
}

function saveCarProfile() {
  window.carProfile = {
    name: document.getElementById("cfgCarName").value.trim() || "Carveri",
    desc: document.getElementById("cfgCarDesc").value.trim(),
    fuelTank: parseFloat(document.getElementById("cfgFuelTank").value) || 50,
    fuelType: document.getElementById("cfgFuelType") ? document.getElementById("cfgFuelType").value : "benzin",
    hasLpg: document.getElementById("cfgHasLpg").checked,
    lpgTank: parseFloat(document.getElementById("cfgLpgTank").value) || 40
  };
  persistAllData();
  applyCarProfile();
  if (typeof renderAll === 'function') renderAll();
  toggleProfileAccordion();
  alert("Araç profili güncellendi!");
}

// CANLI AKARYAKIT FİYATLARI (ORİJİNAL ÇALIŞAN ÇAĞRI)
async function fetchLiveFuelPrices() {
  const url = "https://eskisehir-akaryakit-botu.aiicinalindi.workers.dev/";
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      window.liveFuelData = data;
      localStorage.setItem(STORAGE_PREFIX + "live_fuel_prices", JSON.stringify(data));
      renderLiveFuelCard();
    } else {
      renderLiveFuelCard();
    }
  } catch (err) {
    renderLiveFuelCard();
  }
}

function renderLiveFuelCard() {
  const bBenzin = document.getElementById("valPriceBenzin");
  const bMotorin = document.getElementById("valPriceMotorin");
  const bLpg = document.getElementById("valPriceLpg");
  const badge = document.getElementById("fuelPriceUpdateBadge");

  if (!window.liveFuelData || !window.liveFuelData.fiyatlar) {
    if (badge) badge.innerText = "Fiyat Bekleniyor";
    return;
  }

  const f = window.liveFuelData.fiyatlar;
  if (bBenzin) bBenzin.innerText = f.benzin || "--";
  if (bMotorin) bMotorin.innerText = f.motorin || "--";
  if (bLpg) bLpg.innerText = f.lpg || "--";
  if (badge) badge.innerText = window.liveFuelData.tarih ? `Güncel: ${window.liveFuelData.tarih}` : "Canlı";

  highlightActiveFuelBox();
}

function highlightActiveFuelBox() {
  const fType = (window.carProfile && window.carProfile.fuelType) || "benzin";
  const hasLpg = !!(window.carProfile && window.carProfile.hasLpg);

  ["Benzin", "Motorin", "Lpg"].forEach(k => {
    const el = document.getElementById("boxPrice" + k);
    if (el) el.className = "p-2 rounded-xl theme-sub-box border border-transparent transition-all";
  });

  const activeKey = fType === "motorin" ? "Motorin" : "Benzin";
  const target = document.getElementById("boxPrice" + activeKey);
  if (target) {
    target.className = "p-2 rounded-xl theme-sub-box border border-amber-500 bg-amber-500/10 font-black";
  }
  if (hasLpg) {
    const lpgTarget = document.getElementById("boxPriceLpg");
    if (lpgTarget) lpgTarget.className = "p-2 rounded-xl theme-sub-box border border-cyan-500/60 bg-cyan-500/10";
  }
}

function updateLpgVisibilityInApp() {
  const wrapper = document.getElementById("fuelTypeWrapper");
  if (wrapper) {
    wrapper.classList.toggle("hidden", !(window.carProfile && window.carProfile.hasLpg));
  }
}
