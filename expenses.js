// -------------------------------------------------------------
// EXPENSES.JS - GİDER, SERVİS, LASTİK VE RAPOR MOTORU
// -------------------------------------------------------------
let expenses = getPersistedData("expenses", ["ototakip_expenses", "oto_expenses_v8"], []);
const defaultPaymentMethods = ["Nakit", "Bonus", "Maximum", "World", "Axess", "Bankkart"];
let customPaymentMethods = getPersistedData("payment_methods", ["ototakip_payment_methods"], defaultPaymentMethods);
let cardRewards = getPersistedData("card_rewards", ["ototakip_card_rewards"], {});

let defaultTireData = {
  activeSet: "summer",
  summer: { sol_on: { status: "Sorunsuz", history: [] }, sag_on: { status: "Sorunsuz", history: [] }, sol_arka: { status: "Sorunsuz", history: [] }, sag_arka: { status: "Sorunsuz", history: [] }, mountedKm: 0, mountedDate: "" },
  winter: { sol_on: { status: "Sorunsuz", history: [] }, sag_on: { status: "Sorunsuz", history: [] }, sol_arka: { status: "Sorunsuz", history: [] }, sag_arka: { status: "Sorunsuz", history: [] }, mountedKm: 0, mountedDate: "" }
};
let tireData = getPersistedData("tires", ["ototakip_tires", "oto_tires_v8"], defaultTireData);

const EXPENSE_TYPES = {
  FIXED: ["Kasko", "Trafik Sigortası", "MTV (1. Taksit - Ocak)", "MTV (2. Taksit - Temmuz)", "TÜVTÜRK Muayene"],
  VARIABLE: ["Periyodik Bakım", "Parça Değişimi & Onarım", "Lastik Tamir / Değişim", "Oto Yıkama & Temizlik", "Diğer"]
};

function populatePaymentSelects() {
  const targets = document.querySelectorAll(".payment-select-target");
  targets.forEach(selectEl => {
    const curVal = selectEl.value;
    selectEl.innerHTML = "";
    customPaymentMethods.forEach(method => {
      const opt = document.createElement("option"); opt.value = method;
      opt.innerText = method.toLowerCase() === "nakit" ? `💵 ${method}` : `💳 ${method}`;
      if (curVal === method) opt.selected = true;
      selectEl.appendChild(opt);
    });
  });
}

function persistPaymentMethods() {
  localStorage.setItem(STORAGE_PREFIX + "payment_methods", JSON.stringify(customPaymentMethods));
  localStorage.setItem(STORAGE_PREFIX + "card_rewards", JSON.stringify(cardRewards));
  populatePaymentSelects();
  renderPaymentBreakdown();
}

function openExpenseModal() {
  document.getElementById("expForm").reset();
  document.getElementById("eId").value = "";
  document.getElementById("eDocId").value = "";
  document.getElementById("eDocPreviewBox").classList.add("hidden");
  document.getElementById("eDate").value = getNowLocalISO();
  document.getElementById("eIncludeInExpert").checked = true;
  populatePaymentSelects();
  toggleExpenseFields();
  openModalDirectly("expenseModal");
}

async function editExpense(id) {
  const exp = expenses.find(x => String(x.id) === String(id));
  if (!exp) return;
  populatePaymentSelects();
  document.getElementById("eId").value = exp.id;
  document.getElementById("eDate").value = exp.date;
  document.getElementById("eType").value = exp.type;
  document.getElementById("eAmount").value = exp.amount !== undefined ? exp.amount : "";
  document.getElementById("ePaymentMethod").value = exp.paymentMethod || customPaymentMethods[0];
  document.getElementById("eDesc").value = exp.desc || "";
  document.getElementById("eMaintenanceKm").value = exp.maintenanceKm || "";
  document.getElementById("eExtraParts").value = exp.extraParts || "";
  document.getElementById("eIncludeInExpert").checked = exp.includeInExpert !== false;
  document.getElementById("eDocId").value = exp.docId || "";

  if (exp.docId) {
    const uri = await getDocFromDB(exp.docId);
    if (uri && !uri.startsWith("data:application/pdf")) {
      document.getElementById("eDocThumbnail").src = uri;
      document.getElementById("eDocThumbnail").classList.remove("hidden");
    }
    document.getElementById("eDocPreviewBox").classList.remove("hidden");
  } else {
    document.getElementById("eDocPreviewBox").classList.add("hidden");
  }
  toggleExpenseFields();
  openModalDirectly("expenseModal");
}

function saveExpense(e) {
  e.preventDefault();
  const id = document.getElementById("eId").value || ("exp_" + Date.now());
  const typeVal = document.getElementById("eType").value;
  const dateVal = document.getElementById("eDate").value;
  const amountVal = parseFloat(document.getElementById("eAmount").value) || 0;
  const payMethodVal = document.getElementById("ePaymentMethod").value;
  const descVal = document.getElementById("eDesc").value.trim();
  const extraPartsVal = document.getElementById("eExtraParts").value.trim();
  const incExpertVal = document.getElementById("eIncludeInExpert").checked;

  const record = {
    id,
    date: dateVal,
    type: typeVal,
    maintenanceKm: (typeVal === "Periyodik Bakım" || typeVal === "Parça Değişimi & Onarım") ? parseFloat(document.getElementById("eMaintenanceKm").value) || null : null,
    extraParts: typeVal === "Periyodik Bakım" ? extraPartsVal : null,
    includeInExpert: incExpertVal,
    amount: amountVal,
    paymentMethod: payMethodVal,
    desc: descVal,
    docId: document.getElementById("eDocId").value || null
  };

  const idx = expenses.findIndex(x => String(x.id) === String(id));
  if (idx > -1) expenses[idx] = record;
  else expenses.push(record);

  persistAllData();
  closeModal("expenseModal");
  populateYearSelector();
  renderAll();
}

function deleteExpense(id) {
  if (confirm("Bu gideri silmek istediğinize emin misiniz?")) {
    expenses = expenses.filter(x => String(x.id) !== String(id));
    persistAllData();
    populateYearSelector();
    renderAll();
  }
}

function toggleExpenseFields() {
  const type = document.getElementById("eType").value;
  const isMaint = type === "Periyodik Bakım";
  const isRepair = type === "Parça Değişimi & Onarım";
  document.getElementById("maintenanceKmField").classList.toggle("hidden", !(isMaint || isRepair));
  document.getElementById("maintExtraPartsField").classList.toggle("hidden", !isMaint);
  if ((isMaint || isRepair) && !document.getElementById("eMaintenanceKm").value) {
    document.getElementById("eMaintenanceKm").value = getLatestVehicleKm();
  }
}

function setZeroCost() {
  document.getElementById("eAmount").value = "0";
  const d = document.getElementById("eDesc");
  if (!d.value) d.value = "Garantiden değişti / Yetkili servis";
}

let activeExpenseCategory = "all";
function filterExpenseCategory(cat) {
  activeExpenseCategory = cat;
  ["all", "Periyodik Bakım", "Sigorta", "MTV", "Lastik", "TÜVTÜRK Muayene"].forEach(c => {
    const btn = document.getElementById("expChip_" + c);
    if (btn) btn.className = c === cat ? "px-3 py-1.5 rounded-full bg-blue-600 text-white font-black whitespace-nowrap shadow-md" : "px-3 py-1.5 rounded-full custom-card whitespace-nowrap custom-muted font-black";
  });
  renderExpenseCards();
}

let expandedExpenses = new Set();
function toggleExpenseExpansion(id) {
  if (expandedExpenses.has(id)) expandedExpenses.delete(id);
  else expandedExpenses.add(id);
  renderExpenseCards();
}

function renderExpenseCards() {
  const container = document.getElementById("expenseCardsList");
  if (!container) return;
  container.innerHTML = "";
  const query = (document.getElementById("expenseSearchInput")?.value || "").toLowerCase();

  const filtered = expenses.filter(e => {
    const matchYear = (selectedYear === "all" || (e.date && e.date.startsWith(selectedYear)));
    const matchText = (e.type.toLowerCase().includes(query) || (e.desc && e.desc.toLowerCase().includes(query)) || (e.paymentMethod && e.paymentMethod.toLowerCase().includes(query)));
    let matchCategory = true;
    if (activeExpenseCategory === 'Periyodik Bakım') matchCategory = e.type === "Periyodik Bakım";
    else if (activeExpenseCategory === 'Sigorta') matchCategory = e.type.includes("Kasko") || e.type.includes("Sigortası");
    else if (activeExpenseCategory === 'MTV') matchCategory = e.type.includes("MTV");
    else if (activeExpenseCategory === 'Lastik') matchCategory = e.type.includes("Lastik");
    else if (activeExpenseCategory === 'TÜVTÜRK Muayene') matchCategory = e.type === "TÜVTÜRK Muayene";
    return matchYear && matchText && matchCategory;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) return container.innerHTML = `<div class="p-6 text-center custom-muted text-xs font-semibold">Kayıtlı gider bulunmuyor.</div>`;

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "custom-card p-3.5 shadow text-xs transition-all";
    const dateFormatted = formatDateTimeLabel(item.date);
    const isExp = expandedExpenses.has(item.id);
    const isFree = (item.amount === 0 || item.amount === "0");

    card.innerHTML = `
      <div onclick="toggleExpenseExpansion('${item.id}')" class="cursor-pointer">
        <div class="flex justify-between items-center">
          <div>
            <div class="flex items-center gap-1.5 mb-1 flex-wrap">
              <span class="font-black text-pink-600 dark:text-pink-400 text-xs">${item.type}</span>
              <span class="theme-badge-purple px-2 py-0.5 rounded-md text-[10px] font-bold">${item.paymentMethod || 'Nakit'}</span>
              ${isFree ? `<span class="theme-badge-green text-[9px] font-black px-2 py-0.5 rounded-md">🛡️ Garanti (0 ₺)</span>` : ''}
            </div>
            <div class="custom-muted text-[10px] font-semibold">${dateFormatted} ${item.maintenanceKm ? '• ' + item.maintenanceKm.toLocaleString('tr-TR') + ' KM' : ''} ${item.desc ? '• ' + item.desc : ''}</div>
          </div>
          <div class="text-right">
            <span class="font-black text-sm ${isFree ? 'text-emerald-600 dark:text-emerald-400' : ''}">${isFree ? '0 ₺' : '₺' + parseFloat(item.amount).toLocaleString('tr-TR')}</span>
            <div class="text-[10px] custom-muted mt-1 font-bold">${isExp ? '▲ Kapat' : '▼ Detay'}</div>
          </div>
        </div>
      </div>

      ${isExp ? `
        <div class="pt-2.5 mt-2.5 border-t border-slate-700/40 space-y-2.5">
          <div class="flex justify-between items-center pt-1">
            ${item.docId ? `<button onclick="viewDocumentById('${item.docId}')" class="text-cyan-600 dark:text-cyan-400 font-black text-[11px] flex items-center gap-1"><span>📄</span> Belgeyi Görüntüle</button>` : '<span></span>'}
            <div class="flex gap-3 font-bold text-[11px]">
              <button onclick="editExpense('${item.id}')" class="text-blue-600 dark:text-blue-400 hover:underline">Düzenle</button>
              <button onclick="deleteExpense('${item.id}')" class="text-rose-500 hover:underline">Sil</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
  renderPaymentBreakdown();
  renderMaintenancePartsList();
}

function renderMaintenancePartsList() {
  const container = document.getElementById("maintenancePartsList");
  if (!container) return;
  container.innerHTML = "";
  const partsLogs = expenses.filter(e => e.type === "Periyodik Bakım" || e.type === "Parça Değişimi & Onarım" || (e.extraParts && e.extraParts.trim() !== ""));
  if (partsLogs.length === 0) return container.innerHTML = `<div class="text-[10px] custom-muted text-center py-2 font-semibold">Kayıtlı bakım bulunmuyor.</div>`;

  partsLogs.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
    container.innerHTML += `
      <div class="p-2.5 rounded-xl theme-sub-box flex justify-between items-center shadow-sm">
        <div>
          <div class="font-black text-cyan-600 dark:text-cyan-400 text-[11px]">${item.type} ${item.maintenanceKm ? '• ' + item.maintenanceKm.toLocaleString('tr-TR') + ' KM' : ''}</div>
          <div class="text-[10px] custom-muted font-semibold">${formatDateTimeLabel(item.date)} ${item.extraParts ? '• ' + item.extraParts : ''}</div>
        </div>
        <div class="text-right font-black">₺${parseFloat(item.amount).toLocaleString('tr-TR')}</div>
      </div>
    `;
  });
}

function renderPaymentBreakdown() {
  const activeE = expenses.filter(e => selectedYear === "all" || (e.date && e.date.startsWith(selectedYear)));
  const activeF = fuels.filter(f => selectedYear === "all" || (f.date && f.date.startsWith(selectedYear)));
  let summary = {};
  let grandTotal = 0;

  activeF.forEach(f => { const pm = f.paymentMethod || "Nakit"; if (!summary[pm]) summary[pm] = { total: 0 }; summary[pm].total += f.total; grandTotal += f.total; });
  activeE.forEach(e => { const pm = e.paymentMethod || "Nakit"; if (!summary[pm]) summary[pm] = { total: 0 }; summary[pm].total += e.amount; grandTotal += e.amount; });

  const container = document.getElementById("paymentBreakdownContainer");
  if (!container) return;
  container.innerHTML = "";

  customPaymentMethods.forEach(pm => {
    const data = summary[pm] || { total: 0 };
    container.innerHTML += `
      <div onclick="openCardStatement('${pm}')" class="p-2.5 rounded-xl theme-sub-box cursor-pointer">
        <div class="flex justify-between items-center font-bold">
          <span class="text-cyan-600 dark:text-cyan-400 truncate">${pm}</span>
          <span class="text-xs font-black">₺${Math.round(data.total).toLocaleString('tr-TR')}</span>
        </div>
      </div>
    `;
  });
}

// LASTİK MOTORU
function switchTireSeason(season) {
  tireData.activeSet = season;
  persistAllData();
  renderTiresTab();
}

function renderTiresTab() {
  const activeSet = tireData.activeSet || "summer";
  const isSummer = activeSet === "summer";
  document.getElementById("btnTireSummer").className = isSummer ? "flex-1 py-2 text-[11px] font-black rounded-lg transition-all theme-badge-amber shadow-sm" : "flex-1 py-2 text-[11px] font-black rounded-lg transition-all custom-muted hover:text-white";
  document.getElementById("btnTireWinter").className = !isSummer ? "flex-1 py-2 text-[11px] font-black rounded-lg transition-all theme-badge-blue shadow-sm" : "flex-1 py-2 text-[11px] font-black rounded-lg transition-all custom-muted hover:text-white";

  const setObj = tireData[activeSet];
  document.getElementById("tireSetTitle").innerHTML = isSummer ? "<span>☀</span> Yazlık Lastik Seti (4 Tekerlek)" : "<span>❄️</span> Kışlık Lastik Seti (4 Tekerlek)";
  document.getElementById("tireMountedDate").innerText = setObj.mountedDate ? formatDateTimeLabel(setObj.mountedDate) : "--";
  document.getElementById("tireMountedKm").innerText = setObj.mountedKm ? `${setObj.mountedKm.toLocaleString('tr-TR')} KM` : "--";

  const liveKm = getLatestVehicleKm();
  const dDist = (setObj.mountedKm && liveKm >= setObj.mountedKm) ? liveKm - setObj.mountedKm : 0;
  document.getElementById("tireSeasonDistance").innerText = `${dDist.toLocaleString('tr-TR')} km`;

  document.getElementById("tireRotationAlert").classList.toggle("hidden", dDist < 10000);

  ["sol_on", "sag_on", "sol_arka", "sag_arka"].forEach(pos => {
    const el = document.getElementById(`stat_${pos}_status`);
    if (el) el.innerText = setObj[pos].status || "Sorunsuz";
  });
}

function openTireMountModal() {
  document.getElementById("tmDate").value = getNowLocalISO();
  document.getElementById("tmKm").value = getLatestVehicleKm() || "";
  openModalDirectly("tireMountModal");
}

function saveTireMount(e) {
  e.preventDefault();
  const activeSet = tireData.activeSet || "summer";
  tireData[activeSet].mountedDate = document.getElementById("tmDate").value;
  tireData[activeSet].mountedKm = parseFloat(document.getElementById("tmKm").value) || 0;
  persistAllData();
  closeModal("tireMountModal");
  renderTiresTab();
}

let activeTirePos = "sol_on";
function openTireActionModal(pos) {
  activeTirePos = pos;
  document.getElementById("taPosition").value = pos;
  document.getElementById("taDate").value = getNowLocalISO();
  document.getElementById("taCost").value = "";
  document.getElementById("taNote").value = "";

  const activeSet = tireData.activeSet || "summer";
  const posObj = tireData[activeSet][pos];
  const listEl = document.getElementById("tireHistoryList");
  listEl.innerHTML = "";

  if (posObj.history && posObj.history.length > 0) {
    posObj.history.slice().reverse().forEach(h => {
      listEl.innerHTML += `<div class="p-1.5 rounded theme-sub-box text-[9px] flex justify-between"><span>${h.date.split('T')[0]} - ${h.action}</span><b>${h.cost ? '₺' + h.cost : ''}</b></div>`;
    });
  } else {
    listEl.innerHTML = `<div class="text-[9px] custom-muted">Geçmiş işlem yok.</div>`;
  }
  openModalDirectly("tireActionModal");
}

function saveTireAction(e) {
  e.preventDefault();
  const activeSet = tireData.activeSet || "summer";
  const act = document.getElementById("taAction").value;
  const cost = parseFloat(document.getElementById("taCost").value) || 0;
  const note = document.getElementById("taNote").value.trim();
  const date = document.getElementById("taDate").value;

  tireData[activeSet][activeTirePos].status = act;
  if (!tireData[activeSet][activeTirePos].history) tireData[activeSet][activeTirePos].history = [];
  tireData[activeSet][activeTirePos].history.push({ date, action: act, cost, note });

  if (cost > 0) {
    expenses.push({
      id: "exp_" + Date.now(),
      date,
      type: "Lastik Tamir / Değişim",
      amount: cost,
      paymentMethod: customPaymentMethods[0],
      desc: `${activeTirePos.replace('_', ' ').toUpperCase()} ${act} ${note ? '(' + note + ')' : ''}`,
      includeInExpert: true
    });
  }

  persistAllData();
  closeModal("tireActionModal");
  renderTiresTab();
  renderAll();
}

// RAPOR MOTORU
let activeReportMode = "health";

function openReportModal() {
  switchReportMode('health');
  openModalDirectly("expertReportModal");
}

function switchReportMode(mode) {
  activeReportMode = mode;
  const bH = document.getElementById("btnRepHealthMode");
  const bR = document.getElementById("btnRepResaleMode");
  const dynamicContainer = document.getElementById("reportDynamicContent");

  const liveKm = getLatestVehicleKm();
  const now = new Date();
  
  const expDateEl = document.getElementById("expReportDate");
  if (expDateEl) expDateEl.innerText = `Rapor Tarihi: ${now.toLocaleDateString('tr-TR')}`;

  document.getElementById("repCarKm").innerText = liveKm > 0 ? `${liveKm.toLocaleString('tr-TR')} KM` : "0 KM";
  document.getElementById("repCarName").innerText = carProfile.name || "Carveri";
  document.getElementById("repCarDesc").innerText = `${carProfile.desc || 'Model'}`;

  if (mode === 'health') {
    bH.className = "flex-1 py-2 text-[11px] font-black rounded-lg bg-blue-600 text-white shadow";
    bR.className = "flex-1 py-2 text-[11px] font-black rounded-lg custom-muted hover:text-white";

    const maintLogs = expenses.filter(e => e.type === "Periyodik Bakım").sort((a,b) => new Date(b.date) - new Date(a.date));
    let lastMDate = "Kayıt Yok", lastMKm = "--", kmLeftStr = "20.000 km", daysLeftStr = "1 Yıl";
    if (maintLogs.length > 0) {
      const lastM = maintLogs[0];
      lastMDate = formatDateTimeLabel(lastM.date);
      lastMKm = lastM.maintenanceKm ? `${lastM.maintenanceKm.toLocaleString('tr-TR')} KM` : "Belirtilmedi";
      let kmLeft = lastM.maintenanceKm ? Math.max(0, (lastM.maintenanceKm + 20000) - liveKm) : null;
      kmLeftStr = kmLeft !== null ? `${kmLeft.toLocaleString('tr-TR')} km kaldı` : "20.000 KM";
      const tDate = new Date(lastM.date); tDate.setDate(tDate.getDate() + 365);
      const days = Math.ceil((tDate - now) / 86400000);
      daysLeftStr = days > 0 ? `${days} gün kaldı` : "Vadesi Doldu!";
    }

    const activeSet = tireData.activeSet || "summer";
    const setObj = tireData[activeSet];
    let tDist = (liveKm >= (setObj.mountedKm || 0)) ? liveKm - (setObj.mountedKm || 0) : 0;

    const kaskoLast = expenses.filter(e => e.type === "Kasko").sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    const trafikLast = expenses.filter(e => e.type === "Trafik Sigortası").sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    const muayeneLast = expenses.filter(e => e.type === "TÜVTÜRK Muayene").sort((a,b) => new Date(b.date) - new Date(a.date))[0];

    dynamicContainer.innerHTML = `
      <div class="p-3.5 rounded-xl theme-sub-box space-y-2">
        <h4 class="text-[11px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><span>🛠️</span> Periyodik Bakım Vadeleri (Tam Takip)</h4>
        <div class="grid grid-cols-2 gap-2.5 text-[10px]">
          <div><span class="custom-muted block text-[9px] font-bold">Son Bakım Tarihi</span><b class="font-bold">${lastMDate}</b></div>
          <div><span class="custom-muted block text-[9px] font-bold">Son Bakım KM</span><b class="font-bold">${lastMKm}</b></div>
          <div><span class="custom-muted block text-[9px] font-bold">Kalan KM Ömrü</span><b class="text-emerald-600 dark:text-emerald-400 font-black">${kmLeftStr}</b></div>
          <div><span class="custom-muted block text-[9px] font-bold">Yıllık Vade</span><b class="text-emerald-600 dark:text-emerald-400 font-black">${daysLeftStr}</b></div>
        </div>
      </div>

      <div class="p-3.5 rounded-xl theme-sub-box space-y-2">
        <h4 class="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><span>🏛️</span> Yasal Zorunluluklar & Poliçeler</h4>
        <div class="grid grid-cols-2 gap-2 text-[10px]">
          <div class="p-2.5 rounded-lg theme-sub-box border">
            <span class="custom-muted block text-[9px] font-bold">Kasko Durumu</span>
            <b class="font-bold text-xs mt-0.5 block">${kaskoLast ? formatDateTimeLabel(kaskoLast.date) : 'Poliçe Eklenmedi'}</b>
          </div>
          <div class="p-2.5 rounded-lg theme-sub-box border">
            <span class="custom-muted block text-[9px] font-bold">Trafik Sigortası</span>
            <b class="font-bold text-xs mt-0.5 block">${trafikLast ? formatDateTimeLabel(trafikLast.date) : 'Poliçe Eklenmedi'}</b>
          </div>
          <div class="p-2.5 rounded-lg theme-sub-box border col-span-2">
            <span class="custom-muted block text-[9px] font-bold">TÜVTÜRK Muayene</span>
            <b class="font-bold text-xs mt-0.5 block">${muayeneLast ? formatDateTimeLabel(muayeneLast.date) : 'Kayıt Yok'}</b>
          </div>
        </div>
      </div>

      <div class="p-3.5 rounded-xl theme-sub-box space-y-2">
        <h4 class="text-[11px] font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5"><span>🛞</span> Lastik Sağlığı & Tekerlek Detayları</h4>
        <div class="text-[10px] space-y-1 mb-2">
          <div class="flex justify-between"><span class="custom-muted font-semibold">Takılı Set:</span><b class="font-bold">${activeSet === "summer" ? "☀️ Yazlık Set" : "❄️ Kışlık Set"}</b></div>
          <div class="flex justify-between"><span class="custom-muted font-semibold">Sezon Yapılan Yol:</span><b class="font-bold">${tDist.toLocaleString('tr-TR')} km</b></div>
          <div class="flex justify-between"><span class="custom-muted font-semibold">Rotasyon Durumu:</span><b class="${tDist >= 10000 ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-emerald-600 dark:text-emerald-400 font-bold'}">${tDist >= 10000 ? 'Rotasyon Vakti Geldi!' : 'Normal'}</b></div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[10px]">
          <div class="p-1.5 rounded theme-sub-box">Sol Ön: <b>${setObj.sol_on.status}</b></div>
          <div class="p-1.5 rounded theme-sub-box">Sağ Ön: <b>${setObj.sag_on.status}</b></div>
          <div class="p-1.5 rounded theme-sub-box">Sol Arka: <b>${setObj.sol_arka.status}</b></div>
          <div class="p-1.5 rounded theme-sub-box">Sağ Arka: <b>${setObj.sag_arka.status}</b></div>
        </div>
      </div>
    `;
  } else {
    bR.className = "flex-1 py-2 text-[11px] font-black rounded-lg bg-emerald-600 text-white shadow";
    bH.className = "flex-1 py-2 text-[11px] font-black rounded-lg custom-muted hover:text-white";

    const expertRecords = expenses.filter(e => {
      const isNotOwnerExpense = !e.type.includes("Kasko") && !e.type.includes("Sigortası") && !e.type.includes("MTV") && !e.type.includes("Lastik");
      return e.includeInExpert !== false && isNotOwnerExpense;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    let serviceListHtml = "";
    if (expertRecords.length === 0) {
      serviceListHtml = `<div class="p-2 text-center custom-muted text-[10px] font-semibold">Kayıtlı mekanik servis/onarım bulunmuyor.</div>`;
    } else {
      serviceListHtml = expertRecords.map(item => {
        const isFree = (item.amount === 0 || item.amount === "0");
        return `
          <div class="p-2.5 rounded-xl theme-sub-box text-[10px] space-y-1 shadow-sm">
            <div class="flex justify-between items-start font-black">
              <span>${item.type}</span>
              <span class="${isFree ? 'text-emerald-600 dark:text-emerald-400' : ''} font-black">${isFree ? '🛡️ Garanti Kapsamında (0 ₺)' : '₺' + parseFloat(item.amount).toLocaleString('tr-TR')}</span>
            </div>
            <div class="flex justify-between text-[9px] custom-muted font-semibold">
              <span>📅 ${formatDateTimeLabel(item.date)}</span>
              <span>${item.maintenanceKm ? '📍 ' + item.maintenanceKm.toLocaleString('tr-TR') + ' KM' : ''}</span>
            </div>
            ${item.desc ? `<div class="text-[9px] font-medium">${item.desc}</div>` : ''}
          </div>
        `;
      }).join('');
    }

    let totalFuel = 0; if (typeof fuels !== 'undefined') fuels.forEach(f => totalFuel += f.total);
    let mechMaintExp = 0;
    expertRecords.forEach(e => mechMaintExp += e.amount);

    dynamicContainer.innerHTML = `
      <div class="p-3.5 rounded-xl theme-sub-box space-y-2">
        <h4 class="text-[11px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><span>🛡️</span> Yetkili Servis & Mekanik Onarım Geçmişi</h4>
        <p class="text-[9px] custom-muted font-semibold">Alıcıya sunulacak şeffaf periyodik bakım ve garanti onarım dökümü:</p>
        <div class="space-y-2 pt-1">${serviceListHtml}</div>
      </div>

      <div class="p-3.5 rounded-xl theme-sub-box space-y-2">
        <h4 class="text-[11px] font-black text-pink-600 dark:text-pink-400 flex items-center gap-1.5"><span>💰</span> Bakım & Yakıt Masraf Özeti</h4>
        <div class="grid grid-cols-2 gap-2.5 text-[10px]">
          <div><span class="custom-muted block text-[9px] font-bold">Toplam Yakıt Tüketimi</span><b class="font-bold">₺${Math.round(totalFuel).toLocaleString('tr-TR')}</b></div>
          <div><span class="custom-muted block text-[9px] font-bold">Mekanik Servis Gideri</span><b class="font-bold">₺${Math.round(mechMaintExp).toLocaleString('tr-TR')}</b></div>
        </div>
      </div>
    `;
  }
}
