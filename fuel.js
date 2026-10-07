// -------------------------------------------------------------
// FUEL.JS - YAKIT, KİLOMETRE, MENZİL VE ROTA MOTORU
// -------------------------------------------------------------
let fuels = getPersistedData("fuels", ["ototakip_fuels", "oto_fuels_v8"], []);
let odoLogs = getPersistedData("odologs", ["ototakip_odologs", "oto_odologs_v8"], []);
let activeRoute = getPersistedData("active_route", [], null);

function updateLpgVisibilityInApp() { 
  document.getElementById("fuelTypeWrapper").classList.toggle("hidden", !carProfile.hasLpg); 
}

function validateTimelineOdo(targetDateStr, targetKm, excludeId = null) {
  if (!targetDateStr || isNaN(targetKm) || targetKm <= 0) return { isValid: true };
  
  const allEvents = [];
  const exStr = excludeId ? String(excludeId) : null;

  fuels.forEach(f => { if (String(f.id) !== exStr) allEvents.push({ date: f.date, km: f.km }); });
  odoLogs.forEach(o => { if (String(o.id) !== exStr) allEvents.push({ date: o.date, km: o.km }); });
  if (typeof expenses !== 'undefined') {
    expenses.forEach(e => { if (e.maintenanceKm && String(e.id) !== exStr) allEvents.push({ date: e.date, km: e.maintenanceKm }); });
  }

  allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  const prevEvent = allEvents.filter(e => e.date <= targetDateStr).pop();
  const nextEvent = allEvents.find(e => e.date > targetDateStr);

  if (prevEvent && targetKm < prevEvent.km) {
    return { isValid: false, msg: `⚠️ Girilen KM, ${prevEvent.date.split('T')[0]} tarihindeki sayaçtan (${prevEvent.km.toLocaleString('tr-TR')} KM) daha düşük olamaz!` };
  }
  if (nextEvent && targetKm > nextEvent.km) {
    return { isValid: false, msg: `⚠️ Girilen KM, ${nextEvent.date.split('T')[0]} tarihindeki sonraki sayaçtan (${nextEvent.km.toLocaleString('tr-TR')} KM) daha yüksek olamaz!` };
  }
  return { isValid: true };
}

function checkOdoAnomalyLive() {
  const d = document.getElementById("mOdoDate").value;
  const km = parseFloat(document.getElementById("mOdoInput").value);
  const editId = document.getElementById("mOdoId").value;
  const warnEl = document.getElementById("odoAnomalyWarning");
  const res = validateTimelineOdo(d, km, editId);
  if (!res.isValid) {
    warnEl.innerText = res.msg;
    warnEl.classList.remove("hidden");
  } else {
    warnEl.classList.add("hidden");
  }
}

function checkFuelAnomalyLive() {
  const d = document.getElementById("fDate").value;
  const km = parseFloat(document.getElementById("fKm").value);
  const editId = document.getElementById("fId").value;
  const warnEl = document.getElementById("fuelAnomalyWarning");
  const res = validateTimelineOdo(d, km, editId);
  if (!res.isValid) {
    warnEl.innerText = res.msg;
    warnEl.classList.remove("hidden");
  } else {
    warnEl.classList.add("hidden");
  }
}

function checkFuelIntervalLive(val) {
  const km = parseFloat(val);
  const dateVal = document.getElementById("fDate").value || getNowLocalISO();
  const editId = document.getElementById("fId").value;
  const badge = document.getElementById("fuelIntervalBadge");
  const textEl = document.getElementById("fuelIntervalText");
  if (!badge || !textEl || isNaN(km) || km <= 0) {
    if (badge) badge.classList.add("hidden");
    return;
  }
  
  const prevFuels = fuels.filter(f => String(f.id) !== String(editId) && f.date <= dateVal).sort((a,b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const prev = prevFuels.pop();

  if (prev && km >= prev.km) {
    const distDiff = km - prev.km;
    const dayDiff = Math.max(0, Math.round((new Date(dateVal) - new Date(prev.date)) / (1000 * 60 * 60 * 24)));
    textEl.innerHTML = `Önceki yakıttan bu yana <b class="text-cyan-600 dark:text-cyan-400">+${distDiff.toLocaleString('tr-TR')} km</b> yol yapıldı <span class="custom-muted">(${dayDiff} gün önce)</span>`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function calculateTripFromOdo() {
  const odoVal = parseFloat(document.getElementById("mOdoInput").value);
  const sFuels = fuels.slice().sort((a,b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFuel = sFuels[sFuels.length - 1];
  if (lastFuel && odoVal >= lastFuel.km) {
    document.getElementById("mOdoTripInput").value = (odoVal - lastFuel.km).toFixed(1);
  }
}

function calculateOdoFromTrip() {
  const tripVal = parseFloat(document.getElementById("mOdoTripInput").value);
  const sFuels = fuels.slice().sort((a,b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFuel = sFuels[sFuels.length - 1];
  if (lastFuel && !isNaN(tripVal) && tripVal >= 0) {
    document.getElementById("mOdoInput").value = Math.round(lastFuel.km + tripVal);
    checkOdoAnomalyLive();
  }
}

function syncLitersFromPercent(pctVal) {
  const litInput = document.getElementById("mOdoFuelLiters");
  const tankCapacity = carProfile.fuelTank || 50;
  if (pctVal === "" || isNaN(pctVal)) { litInput.value = ""; return; }
  const pct = Math.max(0, Math.min(100, parseFloat(pctVal)));
  litInput.value = ((pct / 100) * tankCapacity).toFixed(1);
}

function syncPercentFromLiters(litVal) {
  const pctInput = document.getElementById("mOdoFuelPercent");
  const tankCapacity = carProfile.fuelTank || 50;
  if (litVal === "" || isNaN(litVal)) { pctInput.value = ""; return; }
  const lit = Math.max(0, Math.min(tankCapacity, parseFloat(litVal)));
  pctInput.value = Math.round((lit / tankCapacity) * 100);
}

function toggleRouteNameInput() {
  const isStart = document.getElementById("mOdoIsRouteStart").checked;
  document.getElementById("routeNameWrapper").classList.toggle("hidden", !isStart);
}

function calculateFuelMetrics(list) {
  const s = list.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  let r = [], poolLiters = 0, lastFullIdx = -1;
  
  for (let i = 0; i < s.length; i++) {
    let f = { ...s[i], consumption: null, dashDiff: null };
    const isFull = f.isFull !== undefined ? f.isFull : (f.fillLevel === 'full');
    
    if (isFull) {
      if (lastFullIdx !== -1) {
        let d = f.km - s[lastFullIdx].km;
        if (d > 0) {
          const actual = (((poolLiters + f.liters) / d) * 100);
          f.consumption = actual.toFixed(2);
          if (f.dashL100) {
            f.dashDiff = (actual - f.dashL100).toFixed(2);
          }
        }
      }
      poolLiters = 0;
      lastFullIdx = i;
    } else {
      poolLiters += f.liters;
    }
    r.push(f);
  } 
  return r;
}

function updateRangeEstimate(avgConsFromHistory) {
  const banner = document.getElementById("fuelRangeBanner");
  const tankCapacity = carProfile.fuelTank || 50;
  const liveKm = getLatestVehicleKm();
  
  const sFuels = fuels.slice().sort((a,b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFullFuel = sFuels.slice().reverse().find(f => (f.isFull !== undefined ? f.isFull : f.fillLevel === 'full'));
  const diffInfoEl = document.getElementById("lastFuelDiffInfo");

  if (lastFullFuel && liveKm >= lastFullFuel.km) {
    const dKm = liveKm - lastFullFuel.km;
    const days = Math.max(0, Math.round((new Date() - new Date(lastFullFuel.date)) / (1000 * 60 * 60 * 24)));
    diffInfoEl.innerText = `+${dKm.toLocaleString('tr-TR')} km (${days} gün)`;
  } else {
    diffInfoEl.innerText = `--`;
  }

  const sortedOdosWithDash = odoLogs.slice().filter(o => o.dashboardL100 > 0).sort((a,b) => new Date(a.date) - new Date(b.date));
  const lastOdoDash = sortedOdosWithDash.length ? sortedOdosWithDash[sortedOdosWithDash.length - 1].dashboardL100 : null;
  let effectiveCons = lastOdoDash || avgConsFromHistory || 0;
  effectiveCons = Number(effectiveCons);

  let remainingLiters = null;
  if (lastFullFuel) {
    let totalFuelInPool = tankCapacity;
    const partials = sFuels.filter(f => new Date(f.date) > new Date(lastFullFuel.date) && !(f.isFull !== undefined ? f.isFull : f.fillLevel === 'full'));
    partials.forEach(p => totalFuelInPool += p.liters);

    let burnedLiters = 0;
    if (effectiveCons > 0 && liveKm >= lastFullFuel.km) {
      burnedLiters = ((liveKm - lastFullFuel.km) * effectiveCons) / 100;
    }
    remainingLiters = Math.max(0, totalFuelInPool - burnedLiters);
  }

  const barsDisplay = document.getElementById("fuelBarsDisplay");
  if (remainingLiters !== null) {
    const estPct = Math.min(100, Math.round((remainingLiters / tankCapacity) * 100));
    barsDisplay.innerText = `%${estPct} (~${remainingLiters.toFixed(1)} L)`;
  } else {
    barsDisplay.innerText = `--`;
  }

  if (effectiveCons > 0 && remainingLiters !== null) {
    const estFullRange = Math.round((tankCapacity / effectiveCons) * 100);
    const remEst = Math.round((remainingLiters / effectiveCons) * 100);
    document.getElementById("fuelRangeText").innerText = `Tam Depo ile: ~${estFullRange.toLocaleString('tr-TR')} km (${effectiveCons.toFixed(2)} L/100km)`;
    document.getElementById("fuelRangeRemaining").innerText = `Kalan Tahmin: ~${remEst.toLocaleString('tr-TR')} km`;
    banner.classList.remove("hidden");
  } else {
    document.getElementById("fuelRangeText").innerText = `Depo Hacmi: ${tankCapacity} L`;
    document.getElementById("fuelRangeRemaining").innerText = `Tüketim bekleniyor`;
  }
}

function updateActiveRouteBanner() {
  const banner = document.getElementById("activeRouteBanner");
  if (!activeRoute) { banner.classList.add("hidden"); return; }

  const liveKm = getLatestVehicleKm();
  const sortedOdos = odoLogs.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  const latestOdo = sortedOdos[sortedOdos.length - 1];
  const curDash = latestOdo && latestOdo.dashboardL100 ? latestOdo.dashboardL100 : activeRoute.startDash;

  const dKm = Math.max(0, liveKm - activeRoute.startKm);
  let pureConsStr = "--";

  if (dKm > 0 && curDash > 0) {
    const lit1 = (activeRoute.startKm * activeRoute.startDash) / 100;
    const lit2 = (liveKm * curDash) / 100;
    const netLit = lit2 - lit1;
    if (netLit > 0) {
      const pure = (netLit / dKm) * 100;
      pureConsStr = pure.toFixed(2);
    }
  }

  document.getElementById("arName").innerText = activeRoute.name;
  document.getElementById("arDetails").innerText = `Yapılan: +${dKm.toLocaleString('tr-TR')} km • Saf Ort: ${pureConsStr} L/100km`;
  banner.classList.remove("hidden");
}

function finishRoutePrompt() {
  if (!activeRoute) return;
  const liveKm = getLatestVehicleKm();
  const endKm = prompt("Rotayı tamamlamak için bitiş kilometresini girin:", liveKm);
  if (!endKm) return;
  const endDash = prompt("Bitişte yol bilgisayarında yazan ortalama tüketimi girin (L/100km):", activeRoute.startDash);
  if (!endDash) return;

  const eK = parseFloat(endKm);
  const eD = parseFloat(endDash);
  const dKm = eK - activeRoute.startKm;

  if (dKm <= 0) return alert("Bitiş kilometresi başlangıçtan büyük olmalıdır.");

  const lit1 = (activeRoute.startKm * activeRoute.startDash) / 100;
  const lit2 = (eK * eD) / 100;
  const netLit = Math.max(0, lit2 - lit1);
  const pureCons = ((netLit / dKm) * 100).toFixed(2);

  alert(`✅ Rota Tamamlandı: "${activeRoute.name}"\n\nNet Yol: ${dKm.toLocaleString('tr-TR')} km\nSaf Yakıt Tüketimi: ${pureCons} L/100km\nHarcanan Net Yakıt: ${netLit.toFixed(1)} Litre`);
  activeRoute = null;
  persistAllData();
  renderAll();
}

function openOdoModal(editId = null) {
  const tankCapacity = carProfile.fuelTank || 50;
  if (editId) {
    const item = odoLogs.find(o => String(o.id) === String(editId));
    if (!item) return;
    document.getElementById("mOdoId").value = item.id;
    document.getElementById("mOdoDate").value = item.date;
    document.getElementById("mOdoInput").value = item.km;
    document.getElementById("mOdoDashboardL100").value = item.dashboardL100 || "";
    document.getElementById("mOdoFuelPercent").value = item.fuelPercent !== undefined && item.fuelPercent !== null ? item.fuelPercent : "";
    document.getElementById("mOdoFuelLiters").value = item.fuelPercent !== undefined && item.fuelPercent !== null ? ((item.fuelPercent / 100) * tankCapacity).toFixed(1) : "";
    document.getElementById("mOdoIsBridge").checked = !!item.isBridge;
    document.getElementById("mOdoNote").value = item.note || "";
    document.getElementById("mOdoIsRouteStart").checked = false;
    document.getElementById("routeNameWrapper").classList.add("hidden");
    document.getElementById("odoModalTitle").innerText = "📍 Kilometreyi Düzenle";
  } else {
    const liveKm = getLatestVehicleKm();
    document.getElementById("mOdoId").value = "";
    document.getElementById("mOdoDate").value = getNowLocalISO();
    document.getElementById("mOdoInput").value = liveKm > 0 ? liveKm : "";
    document.getElementById("mOdoDashboardL100").value = "";
    document.getElementById("mOdoFuelPercent").value = "";
    document.getElementById("mOdoFuelLiters").value = "";
    document.getElementById("mOdoIsBridge").checked = false;
    document.getElementById("mOdoNote").value = "";
    document.getElementById("mOdoIsRouteStart").checked = false;
    document.getElementById("mOdoRouteName").value = "";
    document.getElementById("routeNameWrapper").classList.add("hidden");
    document.getElementById("odoModalTitle").innerText = "📍 Araç Kilometresi Kaydet";
  }
  calculateTripFromOdo();
  document.getElementById("odoAnomalyWarning").classList.add("hidden");
  openModalDirectly("odoModal");
}

function saveManualOdo(e) {
  e.preventDefault();
  const editId = document.getElementById("mOdoId").value;
  const kmVal = parseFloat(document.getElementById("mOdoInput").value);
  const dateVal = document.getElementById("mOdoDate").value;
  const dashCons = parseFloat(document.getElementById("mOdoDashboardL100").value) || null;
  const pctInput = document.getElementById("mOdoFuelPercent").value;
  const fuelPercentVal = pctInput !== "" ? parseFloat(pctInput) : null;
  const isBridge = document.getElementById("mOdoIsBridge").checked;
  const isRouteStart = document.getElementById("mOdoIsRouteStart").checked;
  const rName = document.getElementById("mOdoRouteName").value.trim() || "Güzergah";
  const noteVal = document.getElementById("mOdoNote").value.trim() || (isBridge ? "Ay Sonu Köprü KM" : "Manuel KM");

  const check = validateTimelineOdo(dateVal, kmVal, editId);
  if (!check.isValid) {
    if (!confirm(`${check.msg}\nYine de kaydetmek istiyor musunuz?`)) return;
  }

  if (kmVal > 0) {
    if (editId) {
      const idx = odoLogs.findIndex(o => String(o.id) === String(editId));
      if (idx > -1) odoLogs[idx] = { ...odoLogs[idx], date: dateVal, km: kmVal, dashboardL100: dashCons, fuelPercent: fuelPercentVal, isBridge, note: noteVal };
    } else {
      odoLogs.push({ id: "odo_" + Date.now(), type: "odo_only", date: dateVal, km: kmVal, dashboardL100: dashCons, fuelPercent: fuelPercentVal, isBridge, note: noteVal });
    }

    if (isRouteStart) {
      activeRoute = {
        name: rName,
        startKm: kmVal,
        startDash: dashCons || 6.5,
        startDate: dateVal
      };
    }

    persistAllData();
    closeModal("odoModal");
    populateYearSelector();
    renderAll();
  }
}

function deleteOdoLog(id) {
  if (confirm("Bu kilometre kaydı silinsin mi?")) {
    odoLogs = odoLogs.filter(o => String(o.id) !== String(id));
    persistAllData();
    populateYearSelector();
    renderAll();
  }
}

function openFuelModal() {
  document.getElementById("fuelForm").reset();
  document.getElementById("fId").value = "";
  document.getElementById("fDocId").value = "";
  document.getElementById("fDocPreviewBox").classList.add("hidden");
  document.getElementById("fDate").value = getNowLocalISO();
  const lk = getLatestVehicleKm();
  if (lk > 0) document.getElementById("fKm").value = lk;
  document.getElementById("fuelModalTitle").innerText = "⛽ Yeni Yakıt Alımı";
  document.getElementById("fuelAnomalyWarning").classList.add("hidden");
  document.getElementById("fuelIntervalBadge").classList.add("hidden");
  document.getElementById("fIsFullCheckbox").checked = true;

  populatePaymentSelects();
  updateLpgVisibilityInApp();
  if (lk > 0) checkFuelIntervalLive(lk);
  openModalDirectly("fuelModal");
}

async function editFuel(id) {
  const f = fuels.find(x => String(x.id) === String(id));
  if (!f) return;
  populatePaymentSelects();
  document.getElementById("fId").value = f.id;
  document.getElementById("fDate").value = f.date;
  document.getElementById("fKm").value = f.km;
  document.getElementById("fStation").value = f.station;
  document.getElementById("fFuelType").value = f.fuelType || "Benzin/Dizel";
  document.getElementById("fBranch").value = f.branch || "";
  document.getElementById("fLiters").value = f.liters;
  document.getElementById("fTotal").value = f.total;
  document.getElementById("fDashboardL100").value = f.dashL100 || "";
  document.getElementById("fPaymentMethod").value = f.paymentMethod || customPaymentMethods[0];
  document.getElementById("fIsFullCheckbox").checked = f.isFull !== undefined ? f.isFull : (f.fillLevel === 'full');

  document.getElementById("fDocId").value = f.docId || "";
  if (f.docId) {
    const uri = await getDocFromDB(f.docId);
    if (uri && !uri.startsWith("data:application/pdf")) {
      document.getElementById("fDocThumbnail").src = uri;
      document.getElementById("fDocThumbnail").classList.remove("hidden");
    }
    document.getElementById("fDocPreviewBox").classList.remove("hidden");
  } else {
    document.getElementById("fDocPreviewBox").classList.add("hidden");
  }

  document.getElementById("fuelModalTitle").innerText = "Yakıtı Düzenle";
  document.getElementById("fuelAnomalyWarning").classList.add("hidden");
  checkFuelIntervalLive(f.km);
  updateLpgVisibilityInApp();
  openModalDirectly("fuelModal");
}

function saveFuel(e) {
  e.preventDefault();
  const id = document.getElementById("fId").value || ("fuel_" + Date.now());
  const kmVal = parseFloat(document.getElementById("fKm").value);
  const dateVal = document.getElementById("fDate").value;

  const check = validateTimelineOdo(dateVal, kmVal, document.getElementById("fId").value);
  if (!check.isValid) {
    if (!confirm(`${check.msg}\nYine de kaydetmek istiyor musunuz?`)) return;
  }

  const isFullVal = document.getElementById("fIsFullCheckbox").checked;

  const r = {
    id,
    date: dateVal,
    km: kmVal,
    station: document.getElementById("fStation").value,
    fuelType: carProfile.hasLpg ? document.getElementById("fFuelType").value : "Benzin/Dizel",
    branch: document.getElementById("fBranch").value.trim(),
    liters: parseFloat(document.getElementById("fLiters").value),
    total: parseFloat(document.getElementById("fTotal").value),
    dashL100: document.getElementById("fDashboardL100").value ? parseFloat(document.getElementById("fDashboardL100").value) : null,
    paymentMethod: document.getElementById("fPaymentMethod").value,
    isFull: isFullVal,
    fillLevel: isFullVal ? 'full' : 'quarter',
    docId: document.getElementById("fDocId").value || null
  };

  const idx = fuels.findIndex(x => String(x.id) === String(id));
  if (idx > -1) fuels[idx] = r;
  else fuels.push(r);

  persistAllData();
  closeModal("fuelModal");
  populateYearSelector();
  renderAll();
}

function deleteFuel(id) {
  if (confirm("Bu yakıt kaydını silmek istiyor musunuz?")) {
    fuels = fuels.filter(x => String(x.id) !== String(id));
    persistAllData();
    populateYearSelector();
    renderAll();
  }
}

let activeFuelViewFilter = "all";
function setFuelViewFilter(mode) {
  activeFuelViewFilter = mode;
  ["all", "fuel", "odo"].forEach(m => {
    const btn = document.getElementById("fuelViewFilter_" + m);
    if (btn) btn.className = m === mode ? "flex-1 py-1.5 rounded-xl bg-blue-600 text-white shadow font-black transition-all" : "flex-1 py-1.5 rounded-xl custom-card border custom-muted hover:text-white font-bold transition-all";
  });
  renderFuelCards(getFilteredCombinedLogs());
}

function getFilteredCombinedLogs() {
  let combined = [];
  const calcF = calculateFuelMetrics(fuels);
  if (activeFuelViewFilter === "all" || activeFuelViewFilter === "fuel") {
    calcF.forEach(f => { if (selectedYear === "all" || (f.date && f.date.startsWith(selectedYear))) combined.push({ ...f, isOdoOnly: false }); });
  }
  if (activeFuelViewFilter === "all" || activeFuelViewFilter === "odo") {
    odoLogs.forEach(o => { if (selectedYear === "all" || (o.date && o.date.startsWith(selectedYear))) combined.push({ ...o, isOdoOnly: true }); });
  }
  return combined.sort((a, b) => new Date(b.date) - new Date(a.date) || b.km - a.km);
}

let expandedCards = new Set();
function toggleCardExpansion(id) {
  if (expandedCards.has(id)) expandedCards.delete(id);
  else expandedCards.add(id);
  renderFuelCards(getFilteredCombinedLogs());
}

function clearFuelSearch() {
  const input = document.getElementById("fuelSearchInput");
  if (input) {
    input.value = "";
    renderFuelCards(getFilteredCombinedLogs());
    document.getElementById("fuelClearBtn").classList.add("hidden");
  }
}

function renderFuelCards(combinedList) {
  const container = document.getElementById("fuelCardsList");
  container.innerHTML = "";
  const query = (document.getElementById("fuelSearchInput")?.value || "").toLowerCase();
  document.getElementById("fuelClearBtn").classList.toggle("hidden", !query);

  const filtered = combinedList.filter(item => {
    if (item.isOdoOnly) return (item.note && item.note.toLowerCase().includes(query)) || item.date.includes(query) || item.km.toString().includes(query);
    else return (item.station && item.station.toLowerCase().includes(query)) || (item.branch && item.branch.toLowerCase().includes(query)) || (item.paymentMethod && item.paymentMethod.toLowerCase().includes(query)) || item.date.includes(query) || item.km.toString().includes(query);
  });

  if (filtered.length === 0) return container.innerHTML = `<div class="p-6 text-center custom-muted text-xs font-semibold">Kayıtlı veri bulunmuyor.</div>`;

  const sortedFuelsOnly = fuels.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  let fuelDistMap = {};
  for (let i = 0; i < sortedFuelsOnly.length; i++) {
    let curr = sortedFuelsOnly[i];
    if (i > 0) {
      let prev = sortedFuelsOnly[i-1];
      let d = curr.km - prev.km;
      let days = Math.max(0, Math.round((new Date(curr.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24)));
      if (d > 0) {
        fuelDistMap[curr.id] = { dist: d, days: days, costPerKm: (curr.total / d).toFixed(2) };
      }
    }
  }

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "custom-card p-3.5 shadow text-xs transition-all";
    const dateFormatted = formatDateTimeLabel(item.date);

    if (item.isOdoOnly) {
      let fuelTag = "";
      if (item.fuelPercent !== null && item.fuelPercent !== undefined) {
        fuelTag = `<span class="theme-badge-green font-bold px-1.5 py-0.5 rounded text-[9px]">⛽ %${item.fuelPercent}</span>`;
      }
      let dashTag = item.dashboardL100 ? `<span class="theme-badge-amber font-bold px-1.5 py-0.5 rounded text-[9px]">Ort: ${item.dashboardL100} L</span>` : "";

      card.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="font-black text-xs text-indigo-600 dark:text-indigo-400">📍 ${item.km.toLocaleString('tr-TR')} km</span>
              <span class="theme-badge-blue font-bold px-2 py-0.5 rounded-md text-[9px]">KM Kaydı</span>
              ${fuelTag} ${dashTag}
              ${item.isBridge ? `<span class="theme-badge-cyan font-black px-1.5 py-0.5 rounded text-[9px]">🌉 Köprü</span>` : ''}
            </div>
            <div class="custom-muted text-[10px] font-semibold">${dateFormatted} • ${item.note}</div>
          </div>
          <div class="flex gap-3 font-bold text-[11px]">
            <button onclick="openOdoModal('${item.id}')" class="text-blue-600 dark:text-blue-400 hover:underline">Düzenle</button>
            <button onclick="deleteOdoLog('${item.id}')" class="text-rose-500 hover:underline">Sil</button>
          </div>
        </div>`;
    } else {
      const isExp = expandedCards.has(item.id);
      const meta = fuelDistMap[item.id];
      const unitPrice = (item.total / item.liters).toFixed(2);
      const isFull = item.isFull !== undefined ? item.isFull : (item.fillLevel === 'full');
      
      let fillBadge = isFull 
        ? `<span class="theme-badge-green font-black px-2 py-0.5 rounded text-[10px]">Tam Depo</span>`
        : `<span class="theme-badge-amber font-black px-2 py-0.5 rounded text-[10px]">Ara Dolum</span>`;

      let compBadge = "";
      if (item.consumption && isFull) {
        compBadge = `<span class="theme-badge-cyan font-black px-2 py-0.5 rounded-md text-[10px] ml-1">Gerçek: ${item.consumption} L/100km</span>`;
      }

      let diffDisplay = "";
      if (item.consumption && item.dashL100 && isFull) {
        const diff = (parseFloat(item.consumption) - item.dashL100).toFixed(2);
        diffDisplay = `<div class="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1">📊 Pompa: ${item.consumption} L • Gösterge: ${item.dashL100} L (Fark: ${diff > 0 ? '+' : ''}${diff} L)</div>`;
      }

      card.innerHTML = `
        <div onclick="toggleCardExpansion('${item.id}')" class="cursor-pointer">
          <div class="flex justify-between items-center">
            <div>
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                <span class="font-black text-xs">${item.km.toLocaleString('tr-TR')} km</span>
                <span class="theme-badge-blue font-bold px-2 py-0.5 rounded-md text-[10px]">${item.station}</span>
                <span class="theme-badge-purple font-bold px-2 py-0.5 rounded-md text-[10px]">${item.paymentMethod || 'Nakit'}</span>
                ${fillBadge} ${compBadge}
              </div>
              <div class="custom-muted text-[10px] font-semibold">${dateFormatted} • ${item.liters} L • ${unitPrice} ₺/L</div>
              ${diffDisplay}
            </div>
            <div class="text-right">
              <span class="font-black text-sm">₺${parseFloat(item.total).toLocaleString('tr-TR')}</span>
              <div class="text-[10px] custom-muted mt-1 font-bold">${isExp ? '▲ Kapat' : '▼ Detay'}</div>
            </div>
          </div>
        </div>

        ${isExp ? `
          <div class="pt-2.5 mt-2.5 border-t border-slate-700/40 space-y-2.5">
            <div class="grid grid-cols-2 gap-2 text-[10px] p-2.5 theme-sub-box rounded-xl">
              <div>
                <span class="custom-muted block text-[9px] font-bold">Önceki Yakıttan Yol</span>
                <span class="font-black text-blue-600 dark:text-blue-400">${meta ? '+' + meta.dist.toLocaleString('tr-TR') + ' km (' + meta.days + ' gün)' : 'İlk dolum'}</span>
              </div>
              <div>
                <span class="custom-muted block text-[9px] font-bold">Birim Maliyet</span>
                <span class="font-black text-emerald-600 dark:text-emerald-400">${meta ? meta.costPerKm + ' ₺/km' : '--'}</span>
              </div>
              <div>
                <span class="custom-muted block text-[9px] font-bold">Şube / Ödeme</span>
                <span class="font-black truncate block">${item.branch || 'Merkez'} • ${item.paymentMethod || 'Nakit'}</span>
              </div>
              <div>
                <span class="custom-muted block text-[9px] font-bold">Litre Fiyatı</span>
                <span class="font-black text-cyan-600 dark:text-cyan-400">${unitPrice} ₺/L</span>
              </div>
            </div>
            <div class="flex justify-between items-center pt-1">
              ${item.docId ? `<button onclick="viewDocumentById('${item.docId}')" class="text-cyan-600 dark:text-cyan-400 font-black text-[11px] flex items-center gap-1"><span>📄</span> Fişi Görüntüle</button>` : '<span></span>'}
              <div class="flex gap-3 font-bold text-[11px]">
                <button onclick="editFuel('${item.id}')" class="text-blue-600 dark:text-blue-400 hover:underline">Düzenle</button>
                <button onclick="deleteFuel('${item.id}')" class="text-rose-500 hover:underline">Sil</button>
              </div>
            </div>
          </div>
        ` : ''}
      `;
    }
    container.appendChild(card);
  });
}
