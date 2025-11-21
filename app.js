
// DOM elements
const tempEl = document.getElementById('temp');
const humEl = document.getElementById('hum');
const damageEl = document.getElementById('damage');
const rejectEl = document.getElementById('rejectRate');
const alertsDiv = document.getElementById('alerts');
const adviceList = document.getElementById('advice');
const toast = document.getElementById('toast');
const simulateBtn = document.getElementById('simulateBtn');

// parameter / threshold (sesuaikan dengan standar gudangmu)
const THRESHOLDS = {
  temp_high: 30,      // °C -> suhu tinggi memicu peringatan
  temp_crit: 35,
  hum_low: 40,        // % -> kelembapan terlalu rendah
  hum_high: 90,       // % -> kelembapan terlalu tinggi
  damage_index: 0.25, // > 0.25 => banyak buah rusak
};

// logika prediksi penurunan reject 30%:
// asumsi: jika sistem memberi peringatan dini dan tindakan diambil,
// maka mis. 30% buah yang akan rusak dapat diselamatkan.
// Kita tampilkan indikator progres target.
const CURRENT_REJECT_RATE = 12.5; // contoh (ambil data sebenarnya dari DB)
const TARGET_REDUCTION = 0.30; // 30%

// helper: tampilkan toast
function showToast(msg, timeout=4200){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), timeout);
}

// helper: tambahkan alert ke UI
function pushAlert(type, title, detail){
  const el = document.createElement('div');
  el.className = 'alert ' + (type || 'info');
  el.innerHTML = `<strong>${title}</strong><div style="font-size:13px;margin-top:6px">${detail}</div>`;
  alertsDiv.prepend(el);
  showToast(title);
}

// buat saran sesuai jenis alert
function adviceFor(alertKey){
  switch(alertKey){
    case 'TEMP_HIGH':
      return [
        'Kurangi suhu ruangan: hidupkan pendingin/ventilasi.',
        'Periksa aliran udara dan buka jalur ventilasi alternatif.',
        'Pindahkan pallet yang terpengaruh ke area pendinginan.'
      ];
    case 'HUM_LOW':
      return [
        'Tambahkan humidifier atau sprinkler ringan.',
        'Periksa pintu/penyegelan ruangan agar kelembapan tidak hilang.'
      ];
    case 'DAMAGE_HIGH':
      return [
        'Pisahkan buah yang rusak untuk mencegah penyebaran.',
        'Percepat proses sortir dan pengemasan.'
      ];
    default:
      return ['Monitor kondisi, tidak ada tindakan kritis saat ini.'];
  }
}

// update UI core
function updateCoreUI(data){
  tempEl.textContent = data.temp.toFixed(1);
  humEl.textContent = data.hum.toFixed(1);
  damageEl.textContent = (data.damageIndex*100).toFixed(1) + '%';
  rejectEl.textContent = data.rejectRate.toFixed(1);
}

// fungsi untuk menilai dan memicu alert
function evaluateAndAlert(data){
  // suhu
  if(data.temp >= THRESHOLDS.temp_crit){
    pushAlert('crit','Suhu KRITIS', `Suhu ${data.temp}°C > ${THRESHOLDS.temp_crit}°C — resiko penurunan kualitas tinggi.`);
    setAdvice(adviceFor('TEMP_HIGH'));
  } else if(data.temp >= THRESHOLDS.temp_high){
    pushAlert('warn','Suhu Tinggi', `Suhu ${data.temp}°C mendekati batas. Cek ventilasi/pendingin.`);
    setAdvice(adviceFor('TEMP_HIGH'));
  }

  // kelembapan
  if(data.hum <= THRESHOLDS.hum_low){
    pushAlert('warn','Kelembapan Rendah', `Kelembapan ${data.hum}% < ${THRESHOLDS.hum_low}% — risiko kehilangan kesegaran.`);
    setAdvice(adviceFor('HUM_LOW'));
  }
  if(data.hum >= THRESHOLDS.hum_high){
    pushAlert('warn','Kelembapan Tinggi', `Kelembapan ${data.hum}% tinggi — risiko jamur/kerusakan meningkat.`);
    setAdvice(adviceFor('HUM_LOW'));
  }

  // damage index
  if(data.damageIndex >= THRESHOLDS.damage_index){
    pushAlert('crit','Indeks Kerusakan Tinggi', `Indeks kerusakan ${(data.damageIndex*100).toFixed(1)}% — pisahkan dan sortir segera.`);
    setAdvice(adviceFor('DAMAGE_HIGH'));
  }
}

// set advice list UI
function setAdvice(lines){
  adviceList.innerHTML = '';
  for(const l of lines){
    const li = document.createElement('li');
    li.textContent = l;
    adviceList.appendChild(li);
  }
}

// ====================================================
// Real-time listener: ambil data sensor dari Firestore
// Struktur koleksi contoh: "sensors" -> doc "latest" (atau docs timestamped)
// ====================================================
const sensorsDocRef = db.collection('sensors').doc('latest');

sensorsDocRef.onSnapshot(doc => {
  if(!doc.exists) return;
  const data = doc.data();
  // data expected: { temp: Number, hum: Number, damageIndex: Number (0..1), rejectRate: Number }
  const normalized = {
    temp: data.temp || 0,
    hum: data.hum || 0,
    damageIndex: data.damageIndex || 0,
    rejectRate: data.rejectRate || 0
  };
  updateCoreUI(normalized);
  evaluateAndAlert(normalized);
});

// ========== SIMULATOR untuk dev (tidak untuk produksi) ==========
simulateBtn.onclick = async () => {
  const randTemp = 28 + Math.random()*10; // 28..38
  const randHum = 35 + Math.random()*60;  // 35..95
  const randDamage = Math.random()*0.5;   // 0..0.5
  const randReject = 10 + Math.random()*10;

  await db.collection('sensors').doc('latest').set({
    temp: randTemp,
    hum: randHum,
    damageIndex: randDamage,
    rejectRate: randReject,
    ts: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Simulasi data terkirim');
};
