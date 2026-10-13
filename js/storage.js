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
  populatePaymentSelects();
  renderPaymentBreakdown();
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
  if (typeof highlightActiveFuelBox === 'function') highlightActiveFuelBox();
  if (typeof updateLpgVisibilityInApp === 'function') updateLpgVisibilityInApp();
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
  renderAll();
  toggleProfileAccordion();
  alert("Araç profili güncellendi!");
}

let notesTimeout = null;
function saveAppNotesLive() {
  const el = document.getElementById("appVehicleNotes");
  if (!el) return;
  window.vehicleNotes = el.value;
  localStorage.setItem(STORAGE_PREFIX + "vehicle_notes", window.vehicleNotes);
  const badge = document.getElementById("notesSavedBadge");
  if (badge) {
    badge.classList.remove("hidden");
    badge.style.display = "inline-block";
    clearTimeout(notesTimeout);
    notesTimeout = setTimeout(() => {
      badge.classList.add("hidden");
      badge.style.display = "none";
    }, 1500);
  }
}

async function exportBackupZip() {
  try {
    if (typeof JSZip === "undefined") {
      return alert("JSZip kütüphanesi yüklenemedi. Lütfen kütüphanenin libs klasöründe mevcut olduğunu kontrol edin.");
    }

    const nowStr = new Date().toLocaleString('tr-TR');
    lastBackupTimestamp = nowStr;
    localStorage.setItem(STORAGE_PREFIX + "last_backup", nowStr);
    const badge = document.getElementById("lastBackupTimeBadge");
    if (badge) badge.innerText = `Son Yedek: ${nowStr}`;

    const zip = new JSZip();

    const dataJson = {
      fuels: window.fuels || [],
      odoLogs: window.odoLogs || [],
      expenses: window.expenses || [],
      tires: window.tireData || window.defaultTireData,
      profile: window.carProfile || defaultProfile,
      notes: window.vehicleNotes || "",
      activeRoute: window.activeRoute || null,
      completedRoutes: window.completedRoutes || [],
      paymentMethods: window.customPaymentMethods || ["Nakit"],
      cardRewards: window.cardRewards || {},
      exportedAt: getNowLocalISO()
    };

    zip.file("veriler.json", JSON.stringify(dataJson, null, 2));

    const docsFolder = zip.folder("belgeler");
    const allDocs = await getAllDocsFromDB();
    
    for (const [docId, dataUri] of Object.entries(allDocs)) {
      if (!dataUri) continue;
      const commaIdx = dataUri.indexOf(",");
      if (commaIdx === -1) continue;
      
      const metaPart = dataUri.substring(0, commaIdx);
      const base64Content = dataUri.substring(commaIdx + 1);

      let ext = ".jpg";
      if (metaPart.includes("pdf")) ext = ".pdf";
      else if (metaPart.includes("png")) ext = ".png";
      else if (metaPart.includes("webp")) ext = ".webp";

      docsFolder.file(`${docId}${ext}`, base64Content, { base64: true });
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Carveri_Yedek_${new Date().toISOString().split("T")[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

  } catch (err) {
    alert("ZIP yedekleme hatası: " + err.message);
  }
}

async function importBackupFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    if (file.name.endsWith(".zip")) {
      if (typeof JSZip === "undefined") return alert("JSZip kütüphanesi yüklenemedi.");
      
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("veriler.json");
      if (!jsonFile) return alert("Hata: ZIP içinde 'veriler.json' bulunamadı.");

      const jsonText = await jsonFile.async("text");
      const p = JSON.parse(jsonText);

      window.fuels = Array.isArray(p.fuels) ? p.fuels : [];
      window.odoLogs = Array.isArray(p.odoLogs) ? p.odoLogs : [];
      window.expenses = Array.isArray(p.expenses) ? p.expenses : [];
      window.tireData = p.tires || window.defaultTireData;
      window.carProfile = p.profile || defaultProfile;
      window.vehicleNotes = p.notes || "";
      window.activeRoute = p.activeRoute || null;
      window.completedRoutes = Array.isArray(p.completedRoutes) ? p.completedRoutes : [];
      window.customPaymentMethods = Array.isArray(p.paymentMethods) ? p.paymentMethods : ["Nakit", "Bonus", "Maximum", "World"];
      window.cardRewards = p.cardRewards || {};

      const docEntries = Object.keys(zip.files).filter(k => k.startsWith("belgeler/") && !zip.files[k].dir);
      for (const path of docEntries) {
        const fileName = path.split("/").pop();
        const match = fileName.match(/^(.+?)(\.[^.]*)?$/);
        const docId = match ? match[1] : fileName;
        const ext = match && match[2] ? match[2].toLowerCase() : "";

        let mime = "image/jpeg";
        if (ext === ".pdf") mime = "application/pdf";
        else if (ext === ".png") mime = "image/png";
        else if (ext === ".webp") mime = "image/webp";

        const b64 = await zip.file(path).async("base64");
        const dataUri = `data:${mime};base64,${b64}`;
        await saveDocToDB(docId, dataUri);
      }

      persistAllData();
      persistPaymentMethods();
      populateYearSelector();
      renderTiresTab();
      renderAll();
      alert("✓ ZIP yedeği başarıyla geri yüklendi!");
      e.target.value = "";

    } else if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          let rawText = ev.target.result.trim();
          if (rawText.charCodeAt(0) === 0xFEFF) rawText = rawText.slice(1);
          let p = JSON.parse(rawText);
          window.fuels = Array.isArray(p.fuels) ? p.fuels : [];
          window.odoLogs = Array.isArray(p.odoLogs) ? p.odoLogs : [];
          window.expenses = Array.isArray(p.expenses) ? p.expenses : [];
          window.tireData = p.tires || window.defaultTireData;
          window.carProfile = p.profile || defaultProfile;
          window.vehicleNotes = p.notes || "";
          window.activeRoute = p.activeRoute || null;
          window.completedRoutes = Array.isArray(p.completedRoutes) ? p.completedRoutes : [];
          window.customPaymentMethods = Array.isArray(p.paymentMethods) ? p.paymentMethods : ["Nakit", "Bonus", "Maximum", "World"];
          window.cardRewards = p.cardRewards || {};
          if (p.documents && typeof p.documents === 'object') {
            for (let [dId, dUri] of Object.entries(p.documents)) {
              if (dUri) await saveDocToDB(dId, dUri);
            }
          }
          persistAllData();
          persistPaymentMethods();
          populateYearSelector();
          renderTiresTab();
          renderAll();
          alert("✓ JSON yedeği başarıyla geri yüklendi!");
          e.target.value = "";
        } catch (err) {
          alert("JSON Yükleme Hatası:\n" + err.message);
        }
      };
      reader.readAsText(file, "UTF-8");
    } else {
      alert("Lütfen geçerli bir .zip veya .json dosyası seçin.");
    }
  } catch (err) {
    alert("Yedek yükleme hatası: " + err.message);
  }
}

function exportCSV() {
  try {
    const safeFuels = (window.fuels && Array.isArray(window.fuels)) ? window.fuels : [];
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

async function wipeAllDataSecurely() {
  const confirmVal = (document.getElementById("wipeConfirmInput").value || "").trim().toUpperCase();
  if (confirmVal !== "EVET") return alert("Silmek için EVET yazın.");
  if (confirm("Tüm veriler kalıcı olarak silinecek. Emin misiniz?")) {
    window.fuels = [];
    window.odoLogs = [];
    window.expenses = [];
    window.activeRoute = null;
    window.completedRoutes = [];
    window.tireData = window.defaultTireData;
    window.carProfile = defaultProfile;
    window.vehicleNotes = "";
    window.customPaymentMethods = ["Nakit"];
    window.cardRewards = {};
    await clearAllDocsFromDB();
    persistAllData();
    persistPaymentMethods();
    renderAll();
    alert("Sıfırlandı!");
    switchTab("dashboard");
  }
}
