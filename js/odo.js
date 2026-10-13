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
  const chk = document
