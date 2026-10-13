// --- ODO.JS: KİLOMETRE, AKILLI DEPO HESABI VE ROTA YÖNETİMİ ---

function validateTimelineOdo(targetDateStr, targetKm, excludeId = null) {
  if (!targetDateStr || isNaN(targetKm) || targetKm <= 0) return { isValid: true };
  const allEvents = [];
  const exStr = excludeId ? String(excludeId) : null;
  window.fuels.forEach(f => { if (String(f.id) !== exStr) allEvents.push({ date: f.date, km: f.km }); });
  window.odoLogs.forEach(o => { if (String(o.id) !== exStr) allEvents.push({ date: o.date, km: o.km }); });
  if (window.expenses) window.expenses.forEach(e => { if (e.maintenanceKm && String(e.id) !== exStr) allEvents.push({ date: e.date, km: e.maintenanceKm }); });
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
    warnEl.style.display = "block";
  } else {
    warnEl.classList.add("hidden");
    warnEl.style.display = "none";
  }
}

function calculateTripFromOdo() {
  const odoVal = parseFloat(document.getElementById("mOdoInput").value);
  const sFuels = window.fuels.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFuel = sFuels[sFuels.length - 1];
  if (lastFuel && odoVal >= lastFuel.km) {
    document.getElementById("mOdoTripInput").value = (odoVal - lastFuel.km).toFixed(1);
  }
}

function calculateOdoFromTrip() {
  const tripVal = parseFloat(document.getElementById("mOdoTripInput").value);
  const sFuels = window.fuels.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFuel = sFuels[sFuels.length - 1];
  if (lastFuel && !isNaN(tripVal) && tripVal >= 0) {
    document.getElementById("mOdoInput").value = Math.round(lastFuel.km + tripVal);
    checkOdoAnomalyLive();
    triggerAutoTankCalculation();
  }
}

function syncLitersFromPercent(pctVal) {
  const litInput = document.getElementById("mOdoFuelLiters");
  const tankCapacity = window.carProfile.fuelTank || 50;
  if (pctVal === "" || isNaN(pctVal)) { litInput.value = ""; return; }
  litInput.value = ((Math.max(0, Math.min(100, parseFloat(pctVal))) / 100) * tankCapacity).toFixed(1);
}

function syncPercentFromLiters(litVal) {
  const pctInput = document.getElementById("mOdoFuelPercent");
  const tankCapacity = window.carProfile.fuelTank || 50;
  if (litVal === "" || isNaN(litVal)) { pctInput.value = ""; return; }
  pctInput.value = Math.round((Math.max(0, Math.min(tankCapacity, parseFloat(litVal))) / tankCapacity) * 100);
}

let userEditedTankManually = false;
function triggerAutoTankCalculation() {
  if (userEditedTankManually) return;
  const targetKm = parseFloat(document.getElementById("mOdoInput").value);
  const targetDate = document.getElementById("mOdoDate").value || getNowLocalISO();
  const enteredDash = parseFloat(document.getElementById("mOdoDashboardL100").value);
  const tankCapacity = window.carProfile.fuelTank || 50;
  const badge = document.getElementById("odoAutoCalcBadge");

  if (isNaN(targetKm) || targetKm <= 0) return;

  const sFuels = window.fuels.filter(f => f.date <= targetDate).sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFullFuel = sFuels.slice().reverse().find(f => (f.isFull !== undefined ? f.isFull : f.fillLevel === 'full'));
  if (!lastFullFuel || targetKm < lastFullFuel.km) return;

  let effectiveCons = enteredDash;
  if (!effectiveCons || isNaN(effectiveCons) || effectiveCons <= 0) {
    const sortedOdos = window.odoLogs.filter(o => o.dashboardL100 > 0 && o.date <= targetDate).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sortedOdos.length > 0) effectiveCons = sortedOdos[sortedOdos.length - 1].dashboardL100;
    else effectiveCons = 6.5;
  }

  // Kronolojik zincir akıllı depo hesabı
  const timelineEvents = [];
  sFuels.filter(f => new Date(f.date) > new Date(lastFullFuel.date) && !(f.isFull !== undefined ? f.isFull : f.fillLevel === 'full'))
    .forEach(f => timelineEvents.push({ date: f.date, km: f.km, type: 'fuel', liters: parseFloat(f.liters) || 0 }));

  timelineEvents.push({ date: targetDate, km: targetKm, type: 'target', liters: 0 });
  timelineEvents.sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);

  let currentTankLevel = tankCapacity;
  let lastEventKm = lastFullFuel.km;

  for (let ev of timelineEvents) {
    if (ev.km > lastEventKm) {
      let dist = ev.km - lastEventKm;
      let burned = (dist * effectiveCons) / 100;
      currentTankLevel = Math.max(0, currentTankLevel - burned);
      lastEventKm = ev.km;
    }
    if (ev.type === 'fuel') {
      currentTankLevel = Math.min(tankCapacity, currentTankLevel + ev.liters);
    }
  }

  const calculatedRemaining = Math.max(0, Math.min(tankCapacity, currentTankLevel));
  const calculatedPercent = Math.max(0, Math.min(100, Math.round((calculatedRemaining / tankCapacity) * 100)));

  const litField = document.getElementById("mOdoFuelLiters");
  const pctField = document.getElementById("mOdoFuelPercent");
  if (litField) litField.value = calculatedRemaining.toFixed(1);
  if (pctField) pctField.value = calculatedPercent;

  if (badge) {
    badge.classList.remove("hidden");
    badge.style.display = "inline-block";
  }
}

function toggleRouteNameInput() {
  const wrapper = document.getElementById("routeNameWrapper");
  const chk = document.getElementById("mOdoIsRouteStart");
  if (wrapper && chk) wrapper.classList.toggle("hidden", !chk.checked);
}

// 3. MADDE: KM MODALINI AÇMA / DÜZENLEME
function openOdoModal(editId = null) {
  userEditedTankManually = false;
  const tankCapacity = window.carProfile.fuelTank || 50;
  const autoBadge = document.getElementById("odoAutoCalcBadge");
  if (autoBadge) autoBadge.classList.add("hidden");

  if (editId) {
    const item = window.odoLogs.find(o => String(o.id) === String(editId));
    if (!item) return;
    userEditedTankManually = true;
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

    setTimeout(() => triggerAutoTankCalculation(), 50);
  }
  calculateTripFromOdo();
  document.getElementById("odoAnomalyWarning").classList.add("hidden");
  openModalDirectly("odoModal");
}

function saveManualOdo(e) {
  e.preventDefault();
  try {
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

    if (isNaN(kmVal) || kmVal <= 0) return alert("Lütfen geçerli bir kilometre değeri girin.");
    const check = validateTimelineOdo(dateVal, kmVal, editId);
    if (!check.isValid) {
      if (!confirm(`${check.msg}\nYine de kaydetmek istiyor musunuz?`)) return;
    }

    if (editId) {
      const idx = window.odoLogs.findIndex(o => String(o.id) === String(editId));
      if (idx > -1) {
        window.odoLogs[idx] = {
          ...window.odoLogs[idx],
          date: dateVal,
          km: kmVal,
          dashboardL100: dashCons,
          fuelPercent: fuelPercentVal,
          isBridge,
          note: noteVal
        };
      }
    } else {
      window.odoLogs.push({
        id: "odo_" + Date.now(),
        type: "odo_only",
        date: dateVal,
        km: kmVal,
        dashboardL100: dashCons,
        fuelPercent: fuelPercentVal,
        isBridge,
        note: noteVal
      });
    }

    if (isRouteStart) {
      window.activeRoute = {
        name: rName,
        startKm: kmVal,
        startDash: dashCons !== null ? dashCons : 6.5,
        startDate: dateVal,
        accumulatedKm: 0,
        accumulatedLit: 0
      };
    }

    persistAllData();
    if (typeof syncSelectedYearWithDate === 'function') {
      syncSelectedYearWithDate(dateVal);
    }
    closeModal("odoModal");
    populateYearSelector();
    renderAll();
    alert("KM kaydı başarıyla kaydedildi!");
  } catch (err) {
    alert("Kaydetme sırasında bir hata oluştu: " + err.message);
  }
}

function deleteOdoLog(id) {
  if (confirm("Bu kilometre kaydı silinsin mi?")) {
    window.odoLogs = window.odoLogs.filter(o => String(o.id) !== String(id));
    persistAllData();
    populateYearSelector();
    renderAll();
  }
}

// --- ROTA TAKİP VE RAPORLAMA ---
function updateActiveRouteBanner() {
  const banner = document.getElementById("activeRouteBanner");
  if (!window.activeRoute) {
    banner.classList.add("hidden");
    banner.style.display = "none";
    return;
  }
  const liveKm = getLatestVehicleKm();
  const sortedOdos = window.odoLogs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const latestOdo = sortedOdos[sortedOdos.length - 1];
  const curDash = latestOdo && latestOdo.dashboardL100 ? latestOdo.dashboardL100 : window.activeRoute.startDash;
  const dKm = Math.max(0, liveKm - window.activeRoute.startKm);
  let pureConsStr = "--";
  if (dKm > 0 && curDash > 0) {
    const netLit = ((liveKm * curDash) / 100) - ((window.activeRoute.startKm * window.activeRoute.startDash) / 100);
    if (netLit >= 0) pureConsStr = ((netLit / dKm) * 100).toFixed(2);
  }
  document.getElementById("arName").innerText = window.activeRoute.name;
  document.getElementById("arDetails").innerText = `Mesafe: +${dKm.toLocaleString('tr-TR')} km • Saf Ort: ${pureConsStr} L/100km`;
  banner.classList.remove("hidden");
  banner.style.display = "block";
}

function finishRoutePrompt() {
  if (!window.activeRoute) return;

  const actionChoice = confirm(
    `🧭 AKTİF ROTA: "${window.activeRoute.name}"\n\n` +
    `• Rotayı hesaplayıp TAMAMLAMAK için [TAMAM] butonuna basın.\n` +
    `• Rotayı hesaplamadan İPTAL ETMEK için [İPTAL] butonuna basın.`
  );

  if (!actionChoice) {
    if (confirm(`"${window.activeRoute.name}" rotasını iptal etmek ve silmek istediğinize emin misiniz?`)) {
      window.activeRoute = null;
      persistAllData();
      renderAll();
      alert("❌ Rota iptal edildi.");
    }
    return;
  }

  const tripTotalStr = prompt(
    `"${window.activeRoute.name}" rotasını tamamlamak için:\n\nSon full depodan (dful) bu yana yapılan TOPLAM Trip KM'yi girin:`,
    ""
  );
  if (tripTotalStr === null || tripTotalStr.trim() === "") return;

  const dashAvgStr = prompt(
    "Yol bilgisayarında görünen güncel ortalama tüketimi girin (L/100km):",
    window.activeRoute.startDash !== undefined ? window.activeRoute.startDash : ""
  );
  if (dashAvgStr === null || dashAvgStr.trim() === "") return;

  const kmTotal = parseFloat(tripTotalStr);
  const ortTotal = parseFloat(dashAvgStr);
  const km1 = parseFloat(window.activeRoute.startKm) || 0;
  const ort1 = parseFloat(window.activeRoute.startDash) || 0;

  if (isNaN(kmTotal) || kmTotal < km1) {
    return alert(`Hata: Girilen toplam KM (${kmTotal}), rota başındaki sayaçtan (${km1} km) küçük olamaz.`);
  }

  const kmCurrentStage = kmTotal - km1;
  const lit1 = (km1 * ort1) / 100;
  const litTotal = (kmTotal * ortTotal) / 100;
  const litCurrentStage = Math.max(0, litTotal - lit1);

  const previousLit = parseFloat(window.activeRoute.accumulatedLit) || 0;
  const previousKm = parseFloat(window.activeRoute.accumulatedKm) || 0;

  const totalRouteKm = previousKm + kmCurrentStage;
  const totalRouteLit = previousLit + litCurrentStage;

  if (totalRouteKm <= 0) {
    return alert("Hata: Rotada katedilen net mesafe 0'dan büyük olmalıdır.");
  }

  const ortRota = ((totalRouteLit / totalRouteKm) * 100).toFixed(2);

  if (!Array.isArray(window.completedRoutes)) window.completedRoutes = [];
  window.completedRoutes.push({
    id: "route_" + Date.now(),
    name: window.activeRoute.name,
    date: getNowLocalISO(),
    distance: totalRouteKm,
    consumption: ortRota,
    liters: parseFloat(totalRouteLit.toFixed(2))
  });

  alert(
    `✅ ROTA BAŞARIYLA TAMAMLANDI VE KAYDEDİLDİ!\n` +
    `----------------------------------------\n` +
    `🧭 Rota: ${window.activeRoute.name}\n` +
    `🛣️ Net Mesafe: ${totalRouteKm.toLocaleString('tr-TR')} km\n` +
    `⛽ Saf Tüketim: ${ortRota} L/100km\n` +
    `💧 Harcanan: ${totalRouteLit.toFixed(2)} L`
  );

  window.activeRoute = null;
  persistAllData();
  renderAll();
}

function renderCompletedRoutes() {
  const card = document.getElementById("completedRoutesCard");
  const container = document.getElementById("completedRoutesList");
  const badge = document.getElementById("routeCountBadge");
  if (!card || !container) return;

  const routes = window.completedRoutes || [];
  if (routes.length === 0) {
    card.classList.add("hidden");
    card.style.display = "none";
    return;
  }

  card.classList.remove("hidden");
  card.style.display = "block";
  if (badge) badge.innerText = `${routes.length} Rota`;
  container.innerHTML = "";

  routes.slice().reverse().forEach(r => {
    container.innerHTML += `
      <div class="p-2.5 rounded-xl theme-sub-box flex justify-between items-center shadow-sm gap-2">
        <div class="flex-1 min-w-0">
          <div class="font-black text-cyan-600 dark:text-cyan-400 text-[11px] truncate">${r.name}</div>
          <div class="text-[10px] custom-muted font-semibold">
            ${formatDateTimeLabel(r.date)} • <b class="text-blue-500">${parseFloat(r.distance).toLocaleString('tr-TR')} km</b>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="font-black text-emerald-600 dark:text-emerald-400 text-xs">${r.consumption} L/100km</div>
          <div class="text-[9px] custom-muted font-bold">${r.liters} L yakıt</div>
        </div>
        <div class="flex items-center gap-1 pl-1 border-l border-slate-700/30 flex-shrink-0">
          <button type="button" onclick="editCompletedRoute('${r.id}')" title="Düzenle" class="p-1 hover:bg-slate-700/20 rounded text-xs leading-none">✏️</button>
          <button type="button" onclick="deleteCompletedRoute('${r.id}')" title="Sil" class="p-1 hover:bg-rose-500/20 rounded text-xs leading-none">🗑️</button>
        </div>
      </div>
    `;
  });
}

function deleteCompletedRoute(routeId) {
  const routes = window.completedRoutes || [];
  const target = routes.find(r => r.id === routeId);
  if (!target) return;

  if (confirm(`"${target.name}" rotasını silmek istediğinize emin misiniz?`)) {
    window.completedRoutes = routes.filter(r => r.id !== routeId);
    persistAllData();
    renderAll();
  }
}

function editCompletedRoute(routeId) {
  const routes = window.completedRoutes || [];
  const r = routes.find(item => item.id === routeId);
  if (!r) return;

  const newName = prompt("Rota Adı:", r.name);
  if (newName === null) return;

  const newDistStr = prompt("Net Mesafe (KM):", r.distance);
  if (newDistStr === null) return;

  const newConsStr = prompt("Saf Ortalama Tüketim (L/100km):", r.consumption);
  if (newConsStr === null) return;

  const d = parseFloat(newDistStr);
  const c = parseFloat(newConsStr);

  if (isNaN(d) || d <= 0 || isNaN(c) || c < 0) {
    return alert("Lütfen geçerli sayısal değerler girin.");
  }

  r.name = newName.trim() || r.name;
  r.distance = d;
  r.consumption = c.toFixed(2);
  r.liters = parseFloat(((d * c) / 100).toFixed(1));

  persistAllData();
  renderAll();
}
