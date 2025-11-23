// ===============================
// 1) DUMMY DATA – SAMAKAN STRUKTUR DENGAN EXCEL
// ===============================

// Contoh ringkas dari sheet Reject_KPI (Before & After)
const kpiData = [
  // row "before"
  {
    batch_id: "ALL",
    truck_id: "ALL",
    reject_before: 25.0, // %
    reject_after: null,
    reject_reduction: null,
    Reject_Target: 30,
    Before_After: "before",
  },
  // row "after"
  {
    batch_id: "ALL",
    truck_id: "ALL",
    reject_before: null,
    reject_after: 15.0, // %
    reject_reduction: 40.0, // contoh: turun 40%
    Reject_Target: 30,
    Before_After: "after",
  },
];

// Contoh ringkas dari sheet Condition (hanya After yang dipakai simulasi)
const conditionData = [
  {
    timestamp: "16/11/2025 08:00:00",
    batch_id: "BATCH_1",
    truck_id: "TRUCK_1",
    temperature: 13.99,
    humidity: 78.36,
    weight_loss: 1.56,
    visual_quality: "good",
    alert_status: "alert",
    alert_duration: 5,
    alert_triggered: true,
    Before_After: "after",
  },
  {
    timestamp: "16/11/2025 08:01:00",
    batch_id: "BATCH_2",
    truck_id: "TRUCK_2",
    temperature: 18.5,
    humidity: 82.0,
    weight_loss: 3.2,
    visual_quality: "fair",
    alert_status: "alert",
    alert_duration: 3,
    alert_triggered: true,
    Before_After: "after",
  },
  {
    timestamp: "16/11/2025 08:02:00",
    batch_id: "BATCH_3",
    truck_id: "TRUCK_3",
    temperature: 22.4,
    humidity: 85.1,
    weight_loss: 5.0,
    visual_quality: "poor",
    alert_status: "alert",
    alert_duration: 7,
    alert_triggered: true,
    Before_After: "after",
  },
  {
    timestamp: "16/11/2025 08:03:00",
    batch_id: "BATCH_4",
    truck_id: "TRUCK_4",
    temperature: 15.2,
    humidity: 80.0,
    weight_loss: 2.1,
    visual_quality: "good",
    alert_status: "normal",
    alert_duration: 0,
    alert_triggered: false,
    Before_After: "after",
  },
];

// NOTE:
// Di implementasi asli, ganti kpiData & conditionData ini dengan hasil ETL
// dari file Excel kamu (bisa via API / file JSON dari backend).

// ===============================
// 2) STATE & DOM
// ===============================
let baselineReject = 0;
let currentReject = 0;
let defectThreshold = 20;
let earlyWarningFactor = 0.8; // 80%
let simulationInterval = null;
let simIndex = 0;

const stats = {
  total: 0,
  rejected: 0,
};

const baselineRejectInput = document.getElementById("baselineRejectInput");
const defectThresholdInput = document.getElementById("defectThresholdInput");
const updateConfigBtn = document.getElementById("updateConfigBtn");
const toggleSimulationBtn = document.getElementById("toggleSimulationBtn");

const baselineRejectText = document.getElementById("baselineRejectText");
const baselineBadge = document.getElementById("baselineBadge");
const currentRejectText = document.getElementById("currentRejectText");
const currentRejectBadge = document.getElementById("currentRejectBadge");
const reductionText = document.getElementById("reductionText");
const reductionBadge = document.getElementById("reductionBadge");
const totalBatchText = document.getElementById("totalBatchText");
const rejectCountBadge = document.getElementById("rejectCountBadge");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusText = document.getElementById("statusText");

const thresholdDefectText = document.getElementById("thresholdDefectText");
const thresholdEarlyText = document.getElementById("thresholdEarlyText");

const batchTableBody = document.getElementById("batchTableBody");
const alertList = document.getElementById("alertList");
const alertCounter = document.getElementById("alertCounter");

// ==== DOM untuk FORM INPUT MANUAL BATCH ====
const manualBatchForm = document.getElementById("manualBatchForm");
const manualBatchIdInput = document.getElementById("manualBatchId");
const manualTruckIdInput = document.getElementById("manualTruckId");
const manualTempInput = document.getElementById("manualTemp");
const manualDefectInput = document.getElementById("manualDefect");

// ===============================
// 3) HELPER
// ===============================
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTimeFromString(ts) {
  // ts contoh: "16/11/2025 08:00:00" atau "08:00:00"
  const parts = String(ts).split(" ");
  return parts[1] || parts[0];
}

// Ambil baseline (before) & current (after) dari Reject_KPI
function initFromKpiData() {
  const beforeRows = kpiData.filter(
    (r) => r.Before_After?.toLowerCase() === "before"
  );
  const afterRows = kpiData.filter(
    (r) => r.Before_After?.toLowerCase() === "after"
  );

  // Kalau ada lebih dari satu row, bisa di-avg
  const avgBefore =
    beforeRows.length > 0
      ? beforeRows.reduce((sum, r) => sum + (r.reject_before || 0), 0) /
        beforeRows.length
      : 0;

  const avgAfter =
    afterRows.length > 0
      ? afterRows.reduce((sum, r) => sum + (r.reject_after || 0), 0) /
        afterRows.length
      : 0;

  baselineReject = avgBefore;
  currentReject = avgAfter;

  baselineRejectInput.value = baselineReject.toFixed(1);
  baselineRejectText.textContent = baselineReject.toFixed(1);
  currentRejectText.textContent = currentReject.toFixed(1);

  updateMetrics(); // sekalian hitung reduction
}

// ===============================
// 4) METRICS & TABEL
// ===============================
function updateMetrics() {
  // hitung current reject rate berdasarkan stats simulasi juga
  const simulatedRejectRate =
    stats.total > 0 ? (stats.rejected / stats.total) * 100 : currentReject;

  currentRejectText.textContent = simulatedRejectRate.toFixed(1);
  totalBatchText.textContent = stats.total;

  rejectCountBadge.textContent =
    stats.rejected +
    " batch ditolak (" +
    simulatedRejectRate.toFixed(1) +
    "%)";

  // bandingkan dengan baseline
  if (simulatedRejectRate > baselineReject) {
    currentRejectBadge.textContent = "Lebih tinggi dari baseline";
    currentRejectBadge.classList.add("metric-badge--bad");
    currentRejectBadge.classList.remove("metric-badge--good");
  } else {
    currentRejectBadge.textContent = "Lebih rendah dari baseline";
    currentRejectBadge.classList.remove("metric-badge--bad");
    currentRejectBadge.classList.add("metric-badge--good");
  }

  let reduction = 0;
  if (baselineReject > 0) {
    reduction =
      ((baselineReject - simulatedRejectRate) / baselineReject) * 100;
  }
  reduction = clamp(reduction, -100, 100);
  reductionText.textContent = reduction.toFixed(1);

  const target = 30; // atau bisa ambil dari Reject_Target
  const progress = clamp((reduction / target) * 100, 0, 100);
  progressBar.style.width = progress + "%";
  progressText.textContent = progress.toFixed(0) + "% dari target";

  // status
  const pill = statusText.querySelector(".status-pill");
  let pillClass = "neutral";
  let message =
    "Menunggu cukup data untuk menilai dampak pengurangan reject...";

  if (stats.total >= 5) {
    if (reduction >= target) {
      pillClass = "good";
      message =
        "✅ Target tercapai: reject turun " +
        reduction.toFixed(1) +
        "% dibanding baseline.";
    } else if (reduction > 0) {
      pillClass = "neutral";
      message =
        "⚠️ Reject sudah turun " +
        reduction.toFixed(1) +
        "%, tapi belum mencapai target 30%.";
    } else {
      pillClass = "bad";
      message =
        "❌ Reject belum turun (bahkan bisa lebih tinggi dari baseline). Perlu evaluasi proses.";
    }
  }

  pill.className = "status-pill " + pillClass;
  statusText.lastElementChild.innerHTML = message;
}

function addBatchRow(batch, isRejected) {
  const tr = document.createElement("tr");

  const chip = document.createElement("span");
  chip.className = "chip";
  const dot = document.createElement("span");
  dot.className = "chip-dot " + (isRejected ? "bad" : "good");
  chip.appendChild(dot);
  chip.appendChild(
    document.createTextNode(isRejected ? "Ditolak" : "Diterima")
  );

  tr.innerHTML = `
    <td>${batch.batch_id}</td>
    <td>${formatTimeFromString(batch.timestamp)}</td>
    <td>${batch.truck_id}</td>
    <td>${batch.temperature.toFixed(1)}</td>
    <td>${batch.weight_loss.toFixed(1)}</td>
    <td></td>
  `;
  tr.children[5].appendChild(chip);

  if (batchTableBody.firstChild) {
    batchTableBody.insertBefore(tr, batchTableBody.firstChild);
  } else {
    batchTableBody.appendChild(tr);
  }
}

// ===============================
// 5) ALERT
// ===============================
function addAlert(batch, type) {
  if (alertList.querySelector(".alert-empty")) {
    alertList.innerHTML = "";
  }

  const item = document.createElement("div");
  item.className =
    "alert-item " +
    (type === "danger" ? "alert-item--danger" : "alert-item--warning");

  const labelText =
    type === "danger" ? "Reject Terdeteksi" : "Peringatan Dini";

  const mainMsg =
    type === "danger"
      ? `Batch ${batch.batch_id} melewati ambang cacat dan berpotensi ditolak.`
      : `Batch ${batch.batch_id} mendekati ambang cacat, segera lakukan tindakan pencegahan.`;

  item.innerHTML = `
    <div class="alert-top">
      <div>
        <div class="alert-label">${labelText}</div>
        <div class="alert-main">${mainMsg}</div>
      </div>
      <div class="alert-type">${formatTimeFromString(batch.timestamp)}</div>
    </div>
    <div class="alert-meta">
      <span class="alert-tag">Cacat (weight_loss): ${batch.weight_loss.toFixed(
        1
      )}%</span>
      <span class="alert-tag">Suhu: ${batch.temperature.toFixed(1)}°C</span>
      <span class="alert-tag">Ambang cacat: ${defectThreshold.toFixed(1)}%</span>
    </div>
  `;

  alertList.insertBefore(item, alertList.firstChild);

  const currentCount = parseInt(alertCounter.dataset.count || "0", 10) || 0;
  const newCount = currentCount + 1;
  alertCounter.dataset.count = String(newCount);
  alertCounter.textContent = newCount + " alert";
}

// ===============================
// 6) SIMULASI DARI SHEET CONDITION
// ===============================
function processNextBatch() {
  if (simIndex >= conditionData.length) {
    stopSimulation();
    return;
  }

  const batch = conditionData[simIndex];
  simIndex++;

  // Asumsi weight_loss % sebagai indikator cacat
  const defectPercent = batch.weight_loss;

  stats.total++;
  const isRejected = defectPercent > defectThreshold;
  if (isRejected) {
    stats.rejected++;
    addAlert(batch, "danger");
  } else {
    const earlyWarningThreshold = defectThreshold * earlyWarningFactor;
    if (defectPercent >= earlyWarningThreshold) {
      addAlert(batch, "warning");
    }
  }

  addBatchRow(batch, isRejected);
  updateMetrics();
}

function startSimulation() {
  if (simulationInterval) return;
  simIndex = 0;
  stats.total = 0;
  stats.rejected = 0;
  batchTableBody.innerHTML = "";
  alertList.innerHTML = `
    <div class="alert-empty">
      Simulasi dimulai, alert akan muncul di sini berdasarkan data Condition (After).
    </div>
  `;
  alertCounter.dataset.count = "0";
  alertCounter.textContent = "0 alert";

  simulationInterval = setInterval(processNextBatch, 1200);
  toggleSimulationBtn.innerHTML = '<span class="btn-icon">⏸</span> Hentikan';
  toggleSimulationBtn.classList.remove("btn-primary");
  toggleSimulationBtn.classList.add("btn-outline");
}

function stopSimulation() {
  if (!simulationInterval) return;
  clearInterval(simulationInterval);
  simulationInterval = null;
  toggleSimulationBtn.innerHTML =
    '<span class="btn-icon">▶</span> Jalankan Simulasi Data';
  toggleSimulationBtn.classList.add("btn-primary");
  toggleSimulationBtn.classList.remove("btn-outline");
}

// ===============================
// 7) INPUT BATCH MANUAL (PETANI / PETUGAS)
// ===============================
function handleManualBatchSubmit(event) {
  event.preventDefault(); // jangan reload halaman

  const batchId = manualBatchIdInput?.value.trim();
  const truckId = manualTruckIdInput?.value.trim();
  const tempVal = parseFloat(manualTempInput?.value);
  const defectVal = parseFloat(manualDefectInput?.value);

  if (!batchId || !truckId || isNaN(tempVal) || isNaN(defectVal)) {
    alert("Mohon isi semua field batch manual dengan benar.");
    return;
  }

  // waktu sekarang, hanya jam:menit:detik
  const now = new Date();
  const timeString = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // bentuk objek batch manual sesuai struktur yang dipakai tabel
  const batch = {
    timestamp: timeString, // formatTimeFromString akan pakai ini langsung
    batch_id: batchId,
    truck_id: truckId,
    temperature: tempVal,
    weight_loss: defectVal, // dipakai sebagai % cacat
  };

  stats.total++;
  const isRejected = defectVal > defectThreshold;

  if (isRejected) {
    stats.rejected++;
    addAlert(batch, "danger");
  } else {
    const earlyWarningThreshold = defectThreshold * earlyWarningFactor;
    if (defectVal >= earlyWarningThreshold) {
      addAlert(batch, "warning");
    }
  }

  addBatchRow(batch, isRejected);
  updateMetrics();

  manualBatchForm.reset();
}

// ===============================
// 8) EVENT UI
// ===============================
updateConfigBtn.addEventListener("click", () => {
  const newBaseline = parseFloat(baselineRejectInput.value.replace(",", "."));
  const newThreshold = parseFloat(defectThresholdInput.value.replace(",", "."));

  if (isNaN(newBaseline) || newBaseline <= 0 || newBaseline > 100) {
    alert("Baseline reject harus di antara 1–100%.");
    return;
  }

  if (isNaN(newThreshold) || newThreshold <= 0 || newThreshold > 100) {
    alert("Batas cacat maksimal harus di antara 1–100%.");
    return;
  }

  baselineReject = newBaseline;
  defectThreshold = newThreshold;

  baselineRejectText.textContent = baselineReject.toFixed(1);
  thresholdDefectText.textContent = defectThreshold.toFixed(1);
  thresholdEarlyText.textContent = (
    defectThreshold * earlyWarningFactor
  ).toFixed(1);

  baselineBadge.textContent = "Disesuaikan";

  updateMetrics();
});

toggleSimulationBtn.addEventListener("click", () => {
  if (simulationInterval) {
    stopSimulation();
  } else {
    startSimulation();
  }
});

// event untuk form input manual (kalau form-nya ada di HTML)
if (manualBatchForm) {
  manualBatchForm.addEventListener("submit", handleManualBatchSubmit);
}

// ===============================
// 9) INIT
// ===============================
(function init() {
  thresholdDefectText.textContent = defectThreshold.toFixed(1);
  thresholdEarlyText.textContent = (
    defectThreshold * earlyWarningFactor
  ).toFixed(1);
  initFromKpiData();
})();
