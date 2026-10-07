// -------------------------------------------------------------
// CHARTS.JS - CHART.JS GRAFİK VE TAM EKRAN KIRILIM MOTORU
// -------------------------------------------------------------
let charts = { km: null, fuel: null, price: null, landscape: null };
let fuelChartMode = 'tl';
let isChartAccordionOpen = false;

function toggleChartsAccordion() {
  const body = document.getElementById("chartsAccordionBody");
  const icon = document.getElementById("chartAccordionIcon");
  isChartAccordionOpen = !isChartAccordionOpen;
  if (isChartAccordionOpen) {
    body.classList.remove("hidden");
    icon.innerText = "▲ Gizle";
    const ff = fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
    renderCharts(calculateFuelMetrics(ff));
  } else {
    body.classList.add("hidden");
    icon.innerText = "▼ Göster";
  }
}

function processMonthlyData(calcFuels) {
  let map = {};
  const allSortedOdo = odoLogs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const allSortedFuels = fuels.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  calcFuels.forEach(f => {
    const k = f.date.substring(0, 7);
    if (!map[k]) map[k] = { min: f.km, max: f.km, lit: 0, tot: 0, startBridgeKm: null };
    map[k].min = Math.min(map[k].min, f.km);
    map[k].max = Math.max(map[k].max, f.km);
    map[k].lit += f.liters;
    map[k].tot += f.total;
  });

  const activeOdo = odoLogs.filter(o => selectedYear === "all" || (o.date && o.date.startsWith(selectedYear)));
  activeOdo.forEach(o => {
    const k = o.date.substring(0, 7);
    if (!map[k]) map[k] = { min: o.km, max: o.km, lit: 0, tot: 0, startBridgeKm: null };
    map[k].min = Math.min(map[k].min, o.km);
    map[k].max = Math.max(map[k].max, o.km);
  });

  const sortedMonths = Object.keys(map).sort();
  sortedMonths.forEach(mKey => {
    const [yearStr, monthStr] = mKey.split('-');
    let prevMDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    prevMDate.setDate(prevMDate.getDate() - 1);
    const prevMKey = prevMDate.toISOString().substring(0, 7);

    const prevBridge = allSortedOdo.filter(o => o.isBridge && o.date.startsWith(prevMKey)).pop();
    if (prevBridge) {
      map[mKey].startBridgeKm = prevBridge.km;
    } else if (map[prevMKey]) {
      map[mKey].startBridgeKm = map[prevMKey].max;
    } else {
      const lastBefore = [...allSortedOdo, ...allSortedFuels].filter(item => item.date < `${mKey}-01`).sort((a,b) => new Date(a.date) - new Date(b.date)).pop();
      if (lastBefore) map[mKey].startBridgeKm = lastBefore.km;
    }
  });

  let l = [], kD = [], cD = [], lD = [], fullKeys = [];
  for (let i = 0; i < sortedMonths.length; i++) {
    const mKey = sortedMonths[i];
    fullKeys.push(mKey);
    l.push(mKey.substring(5));
    cD.push(Math.round(map[mKey].tot));
    lD.push(parseFloat(map[mKey].lit.toFixed(1)));
    let baseKm = map[mKey].startBridgeKm !== null ? map[mKey].startBridgeKm : map[mKey].min;
    let d = map[mKey].max - baseKm;
    kD.push(Math.max(d, 0));
  }
  return { labels: l, kmData: kD, costData: cD, litData: lD, fullKeys };
}

function renderCharts(calcFuels) {
  if (typeof Chart === "undefined" || !isChartAccordionOpen) return;
  const gC = currentTheme === 'light' ? '#cbd5e1' : '#1e2c4f';
  const tC = currentTheme === 'light' ? '#475569' : '#94a3b8';
  const m = processMonthlyData(calcFuels);

  const canvasKm = document.getElementById("monthlyKmCanvas");
  if (charts.km) { charts.km.destroy(); charts.km = null; }
  const ctxKm = canvasKm.getContext("2d");
  let gradKm = ctxKm.createLinearGradient(0, 0, 0, 150);
  gradKm.addColorStop(0, 'rgba(59, 130, 246, 0.85)');
  gradKm.addColorStop(1, 'rgba(59, 130, 246, 0.2)');

  charts.km = new Chart(ctxKm, {
    type: 'bar',
    data: { labels: m.labels.length ? m.labels : ["-"], datasets: [{ data: m.kmData.length ? m.kmData : [0], backgroundColor: gradKm, borderColor: '#3b82f6', borderWidth: 1, borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gC }, ticks: { color: tC, font: { size: 9, weight: 'bold' } } }, y: { grid: { color: gC }, ticks: { color: tC, font: { size: 9 } } } } }
  });

  const ctxFuel = document.getElementById("monthlyFuelCanvas").getContext("2d");
  if (charts.fuel) { charts.fuel.destroy(); charts.fuel = null; }
  let gradFuel = ctxFuel.createLinearGradient(0, 0, 0, 150);
  gradFuel.addColorStop(0, 'rgba(245, 158, 11, 0.85)');
  gradFuel.addColorStop(1, 'rgba(245, 158, 11, 0.2)');
  const fuelChartVals = fuelChartMode === 'tl' ? (m.costData.length ? m.costData : [0]) : (m.litData.length ? m.litData : [0]);

  charts.fuel = new Chart(ctxFuel, {
    type: 'bar',
    data: { labels: m.labels.length ? m.labels : ["-"], datasets: [{ data: fuelChartVals, backgroundColor: gradFuel, borderColor: '#f59e0b', borderWidth: 1, borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gC }, ticks: { color: tC, font: { size: 9, weight: 'bold' } } }, y: { grid: { color: gC }, ticks: { color: tC, font: { size: 9 } } } } }
  });

  const sf = calcFuels.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const ctxPrice = document.getElementById("priceTrendCanvas").getContext("2d");
  if (charts.price) { charts.price.destroy(); charts.price = null; }
  let gradPrice = ctxPrice.createLinearGradient(0, 0, 0, 120);
  gradPrice.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
  gradPrice.addColorStop(1, 'rgba(56, 189, 248, 0.00)');

  const shortInlineLabels = sf.map(f => {
    if (!f.date) return "-";
    const d = new Date(f.date);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  charts.price = new Chart(ctxPrice, {
    type: 'line',
    data: { labels: shortInlineLabels.length ? shortInlineLabels : ["-"], datasets: [{ data: sf.length ? sf.map(f => (f.total / f.liters).toFixed(2)) : [0], borderColor: '#38bdf8', backgroundColor: gradPrice, fill: true, tension: 0.3, pointRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, ticks: { color: tC, font: { size: 9 }, maxTicksLimit: 7 } }, y: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, ticks: { color: tC, font: { size: 9 } } } } }
  });
}

function toggleFuelChartMode(mode) {
  fuelChartMode = mode;
  document.getElementById("chartModeBtnTl").className = mode === 'tl' ? "text-[9px] font-bold px-2.5 py-1 rounded-md bg-amber-600 text-white shadow" : "text-[9px] font-bold px-2.5 py-1 rounded-md custom-card custom-muted";
  document.getElementById("chartModeBtnLit").className = mode === 'lit' ? "text-[9px] font-bold px-2.5 py-1 rounded-md bg-amber-600 text-white shadow" : "text-[9px] font-bold px-2.5 py-1 rounded-md custom-card custom-muted";
  const ff = fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
  renderCharts(calculateFuelMetrics(ff));
}

function openLandscapeChart(type) {
  const fF = fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
  const cF = calculateFuelMetrics(fF);
  const m = processMonthlyData(cF);
  const ctx = document.getElementById("landscapeCanvas").getContext("2d");
  const gC = currentTheme === 'light' ? '#cbd5e1' : '#1e2c4f';
  const tC = currentTheme === 'light' ? '#475569' : '#94a3b8';

  document.getElementById("btnReturnToMonthlyKm").classList.add("hidden");
  if (charts.landscape) { charts.landscape.destroy(); charts.landscape = null; }

  if (type === 'km') {
    renderLandscapeMonthlyKm();
  } else if (type === 'fuel') {
    document.getElementById("landscapeChartIcon").innerText = "⛽";
    document.getElementById("landscapeChartTitle").innerText = fuelChartMode === 'tl' ? "Aylık Akaryakıt (₺ Tutar)" : "Aylık Akaryakıt (Litre)";
    const dsVals = fuelChartMode === 'tl' ? (m.costData.length ? m.costData : [0]) : (m.litData.length ? m.litData : [0]);

    charts.landscape = new Chart(ctx, {
      type: 'bar',
      data: { labels: m.labels.length ? m.labels.map(l => l + ". Ay") : ["-"], datasets: [{ label: 'Yakıt', data: dsVals, backgroundColor: '#f59e0b', borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: gC }, ticks: { color: tC } }, y: { grid: { color: gC }, ticks: { color: tC } } } }
    });
  } else if (type === 'price') {
    document.getElementById("landscapeChartIcon").innerText = "📊";
    document.getElementById("landscapeChartTitle").innerText = "Pompa Litre Fiyat Trendi";
    const sF = cF.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    charts.landscape = new Chart(ctx, {
      type: 'line',
      data: { labels: sF.map(f => f.date ? f.date.split('T')[0] : "-"), datasets: [{ label: '₺/L', data: sF.map(f => (f.total/f.liters).toFixed(2)), borderColor: '#38bdf8', fill: false, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: gC }, ticks: { color: tC } }, y: { grid: { color: gC }, ticks: { color: tC } } } }
    });
  }
  openModalDirectly("landscapeChartModal");
}

function renderLandscapeMonthlyKm() {
  document.getElementById("btnReturnToMonthlyKm").classList.add("hidden");
  document.getElementById("landscapeChartIcon").innerText = "📈";
  document.getElementById("landscapeChartTitle").innerText = "Aylık Yol Analizi (Tam Ekran)";
  document.getElementById("landscapeChartSubText").innerText = "Sütuna tıklayarak o ayın gün analizini açın";

  const fF = fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
  const m = processMonthlyData(calculateFuelMetrics(fF));
  const ctx = document.getElementById("landscapeCanvas").getContext("2d");
  const gC = currentTheme === 'light' ? '#cbd5e1' : '#1e2c4f';
  const tC = currentTheme === 'light' ? '#475569' : '#94a3b8';

  if (charts.landscape) { charts.landscape.destroy(); charts.landscape = null; }
  charts.landscape = new Chart(ctx, {
    type: 'bar',
    data: { labels: m.labels.length ? m.labels : ["-"], datasets: [{ label: 'Yol (km)', data: m.kmData.length ? m.kmData : [0], backgroundColor: '#3b82f6', borderRadius: 8 }] },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const selectedKey = m.fullKeys[index];
          renderLandscapeDailyKm(selectedKey);
        }
      },
      scales: { x: { grid: { color: gC }, ticks: { color: tC } }, y: { grid: { color: gC }, ticks: { color: tC } } } 
    }
  });

  const infoBox = document.getElementById("landscapeBottomInfoBox");
  infoBox.innerHTML = `
    <div class="text-[11px] font-black text-cyan-600 dark:text-cyan-400 mb-1">📅 Aylık Döküm Özeti (Detay İçin Tıklayın):</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
      ${m.fullKeys.map((mk, idx) => `
        <div onclick="renderLandscapeDailyKm('${mk}')" class="p-2 theme-sub-box rounded-lg cursor-pointer hover:border-cyan-500 transition-colors">
          <span class="custom-muted block font-bold">${mk}</span>
          <b class="text-blue-600 dark:text-blue-400 font-black">${m.kmData[idx].toLocaleString('tr-TR')} KM</b>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLandscapeDailyKm(monthKey) {
  document.getElementById("btnReturnToMonthlyKm").classList.remove("hidden");
  document.getElementById("landscapeChartIcon").innerText = "📅";
  document.getElementById("landscapeChartTitle").innerText = `${monthKey} - Günlük Yapılan Yol`;
  document.getElementById("landscapeChartSubText").innerText = "Gün bazında katedilen mesafe dökümü";

  let allEntries = [];
  fuels.filter(f => f.date && f.date.startsWith(monthKey)).forEach(f => {
    allEntries.push({ date: f.date, km: f.km, label: `⛽ ${f.station} (${f.liters} L)` });
  });
  odoLogs.filter(o => o.date && o.date.startsWith(monthKey)).forEach(o => {
    allEntries.push({ date: o.date, km: o.km, label: `📍 ${o.note || 'Sayaç'}` });
  });

  allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let prevBaseKm = null;
  const allSortedCombined = [...odoLogs, ...fuels].sort((a,b) => new Date(a.date) - new Date(b.date));
  const lastBefore = allSortedCombined.filter(item => item.date < `${monthKey}-01`).pop();
  if (lastBefore) prevBaseKm = lastBefore.km;

  let lastCounter = prevBaseKm;
  allEntries.forEach(item => {
    let diff = 0;
    if (lastCounter !== null && item.km >= lastCounter) {
      diff = item.km - lastCounter;
    }
    item.diffKm = diff;
    lastCounter = item.km;
  });

  let dailyMap = {};
  allEntries.forEach(item => {
    let dayStr = item.date.split("T")[0];
    if (!dailyMap[dayStr]) {
      dailyMap[dayStr] = { totalDiff: 0, entries: [] };
    }
    dailyMap[dayStr].totalDiff += item.diffKm;
    dailyMap[dayStr].entries.push(item);
  });

  let sortedDays = Object.keys(dailyMap).sort();
  let dailyLabels = [];
  let dailyDistances = [];

  sortedDays.forEach(dayStr => {
    dailyLabels.push(dayStr.substring(8) + ". Gün");
    dailyDistances.push(dailyMap[dayStr].totalDiff);
  });

  const ctx = document.getElementById("landscapeCanvas").getContext("2d");
  const gC = currentTheme === 'light' ? '#cbd5e1' : '#1e2c4f'; 
  const tC = currentTheme === 'light' ? '#475569' : '#94a3b8';

  if (charts.landscape) { charts.landscape.destroy(); charts.landscape = null; }
  charts.landscape = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dailyLabels.length ? dailyLabels : ["-"],
      datasets: [{
        label: 'Yapılan Yol (km)',
        data: dailyDistances.length ? dailyDistances : [0],
        backgroundColor: '#0284c7',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: gC }, ticks: { color: tC, font: { size: 10, weight: 'bold' } } },
        y: { grid: { color: gC }, ticks: { color: tC } }
      }
    }
  });

  const infoBox = document.getElementById("landscapeBottomInfoBox");
  if (allEntries.length === 0) {
    infoBox.innerHTML = `<div class="text-center custom-muted text-[10px] py-2 font-semibold">${monthKey} döneminde sayaç hareketi yok.</div>`;
  } else {
    infoBox.innerHTML = `
      <div class="text-[11px] font-black text-cyan-600 dark:text-cyan-400 mb-1">📋 ${monthKey} Ayı Günlük Yol Dökümü:</div>
      <div class="space-y-1">
        ${sortedDays.map(dayStr => {
          let info = dailyMap[dayStr];
          return `
            <div class="p-2 theme-sub-box rounded-lg flex justify-between items-center text-[10px]">
              <div>
                <span class="font-bold">${dayStr}</span>
                <span class="custom-muted ml-1.5">${info.entries.map(e => e.label).join(' • ')}</span>
              </div>
              <div class="text-right">
                <span class="font-black text-emerald-600 dark:text-emerald-400">+${info.totalDiff.toLocaleString('tr-TR')} KM</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

function closeLandscapeChart() {
  if (charts.landscape) { charts.landscape.destroy(); charts.landscape = null; }
  closeModal("landscapeChartModal");
}
