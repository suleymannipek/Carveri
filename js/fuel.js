// --- FUEL.JS: YAKIT İŞLEMLERİ, MENZİL HESABI VE FİLTRELEME ---

let activeFuelViewFilter = "all";

function updateLpgVisibilityInApp() {
  const wrapper = document.getElementById("fuelTypeWrapper");
  if (wrapper) {
    wrapper.classList.toggle("hidden", !(window.carProfile && window.carProfile.hasLpg));
  }
}

function checkFuelAnomalyLive() {
  const dEl = document.getElementById("fDate");
  const kmEl = document.getElementById("fKm");
  const editIdEl = document.getElementById("fId");
  const warnEl = document.getElementById("fuelAnomalyWarning");
  if (!dEl || !kmEl || !warnEl) return;
  if (typeof validateTimelineOdo !== 'function') return;

  const d = dEl.value;
  const km = parseFloat(kmEl.value);
  const editId = editIdEl ? editIdEl.value : "";

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

function checkFuelIntervalLive(val) {
  const km = parseFloat(val);
  const dateVal = document.getElementById("fDate")?.value || getNowLocalISO();
  const editId = document.getElementById("fId")?.value || "";
  const badge = document.getElementById("fuelIntervalBadge");
  const textEl = document.getElementById("fuelIntervalText");

  if (!badge || !textEl || isNaN(km) || km <= 0) {
    if (badge) {
      badge.classList.add("hidden");
      badge.style.display = "none";
    }
    return;
  }

  const prevFuels = (window.fuels || [])
    .filter(f => String(f.id) !== String(editId) && f.date <= dateVal)
    .sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const prev = prevFuels.pop();

  if (prev && km >= prev.km) {
    const distDiff = km - prev.km;
    const dayDiff = Math.max(0, Math.round((new Date(dateVal) - new Date(prev.date)) / (1000 * 60 * 60 * 24)));
    textEl.innerHTML = `Önceki yakıttan bu yana <b class="text-cyan-600 dark:text-cyan-400">+${distDiff.toLocaleString('tr-TR')} km</b> yol yapıldı <span class="custom-muted">(${dayDiff} gün önce)</span>`;
    badge.classList.remove("hidden");
    badge.style.display = "flex";
  } else {
    badge.classList.add("hidden");
    badge.style.display = "none";
  }
}

function calculateFuelMetrics(list) {
  if (!Array.isArray(list)) list = [];
  const s = list.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  let r = [], poolLiters = 0, lastFullIdx = -1;

  for (let i = 0; i < s.length; i++) {
    let f = { ...s[i], consumption: null, dashDiff: null };
    const isFull = f.isFull !== undefined ? f.isFull : (f.fillLevel === 'full');
    if (isFull) {
      if (lastFullIdx !== -1) {
        let d = f.km - s[lastFullIdx].km;
        if (d > 0) {
          f.consumption = (((poolLiters + f.liters) / d) * 100).toFixed(2);
          if (f.dashL100 !== null && f.dashL100 !== undefined && !isNaN(f.dashL100)) {
            f.dashDiff = (f.consumption - f.dashL100).toFixed(2);
          }
        }
      }
      poolLiters = 0;
      lastFullIdx = i;
    } else {
      if (lastFullIdx !== -1) {
        poolLiters += f.liters;
      }
    }
    r.push(f);
  }
  return r;
}

function updateRangeEstimate(avgConsFromHistory) {
  const banner = document.getElementById("fuelRangeBanner");
  const tankCapacity = (window.carProfile && window.carProfile.fuelTank) || 50;
  const liveKm = typeof getLatestVehicleKm === 'function' ? getLatestVehicleKm() : 0;
  const sFuels = (window.fuels || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  const lastFullFuel = sFuels.slice().reverse().find(f => (f.isFull !== undefined ? f.isFull : f.fillLevel === 'full'));
  const diffInfoEl = document.getElementById("lastFuelDiffInfo");

  if (lastFullFuel && liveKm >= lastFullFuel.km) {
    if (diffInfoEl) diffInfoEl.innerText = `+${(liveKm - lastFullFuel.km).toLocaleString('tr-TR')} km (${Math.max(0, Math.round((new Date() - new Date(lastFullFuel.date)) / 86400000))} gün)`;
  } else {
    if (diffInfoEl) diffInfoEl.innerText = "--";
  }

  const sortedOdosWithDash = (window.odoLogs || []).slice().filter(o => o.dashboardL100 > 0).sort((a, b) => new Date(a.date) - new Date(b.date));
  let effectiveCons = Number(sortedOdosWithDash.length ? sortedOdosWithDash[sortedOdosWithDash.length - 1].dashboardL100 : (avgConsFromHistory || 0));

  let remainingLiters = null;
  if (lastFullFuel) {
    const timelineEvents = [];
    sFuels.filter(f => new Date(f.date) > new Date(lastFullFuel.date) && !(f.isFull !== undefined ? f.isFull : f.fillLevel === 'full'))
      .forEach(f => timelineEvents.push({ date: f.date, km: f.km, type: 'fuel', liters: parseFloat(f.liters) || 0 }));

    timelineEvents.push({ date: getNowLocalISO(), km: liveKm, type: 'target', liters: 0 });
    timelineEvents.sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);

    let curTank = tankCapacity;
    let lastKm = lastFullFuel.km;

    for (let ev of timelineEvents) {
      if (ev.km > lastKm && effectiveCons > 0) {
        let dist = ev.km - lastKm;
        let burned = (dist * effectiveCons) / 100;
        curTank = Math.max(0, curTank - burned);
        lastKm = ev.km;
      }
      if (ev.type === 'fuel') {
        curTank = Math.min(tankCapacity, curTank + ev.liters);
      }
    }
    remainingLiters = Math.max(0, Math.min(tankCapacity, curTank));
  }

  const barsDisplay = document.getElementById("fuelBarsDisplay");
  if (barsDisplay) {
    if (remainingLiters !== null) barsDisplay.innerText = `%${Math.min(100, Math.round((remainingLiters / tankCapacity) * 100))} (~${remainingLiters.toFixed(1)} L)`;
    else barsDisplay.innerText = "--";
  }

  const rangeTextEl = document.getElementById("fuelRangeText");
  const rangeRemainEl = document.getElementById("fuelRangeRemaining");

  if (effectiveCons > 0 && remainingLiters !== null) {
    if (rangeTextEl) rangeTextEl.innerText = `Tam Depo ile: ~${Math.round((tankCapacity / effectiveCons) * 100).toLocaleString('tr-TR')} km (${effectiveCons.toFixed(2)} L/100km)`;
    if (rangeRemainEl) rangeRemainEl.innerText = `Kalan Tahmin: ~${Math.round((remainingLiters / effectiveCons) * 100).toLocaleString('tr-TR')} km`;
    if (banner) {
      banner.classList.remove("hidden");
      banner.style.display = "block";
    }
  } else {
    if (rangeTextEl) rangeTextEl.innerText = `Depo Hacmi: ${tankCapacity} L`;
    if (rangeRemainEl) rangeRemainEl.innerText = "Tüketim bekleniyor";
  }

  const costEstEl = document.getElementById("fullTankCostEstimate");
  if (costEstEl) {
    if (remainingLiters !== null && window.liveFuelData && window.liveFuelData.fiyatlar) {
      const missingLiters = Math.max(0, tankCapacity - remainingLiters);
      const fType = (window.carProfile && window.carProfile.fuelType) || "benzin";
      const rawPrice = window.liveFuelData.fiyatlar[fType] || "0";
      const unitPrice = parseFloat(String(rawPrice).replace(",", ".")) || 0;
      const totalCost = missingLiters * unitPrice;
      costEstEl.innerHTML = `~₺${Math.round(totalCost).toLocaleString('tr-TR')} <span class="custom-muted font-normal">(Eksik: ~${missingLiters.toFixed(1)} L)</span>`;
    } else {
      costEstEl.innerText = "--";
    }
  }
}

function openFuelModal() {
  document.getElementById("fuelForm")?.reset();
  const fId = document.getElementById("fId");
  if (fId) fId.value = "";
  const fDocId = document.getElementById("fDocId");
  if (fDocId) fDocId.value = "";
  const prevBox = document.getElementById("fDocPreviewBox");
  if (prevBox) prevBox.classList.add("hidden");
  
  const fDate = document.getElementById("fDate");
  if (fDate) fDate.value = getNowLocalISO();

  const lk = typeof getLatestVehicleKm === 'function' ? getLatestVehicleKm() : 0;
  const fKm = document.getElementById("fKm");
  if (lk > 0 && fKm) fKm.value = lk;

  const title = document.getElementById("fuelModalTitle");
  if (title) title.innerText = "⛽ Yeni Yakıt Alımı";

  document.getElementById("fuelAnomalyWarning")?.classList.add("hidden");
  document.getElementById("fuelIntervalBadge")?.classList.add("hidden");
  
  const isFull = document.getElementById("fIsFullCheckbox");
  if (isFull) isFull.checked = true;
  
  const startRoute = document.getElementById("fuelStartRoute");
  if (startRoute) startRoute.checked = false;

  document.getElementById("fuelRouteNameBox")?.classList.add("hidden");
  const rName = document.getElementById("fuelRouteName");
  if (rName) rName.value = "";

  if (typeof populatePaymentSelects === 'function') populatePaymentSelects();
  updateLpgVisibilityInApp();
  if (lk > 0) checkFuelIntervalLive(lk);
  openModalDirectly("fuelModal");
}

async function editFuel(id) {
  const f = (window.fuels || []).find(x => String(x.id) === String(id));
  if (!f) return;

  if (typeof populatePaymentSelects === 'function') populatePaymentSelects();
  document.getElementById("fId").value = f.id;
  document.getElementById("fDate").value = f.date;
  document.getElementById("fKm").value = f.km;
  document.getElementById("fStation").value = f.station;
  document.getElementById("fFuelType").value = f.fuelType || "Benzin/Dizel";
  document.getElementById("fBranch").value = f.branch || "";
  document.getElementById("fLiters").value = f.liters;
  document.getElementById("fTotal").value = f.total;
  document.getElementById("fDashboardL100").value = f.dashL100 || "";
  document.getElementById("fPaymentMethod").value = f.paymentMethod || (window.customPaymentMethods ? window.customPaymentMethods[0] : 'Nakit');
  document.getElementById("fIsFullCheckbox").checked = f.isFull !== undefined ? f.isFull : (f.fillLevel === 'full');
  document.getElementById("fuelStartRoute").checked = false;
  document.getElementById("fuelRouteNameBox")?.classList.add("hidden");
  document.getElementById("fDocId").value = f.docId || "";

  if (f.docId && typeof getDocFromDB === 'function') {
    const uri = await getDocFromDB(f.docId);
    if (uri && !uri.startsWith("data:application/pdf")) {
      const thumb = document.getElementById("fDocThumbnail");
      if (thumb) {
        thumb.src = uri;
        thumb.classList.remove("hidden");
      }
    }
    const prevBox = document.getElementById("fDocPreviewBox");
    if (prevBox) {
      prevBox.classList.remove("hidden");
      prevBox.style.display = "flex";
    }
  } else {
    document.getElementById("fDocPreviewBox")?.classList.add("hidden");
  }

  document.getElementById("fuelModalTitle").innerText = "Yakıtı Düzenle";
  document.getElementById("fuelAnomalyWarning")?.classList.add("hidden");
  checkFuelIntervalLive(f.km);
  updateLpgVisibilityInApp();
  openModalDirectly("fuelModal");
}

function saveFuel(e) {
  e.preventDefault();
  try {
    const id = document.getElementById("fId").value || ("fuel_" + Date.now());
    const kmVal = parseFloat(document.getElementById("fKm").value);
    const dateVal = document.getElementById("fDate").value;

    if (typeof validateTimelineOdo === 'function') {
      const check = validateTimelineOdo(dateVal, kmVal, id);
      if (!check.isValid) {
        if (!confirm(`${check.msg}\nYine de kaydetmek istiyor musunuz?`)) return;
      }
    }

    const isFullVal = document.getElementById("fIsFullCheckbox").checked;
    const dashL100Val = document.getElementById("fDashboardL100").value ? parseFloat(document.getElementById("fDashboardL100").value) : null;

    const r = {
      id,
      date: dateVal,
      km: kmVal,
      station: document.getElementById("fStation").value,
      fuelType: (window.carProfile && window.carProfile.hasLpg) ? document.getElementById("fFuelType").value : "Benzin/Dizel",
      branch: document.getElementById("fBranch").value.trim(),
      liters: parseFloat(document.getElementById("fLiters").value),
      total: parseFloat(document.getElementById("fTotal").value),
      dashL100: dashL100Val,
      paymentMethod: document.getElementById("fPaymentMethod").value,
      isFull: isFullVal,
      fillLevel: isFullVal ? 'full' : 'quarter',
      docId: document.getElementById("fDocId").value || null
    };

    if (!Array.isArray(window.fuels)) window.fuels = [];
    const idx = window.fuels.findIndex(x => String(x.id) === String(id));
    if (idx > -1) window.fuels[idx] = r;
    else window.fuels.push(r);

    if (window.activeRoute && isFullVal) {
      const resetConfirm = confirm(
        "🧭 Dikkat: Aktif bir rotadasınız (" + window.activeRoute.name + ").\n\n" +
        "Bu full yakıt alımında yol bilgisayarı / Trip sayacınızı SIFIRLADINIZ MI?"
      );
      if (resetConfirm) {
        const stageTripStr = prompt("Sıfırlamadan önce ekranda yazan Trip KM:", "");
        const stageAvgStr = prompt("Sıfırlamadan önce ekranda yazan ortalama tüketim (L/100km):", "");

        const sTrip = parseFloat(stageTripStr) || 0;
        const sAvg = parseFloat(stageAvgStr) || 0;
        const km1 = parseFloat(window.activeRoute.startKm) || 0;
        const ort1 = parseFloat(window.activeRoute.startDash) || 0;

        const stageKm = Math.max(0, sTrip - km1);
        const lit1 = (km1 * ort1) / 100;
        const litTotal = (sTrip * sAvg) / 100;
        const stageLit = Math.max(0, litTotal - lit1);

        window.activeRoute.accumulatedKm = (parseFloat(window.activeRoute.accumulatedKm) || 0) + stageKm;
        window.activeRoute.accumulatedLit = (parseFloat(window.activeRoute.accumulatedLit) || 0) + stageLit;
        window.activeRoute.startKm = 0;
        window.activeRoute.startDash = 0;

        alert("✅ 1. Etap (" + stageKm + " km / " + stageLit.toFixed(1) + " L) rotaya eklendi. Yeni sayaç sıfırdan devam ediyor.");
      }
    }

    const shouldStartRoute = document.getElementById("fuelStartRoute") && document.getElementById("fuelStartRoute").checked;
    if (shouldStartRoute) {
      const rNameInput = (document.getElementById("fuelRouteName")?.value || "").trim();
      const finalRouteName = rNameInput || "Yakıt Rotası";
      window.activeRoute = {
        name: finalRouteName,
        startDate: dateVal,
        startKm: isFullVal ? 0 : kmVal,
        startDash: isFullVal ? 0 : (dashL100Val || 0),
        accumulatedKm: 0,
        accumulatedLit: 0
      };
    }

    if (typeof persistAllData === 'function') persistAllData();
    if (typeof syncSelectedYearWithDate === 'function') syncSelectedYearWithDate(dateVal);
    closeModal("fuelModal");
    if (typeof populateYearSelector === 'function') populateYearSelector();
    if (typeof renderAll === 'function') renderAll();
  } catch (err) {
    alert(err.message);
  }
}

function deleteFuel(id) {
  if (confirm("Bu yakıt kaydını silmek istiyor musunuz?")) {
    window.fuels = (window.fuels || []).filter(x => String(x.id) !== String(id));
    if (typeof persistAllData === 'function') persistAllData();
    if (typeof populateYearSelector === 'function') populateYearSelector();
    if (typeof renderAll === 'function') renderAll();
  }
}

// --- FİLTRELEME VE LİSTE SÜZGEÇLERİ ---
function setFuelViewFilter(mode) {
  activeFuelViewFilter = mode;
  ["all", "fuel", "odo"].forEach(m => {
    const btn = document.getElementById("fuelViewFilter_" + m);
    if (btn) {
      btn.className = (m === mode)
        ? "flex-1 py-1.5 rounded-xl bg-blue-600 text-white shadow font-black transition-all"
        : "flex-1 py-1.5 rounded-xl custom-card border custom-muted hover:text-white font-bold transition-all";
    }
  });
  if (typeof renderFuelCards === 'function') {
    renderFuelCards(getFilteredCombinedLogs());
  }
}

function getFilteredCombinedLogs() {
  let combined = [];
  const fuelsList = Array.isArray(window.fuels) ? window.fuels : [];
  const odosList = Array.isArray(window.odoLogs) ? window.odoLogs : [];
  const calcF = calculateFuelMetrics(fuelsList);
  const curYear = (typeof selectedYear !== 'undefined') ? selectedYear : "all";

  if (activeFuelViewFilter === "all" || activeFuelViewFilter === "fuel") {
    calcF.forEach(f => {
      if (curYear === "all" || (f.date && f.date.startsWith(curYear))) {
        combined.push({ ...f, isOdoOnly: false });
      }
    });
  }

  if (activeFuelViewFilter === "all" || activeFuelViewFilter === "odo") {
    odosList.forEach(o => {
      if (curYear === "all" || (o.date && o.date.startsWith(curYear))) {
        combined.push({ ...o, isOdoOnly: true });
      }
    });
  }

  return combined.sort((a, b) => new Date(b.date) - new Date(a.date) || b.km - a.km);
}
