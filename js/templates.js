// --- TEMPLATES.JS: KART ŞABLONLARI VE LİSTELEME ---

let expandedCards = new Set();
let openMonthAccordions = new Set();
let maxVisibleMonths = 3;
let hasInitializedAccordion = false;

function toggleCardExpansion(id) {
  if (expandedCards.has(id)) expandedCards.delete(id);
  else expandedCards.add(id);
  if (typeof getFilteredCombinedLogs === 'function') {
    renderFuelCards(getFilteredCombinedLogs());
  }
}

function clearFuelSearch() {
  const input = document.getElementById("fuelSearchInput");
  if (input) {
    input.value = "";
    if (typeof getFilteredCombinedLogs === 'function') {
      renderFuelCards(getFilteredCombinedLogs());
    }
    const clearBtn = document.getElementById("fuelClearBtn");
    if (clearBtn) clearBtn.classList.add("hidden");
  }
}

function toggleMonthAccordion(monthKey) {
  if (openMonthAccordions.has(monthKey)) {
    openMonthAccordions.delete(monthKey);
  } else {
    openMonthAccordions.add(monthKey);
  }
  if (typeof getFilteredCombinedLogs === 'function') {
    renderFuelCards(getFilteredCombinedLogs());
  }
}

function showMoreMonths() {
  maxVisibleMonths += 3;
  if (typeof getFilteredCombinedLogs === 'function') {
    renderFuelCards(getFilteredCombinedLogs());
  }
}

function formatMonthTitle(monthKey) {
  const parts = monthKey.split("-");
  const year = parts[0];
  const month = parts[1];
  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const mIdx = parseInt(month, 10) - 1;
  return (monthNames[mIdx] || month) + " " + year;
}

// ANA KART ÇİZME FONKSİYONU
function renderFuelCards(combinedList) {
  const container = document.getElementById("fuelCardsList");
  if (!container) return;
  container.innerHTML = "";

  if (!Array.isArray(combinedList)) combinedList = [];

  const searchInput = document.getElementById("fuelSearchInput");
  const query = (searchInput ? searchInput.value : "").toLowerCase();
  const clearBtn = document.getElementById("fuelClearBtn");
  if (clearBtn) clearBtn.classList.toggle("hidden", !query);

  const filtered = combinedList.filter(item => {
    if (!item) return false;
    if (item.isOdoOnly) {
      return (item.note && item.note.toLowerCase().includes(query)) ||
             (item.date && item.date.includes(query)) ||
             (item.km && item.km.toString().includes(query));
    } else {
      return (item.station && item.station.toLowerCase().includes(query)) ||
             (item.branch && item.branch.toLowerCase().includes(query)) ||
             (item.paymentMethod && item.paymentMethod.toLowerCase().includes(query)) ||
             (item.date && item.date.includes(query)) ||
             (item.km && item.km.toString().includes(query));
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-6 text-center custom-muted text-xs font-semibold">Kayıtlı veri bulunmuyor.</div>';
    return;
  }

  const allFuels = Array.isArray(window.fuels) ? window.fuels : [];
  const allOdos = Array.isArray(window.odoLogs) ? window.odoLogs : [];

  // +KM Fark Haritası
  const allChron = [
    ...allFuels.map(f => ({ ...f, isOdoOnly: false })),
    ...allOdos.map(o => ({ ...o, isOdoOnly: true }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);

  let stepDiffMap = {};
  for (let i = 1; i < allChron.length; i++) {
    let diff = allChron[i].km - allChron[i - 1].km;
    if (diff > 0) stepDiffMap[allChron[i].id] = diff;
  }

  // Yakıtlar Arası Mesafe ve Birim Maliyet
  const sortedFuelsOnly = allFuels.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  let fuelDistMap = {};
  for (let i = 0; i < sortedFuelsOnly.length; i++) {
    let curr = sortedFuelsOnly[i];
    if (i > 0) {
      let prev = sortedFuelsOnly[i - 1];
      let d = curr.km - prev.km;
      let days = Math.max(0, Math.round((new Date(curr.date) - new Date(prev.date)) / 86400000));
      if (d > 0) fuelDistMap[curr.id] = { dist: d, days: days, costPerKm: (curr.total / d).toFixed(2) };
    }
  }

  // KM Girişleri Arası Tüketim & Tahmini Harcama
  let odoCostMap = {};
  const sortedOdosOnly = allOdos.slice().sort((a, b) => new Date(a.date) - new Date(b.date) || a.km - b.km);
  for (let i = 1; i < sortedOdosOnly.length; i++) {
    const prevOdo = sortedOdosOnly[i - 1];
    const currOdo = sortedOdosOnly[i];
    const dist = currOdo.km - prevOdo.km;

    if (dist > 0) {
      const l100 = parseFloat(currOdo.dashboardL100) || parseFloat(prevOdo.dashboardL100) || 0;
      let burnedLiters = 0;
      if (l100 > 0) burnedLiters = (dist * l100) / 100;

      const pastFuels = sortedFuelsOnly.filter(f => new Date(f.date) <= new Date(currOdo.date));
      let unitPrice = 0;
      if (pastFuels.length > 0) {
        const lastF = pastFuels[pastFuels.length - 1];
        if (lastF.liters > 0 && lastF.total > 0) unitPrice = lastF.total / lastF.liters;
      }

      if (unitPrice === 0 && window.liveFuelData && window.liveFuelData.fiyatlar) {
        const fType = (window.carProfile && window.carProfile.fuelType) || "benzin";
        const rawPrice = window.liveFuelData.fiyatlar[fType] || "0";
        unitPrice = parseFloat(rawPrice.replace(",", ".")) || 0;
      }

      const estCost = burnedLiters > 0 && unitPrice > 0 ? (burnedLiters * unitPrice) : null;
      odoCostMap[currOdo.id] = {
        dist: dist,
        liters: burnedLiters > 0 ? burnedLiters.toFixed(1) : null,
        cost: estCost ? Math.round(estCost) : null,
        costPerKm: estCost ? (estCost / dist).toFixed(2) : null
      };
    }
  }

  // Aylık Gruplama
  const monthGroups = {};
  filtered.forEach(item => {
    const monthKey = item.date ? item.date.substring(0, 7) : "Diğer";
    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = { items: [], totalFuelExpense: 0, totalLiters: 0, count: 0 };
    }
    monthGroups[monthKey].items.push(item);
    monthGroups[monthKey].count++;
    if (!item.isOdoOnly) {
      monthGroups[monthKey].totalFuelExpense += (item.total || 0);
      monthGroups[monthKey].totalLiters += (item.liters || 0);
    }
  });

  const sortedMonthKeys = Object.keys(monthGroups).sort().reverse();

  if (sortedMonthKeys.length > 0 && !hasInitializedAccordion && !query) {
    openMonthAccordions.add(sortedMonthKeys[0]);
    hasInitializedAccordion = true;
  }

  if (query) {
    sortedMonthKeys.forEach(mk => openMonthAccordions.add(mk));
  }

  const visibleMonthKeys = query ? sortedMonthKeys : sortedMonthKeys.slice(0, maxVisibleMonths);

  visibleMonthKeys.forEach(mKey => {
    const grp = monthGroups[mKey];
    const isOpen = openMonthAccordions.has(mKey);
    const monthTitle = mKey !== "Diğer" ? formatMonthTitle(mKey) : "Tarihsiz Kayıtlar";

    const section = document.createElement("div");
    section.className = "space-y-2";

    const expText = grp.totalFuelExpense > 0 ? '<span class="text-[10px] font-black text-emerald-500">₺' + Math.round(grp.totalFuelExpense).toLocaleString('tr-TR') + '</span>' : '';
    const arrow = isOpen ? '▲' : '▼';

    section.innerHTML = `
      <div onclick="toggleMonthAccordion('${mKey}')" class="p-2.5 rounded-xl custom-card border cursor-pointer flex justify-between items-center shadow-sm hover:border-cyan-500/40 transition-colors">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black text-cyan-500">📅 ${monthTitle}</span>
          <span class="text-[9px] theme-badge-cyan px-2 py-0.5 rounded-full font-bold">${grp.count} Kayıt</span>
        </div>
        <div class="flex items-center gap-2">
          ${expText}
          <span class="text-xs custom-muted font-bold">${arrow}</span>
        </div>
      </div>
    `;

    if (isOpen) {
      const cardsWrapper = document.createElement("div");
      cardsWrapper.className = "space-y-2.5 pl-1";

      grp.items.forEach(item => {
        const card = document.createElement("div");
        card.className = "custom-card p-3.5 shadow text-xs transition-all";
        const dateFormatted = typeof formatDateTimeLabel === 'function' ? formatDateTimeLabel(item.date) : item.date;
        const stepKm = stepDiffMap[item.id];
        const kmBadge = stepKm ? `<span class="theme-badge-green font-black px-1.5 py-0.5 rounded text-[9px]">+${stepKm.toLocaleString('tr-TR')} km</span>` : "";

        // KM KARTI
        if (item.isOdoOnly) {
          const fuelTag = (item.fuelPercent !== null && item.fuelPercent !== undefined) ? `<span class="theme-badge-cyan font-black px-1.5 py-0.5 rounded text-[9px]">⛽ %${item.fuelPercent}</span>` : "";
          const dashTag = item.dashboardL100 ? `<span class="theme-badge-amber font-bold px-1.5 py-0.5 rounded text-[9px]">Ort: ${item.dashboardL100} L</span>` : "";

          const cMeta = odoCostMap[item.id];
          let tripCostTag = "";
          if (cMeta && cMeta.cost) {
            tripCostTag = `<span class="theme-badge-blue font-black px-1.5 py-0.5 rounded text-[9px]">~₺${cMeta.cost.toLocaleString('tr-TR')} (${cMeta.liters} L)</span>`;
          }

          const customNote = (item.note && item.note !== "Manuel KM") ? `<div class="text-[10px] custom-muted mt-1 font-medium">${item.note}</div>` : "";

          card.innerHTML = `
            <div class="flex justify-between items-start gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span class="font-black text-xs text-indigo-400">📍 ${item.km.toLocaleString('tr-TR')} km</span>
                  <span class="theme-badge-purple font-bold px-1.5 py-0.5 rounded text-[9px]">KM Kaydı</span>
                  ${kmBadge}
                  ${fuelTag}
                  ${dashTag}
                  ${tripCostTag}
                </div>
                <div class="text-[10px] custom-muted font-semibold">${dateFormatted}</div>
                ${customNote}
              </div>
              <div class="flex items-center gap-2 shrink-0 pt-0.5">
                <button type="button" onclick="openOdoModal('${item.id}')" title="Düzenle" class="p-1 hover:bg-slate-700/20 rounded text-xs transition-colors">✏️</button>
                <button type="button" onclick="deleteOdoLog('${item.id}')" title="Sil" class="p-1 hover:bg-rose-500/20 rounded text-xs transition-colors">🗑️</button>
              </div>
            </div>
          `;
        } else {
          // YAKIT KARTI
          const isExp = expandedCards.has(item.id);
          const meta = fuelDistMap[item.id];
          const unitPrice = item.liters > 0 ? (item.total / item.liters).toFixed(2) : "0.00";
          const isFull = item.isFull !== undefined ? item.isFull : (item.fillLevel === 'full');
          const fillBadge = isFull ? `<span class="theme-badge-green font-black px-2 py-0.5 rounded text-[10px]">Tam Depo</span>` : `<span class="theme-badge-amber font-black px-2 py-0.5 rounded text-[10px]">Ara Dolum</span>`;
          const compBadge = (item.consumption && isFull) ? `<span class="theme-badge-cyan font-black px-2 py-0.5 rounded-md text-[10px] ml-1">Gerçek: ${item.consumption} L/100km</span>` : "";
          const diffDisplay = (item.consumption && item.dashL100 && isFull) ? `<div class="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1">📊 Pompa: ${item.consumption} L • Gösterge: ${item.dashL100} L</div>` : "";

          card.innerHTML = `
            <div onclick="toggleCardExpansion('${item.id}')" class="cursor-pointer">
              <div class="flex justify-between items-center">
                <div>
                  <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span class="font-black text-xs text-indigo-400">📍 ${item.km.toLocaleString('tr-TR')} km</span>
                    ${kmBadge}
                    <span class="theme-badge-blue font-bold px-2 py-0.5 rounded-md text-[10px]">${item.station}</span>
                    <span class="theme-badge-purple font-bold px-2 py-0.5 rounded-md text-[10px]">${item.paymentMethod || 'Nakit'}</span>
                    ${fillBadge}
                    ${compBadge}
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
                    <span class="font-black truncate block">${item.branch \vert{}\vert{} 'Merkez'} •${item.paymentMethod || 'Nakit'}</span>
                  </div>
                  <div>
                    <span class="custom-muted block text-[9px] font-bold">Litre Fiyatı</span>
                    <span class="font-black text-cyan-600 dark:text-cyan-400">${unitPrice} ₺/L</span>
                  </div>
                </div>
                <div class="flex justify-between items-center pt-1">
                  ${item.docId ? `<button type="button" onclick="viewDocumentById('${item.docId}')" class="text-cyan-600 dark:text-cyan-400 font-black text-[11px] flex items-center gap-1"><span>📄</span> Fişi Görüntüle</button>` : '<span></span>'}
                  <div class="flex gap-3 font-bold text-[11px]">
                    <button type="button" onclick="editFuel('${item.id}')" class="text-blue-600 hover:underline">Düzenle</button>
                    <button type="button" onclick="deleteFuel('${item.id}')" class="text-rose-500 hover:underline">Sil</button>
                  </div>
                </div>
              </div>
            ` : ''}
          `;
        }
        cardsWrapper.appendChild(card);
      });
      section.appendChild(cardsWrapper);
    }

    container.appendChild(section);
  });
}
