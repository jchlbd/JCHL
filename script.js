// ============================================================
//  জামালপুর সেন্ট্রাল হাসপাতাল — script.js
//  All UI logic, search, routing. No page reloads.
// ============================================================
"use strict";

// ── State ────────────────────────────────────────────────────
const state = {
  currentPart:    null,
  currentDisease: null,
  currentDoctor:  null,
};

// ── Lookups (built once) ─────────────────────────────────────
let DB; // will hold { deptMap, doctorMap, diseaseMap, partMap, diseasesByDept, doctorsByDept, diseasesByPart }

// ── DOM refs ─────────────────────────────────────────────────
const els = {};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  DB = buildLookups();
  cacheEls();
  buildStaticUI();
  bindEvents();
  showWelcome();
});

function cacheEls() {
  const q = id => document.getElementById(id);
  els.searchInput    = q("search-input");
  els.searchResults  = q("search-results");
  els.searchClear    = q("search-clear");
  els.bodyGrid       = q("body-parts-grid");
  els.quickCats      = q("quick-cats-inner");
  els.infoPanel      = q("info-panel");
  els.doctorPanel    = q("doctor-panel");
  els.diseaseDetail  = q("disease-detail");
  els.contentArea    = q("content-area");
  els.welcomeState   = q("welcome-state");
  els.breadcrumb     = q("breadcrumb");
  els.profileOverlay = q("profile-overlay");
  els.profileModal   = q("profile-modal");
  els.statsBar       = q("stats-bar");
}

// ── Build Static / Data-Driven UI ────────────────────────────
function buildStaticUI() {
  buildBodyPartsGrid();
  buildQuickCats();
  buildStatsBar();
}

function buildBodyPartsGrid() {
  els.bodyGrid.innerHTML = BODY_PARTS.map(bp => {
    const isPath = bp.icon && (bp.icon.includes('/') || bp.icon.endsWith('.png') || bp.icon.endsWith('.svg'));
    const iconHTML = isPath
      ? `<img src="${bp.icon}" alt="${bp.name}" width="36" height="36" style="object-fit:contain" onerror="this.style.display='none'">`
      : (bp.icon || '');
    return `
    <button class="bp-btn" data-part="${bp.id}" title="${bp.name}" aria-label="${bp.name}">
      <span class="bp-icon">${iconHTML}</span>
      <span class="bp-label">${bp.name}</span>
    </button>`;
  }).join('');

  els.bodyGrid.addEventListener("click", e => {
    const btn = e.target.closest(".bp-btn");
    if (!btn) return;
    const partId = btn.dataset.part;
    selectBodyPart(partId);
  });
}

function buildQuickCats() {
  els.quickCats.innerHTML = DEPARTMENTS.map(d => `
    <button class="cat-chip" data-dept="${d.id}">${d.icon} ${d.name}</button>
  `).join('');

  els.quickCats.addEventListener("click", e => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    selectDepartment(chip.dataset.dept);
  });
}

function buildStatsBar() {
  els.statsBar.innerHTML = `
    <div class="stat-card">
      <span class="stat-icon">🩺</span>
      <div>
        <div class="stat-val">${DOCTORS.length}</div>
        <div class="stat-lbl">জন বিশেষজ্ঞ ডাক্তার</div>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">🦠</span>
      <div>
        <div class="stat-val">${DISEASES.length}</div>
        <div class="stat-lbl">টি রোগ</div>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">🏥</span>
      <div>
        <div class="stat-val">${DEPARTMENTS.length}</div>
        <div class="stat-lbl">বিভাগ</div>
      </div>
    </div>
  `;
}

// ── Events ───────────────────────────────────────────────────
function bindEvents() {
  // Search
  els.searchInput.addEventListener("input", onSearchInput);
  els.searchInput.addEventListener("focus", onSearchInput);
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) closeSearch();
  });
  els.searchClear.addEventListener("click", () => {
    els.searchInput.value = "";
    els.searchClear.classList.remove("visible");
    closeSearch();
    els.searchInput.focus();
  });
  // Profile modal close
  els.profileOverlay.addEventListener("click", e => {
    if (e.target === els.profileOverlay) closeProfile();
  });
  // Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (els.profileOverlay.classList.contains("open")) closeProfile();
      else closeSearch();
    }
  });
}

// ── SEARCH ───────────────────────────────────────────────────
function onSearchInput() {
  const q = els.searchInput.value.trim();
  els.searchClear.classList.toggle("visible", q.length > 0);
  if (!q) { closeSearch(); return; }
  const results = runSearch(q);
  renderSearchResults(results, q);
}

function runSearch(q) {
  const lq = q.toLowerCase();
  const diseases = DISEASES.filter(d =>
    d.name.includes(q) ||
    d.nameEn.toLowerCase().includes(lq) ||
    d.keywords.some(k => k.toLowerCase().includes(lq))
  ).slice(0, 6);

  const doctors = DOCTORS.filter(d =>
    d.name.includes(q) ||
    d.designation.toLowerCase().includes(lq) ||
    d.degrees.toLowerCase().includes(lq)
  ).slice(0, 4);

  const depts = DEPARTMENTS.filter(d =>
    d.name.includes(q) ||
    d.id.toLowerCase().includes(lq)
  ).slice(0, 4);

  return { diseases, doctors, depts };
}

function renderSearchResults({ diseases, doctors, depts }, q) {
  const total = diseases.length + doctors.length + depts.length;
  if (total === 0) {
    els.searchResults.innerHTML = `<div class="sr-empty">❌ "<strong>${esc(q)}</strong>" — কোনো ফলাফল পাওয়া যায়নি</div>`;
    els.searchResults.classList.add("open");
    return;
  }
  let html = '';
  if (diseases.length) {
    html += `<div class="sr-section-label">🦠 রোগ / লক্ষণ</div>`;
    diseases.forEach(d => {
      const dept = DB.deptMap[d.department];
      html += `<div class="sr-item" data-action="disease" data-id="${d.id}">
        <span class="sr-item-icon">🔴</span>
        <div class="sr-item-text">
          <div class="sr-item-name">${d.name}</div>
          <div class="sr-item-meta">${dept ? dept.name : ''} · ${d.nameEn}</div>
        </div>
      </div>`;
    });
  }
  if (doctors.length) {
    html += `<div class="sr-section-label">🩺 ডাক্তার</div>`;
    doctors.forEach(d => {
      const deptIds = Array.isArray(d.departments) ? d.departments : [d.departments];
      const firstDept = DB.deptMap[deptIds[0]];
      html += `<div class="sr-item" data-action="doctor" data-id="${d.id}">
        <span class="sr-item-icon">👨‍⚕️</span>
        <div class="sr-item-text">
          <div class="sr-item-name">${d.name}</div>
          <div class="sr-item-meta">${firstDept ? firstDept.name : ''} · ${d.chamber || ''}</div>
        </div>
      </div>`;
    });
  }
  if (depts.length) {
    html += `<div class="sr-section-label">🏥 বিভাগ</div>`;
    depts.forEach(d => {
      html += `<div class="sr-item" data-action="dept" data-id="${d.id}">
        <span class="sr-item-icon">${d.icon}</span>
        <div class="sr-item-text">
          <div class="sr-item-name">${d.name}</div>
          <div class="sr-item-meta">বিভাগ</div>
        </div>
      </div>`;
    });
  }
  els.searchResults.innerHTML = html;
  els.searchResults.classList.add("open");

  // Bind result clicks
  els.searchResults.querySelectorAll(".sr-item").forEach(item => {
    item.addEventListener("click", () => {
      const { action, id } = item.dataset;
      closeSearch();
      els.searchInput.value = "";
      els.searchClear.classList.remove("visible");
      if (action === "disease") showDiseaseDetail(id);
      else if (action === "doctor") openDoctorProfile(id);
      else if (action === "dept") selectDepartment(id);
    });
  });
}

function closeSearch() {
  els.searchResults.classList.remove("open");
}

// ── BODY PART SELECTION ───────────────────────────────────────
function selectBodyPart(partId) {
  state.currentPart    = partId;
  state.currentDisease = null;
  state.currentDoctor  = null;

  // Highlight
  document.querySelectorAll(".bp-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.part === partId)
  );
  // Deactivate dept chips
  document.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));

  const part = DB.partMap[partId];
  if (!part) return;

  showInfoPanel(part);
  scrollToContent();
}

function showInfoPanel(part) {
  // Hide welcome
  els.welcomeState.style.display = "none";

  // Gather diseases for this part
  const diseases = (DB.diseasesByPart[part.id] || []);

  // Gather departments
  const depts = part.departments.map(did => DB.deptMap[did]).filter(Boolean);

  els.infoPanel.innerHTML = `
    <div class="panel-hero">
      <span class="panel-hero-icon">
        ${part.icon ? `<img src="${part.icon}" alt="${part.name}" width="48" height="48" style="object-fit:contain;filter:brightness(0) invert(1)" onerror="this.style.display='none'">` : ''}
      </span>
      <div>
        <div class="panel-hero-title">${part.name}</div>
        <div class="panel-hero-sub">
          ${depts.map(d => d.name).join(' &nbsp;·&nbsp; ')}
        </div>
      </div>
    </div>
    <div class="panel-body">
      <div id="breadcrumb">
        <span class="bc-item" onclick="showWelcome()">🏠 হোম</span>
        <span class="bc-sep">›</span>
        <span class="bc-current">${part.name}</span>
      </div>
      <div class="section-title" style="margin-top:14px">সম্পর্কিত রোগসমূহ (${diseases.length})</div>
      ${diseases.length
        ? `<div class="disease-grid">
            ${diseases.map(d => renderDiseaseCard(d)).join('')}
           </div>`
        : `<p style="color:var(--gray-500);font-size:14px">এই অংশে কোনো রোগের তথ্য নেই।</p>`
      }
    </div>
  `;
  els.infoPanel.classList.add("visible");

  // Show doctors for all departments of this part
  const allDocs = [];
  depts.forEach(dept => {
    (DB.doctorsByDept[dept.id] || []).forEach(doc => {
      if (!allDocs.find(d => d.id === doc.id)) allDocs.push(doc);
    });
  });
  renderDoctorPanel(`${part.name} — সংশ্লিষ্ট ডাক্তার`, allDocs);

  // Hide disease detail
  els.diseaseDetail.classList.remove("visible");

  // Disease card click
  els.infoPanel.querySelectorAll(".disease-card").forEach(card => {
    card.addEventListener("click", () => showDiseaseDetail(card.dataset.id));
  });
}

// ── DEPARTMENT SELECTION ─────────────────────────────────────
function selectDepartment(deptId) {
  state.currentPart    = null;
  state.currentDisease = null;

  document.querySelectorAll(".cat-chip").forEach(c =>
    c.classList.toggle("active", c.dataset.dept === deptId)
  );
  document.querySelectorAll(".bp-btn").forEach(b => b.classList.remove("active"));

  const dept = DB.deptMap[deptId];
  if (!dept) return;

  const diseases = DB.diseasesByDept[deptId] || [];
  const doctors  = DB.doctorsByDept[deptId]  || [];

  els.welcomeState.style.display = "none";

  els.infoPanel.innerHTML = `
    <div class="panel-hero">
      <span class="panel-hero-icon" style="font-size:36px">${dept.icon || ''}</span>
      <div>
        <div class="panel-hero-title">${dept.name}</div>
        <div class="panel-hero-sub">${diseases.length}টি রোগ &nbsp;·&nbsp; ${doctors.length} জন ডাক্তার</div>
      </div>
    </div>
    <div class="panel-body">
      <div id="breadcrumb">
        <span class="bc-item" onclick="showWelcome()">🏠 হোম</span>
        <span class="bc-sep">›</span>
        <span class="bc-current">${dept.name}</span>
      </div>
      <div class="section-title" style="margin-top:14px">চিকিৎসযোগ্য রোগসমূহ (${diseases.length})</div>
      ${diseases.length
        ? `<div class="disease-grid">
            ${diseases.map(d => renderDiseaseCard(d)).join('')}
           </div>`
        : `<p style="color:var(--gray-500);font-size:14px">তথ্য পাওয়া যায়নি।</p>`
      }
    </div>
  `;
  els.infoPanel.classList.add("visible");
  renderDoctorPanel(`${dept.name} — ডাক্তারগণ`, doctors);
  els.diseaseDetail.classList.remove("visible");

  els.infoPanel.querySelectorAll(".disease-card").forEach(card => {
    card.addEventListener("click", () => showDiseaseDetail(card.dataset.id));
  });

  scrollToContent();
}

// ── DISEASE DETAIL ─────────────────────────────────────────────
function showDiseaseDetail(diseaseId) {
  state.currentDisease = diseaseId;
  const disease = DB.diseaseMap[diseaseId];
  if (!disease) return;

  const dept = DB.deptMap[disease.department];
  const part = DB.partMap[disease.bodyPart];

  // Find doctors who treat this disease
  const doctors = DOCTORS.filter(d => d.diseases.includes(diseaseId));

  // icon path কিনা চেক করে — path হলে img tag, emoji হলে text
  function partIconHTML(p) {
    if (!p || !p.icon) return '';
    const isPath = p.icon.includes('/') || p.icon.endsWith('.png') || p.icon.endsWith('.svg');
    return isPath
      ? `<img src="${p.icon}" alt="${p.name}" width="32" height="32" style="object-fit:contain;filter:brightness(0) invert(1);vertical-align:middle;margin-right:6px" onerror="this.style.display='none'">`
      : `${p.icon} `;
  }

  els.diseaseDetail.innerHTML = `
    <div class="dd-hero">
      <div class="dd-hero-title">${partIconHTML(part)}${disease.name}</div>
      <div class="dd-hero-en">${disease.nameEn}</div>
      <div class="dd-hero-dept">${dept ? dept.name : ''}</div>
    </div>
    <div class="dd-body">
      <button class="back-btn" onclick="goBackFromDisease()">← পেছনে যান</button>
      <div id="breadcrumb">
        <span class="bc-item" onclick="showWelcome()">🏠 হোম</span>
        <span class="bc-sep">›</span>
        ${part ? `<span class="bc-item" onclick="selectBodyPart('${part.id}')">${part.name}</span><span class="bc-sep">›</span>` : ''}
        <span class="bc-current">${disease.name}</span>
      </div>
      <div class="section-title" style="margin-top:14px">সংশ্লিষ্ট তথ্য</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <span class="badge badge-blue">${dept ? dept.name : ''}</span>
        ${part ? `<span class="badge badge-green">${part.name}</span>` : ''}
        <span class="badge badge-red">👨‍⚕️ ${doctors.length} জন ডাক্তার</span>
      </div>
      <div class="section-title">অনুসন্ধান কীওয়ার্ড</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        ${disease.keywords.map(k => `<span class="badge badge-blue" style="font-size:12px">${k}</span>`).join('')}
      </div>
    </div>
  `;
  els.diseaseDetail.classList.add("visible");

  // Highlight active disease card if visible
  document.querySelectorAll(".disease-card").forEach(c =>
    c.classList.toggle("active", c.dataset.id === diseaseId)
  );

  // Update doctor panel
  renderDoctorPanel(`🦠 "${disease.name}" — চিকিৎসাকারী ডাক্তার`, doctors);

  scrollToContent();
}

function goBackFromDisease() {
  state.currentDisease = null;
  els.diseaseDetail.classList.remove("visible");
  document.querySelectorAll(".disease-card").forEach(c => c.classList.remove("active"));
  if (state.currentPart) {
    renderDoctorPanel(
      `${DB.partMap[state.currentPart]?.name || ''} — সংশ্লিষ্ট ডাক্তার`,
      getDoctorsForPart(state.currentPart)
    );
  }
}

function getDoctorsForPart(partId) {
  const part  = DB.partMap[partId];
  if (!part) return [];
  const allDocs = [];
  part.departments.forEach(did => {
    (DB.doctorsByDept[did] || []).forEach(doc => {
      if (!allDocs.find(d => d.id === doc.id)) allDocs.push(doc);
    });
  });
  return allDocs;
}

// ── DOCTOR PANEL ──────────────────────────────────────────────
function renderDoctorPanel(title, doctors) {
  if (!doctors || doctors.length === 0) {
    els.doctorPanel.classList.remove("visible");
    return;
  }
  els.doctorPanel.innerHTML = `
    <div class="dp-header">🩺 ${stripImgTags(title)} (${doctors.length} জন)</div>
    <div class="doctor-cards">
      ${doctors.map(d => renderDoctorCard(d)).join('')}
    </div>
  `;
  els.doctorPanel.classList.add("visible");

  // Click to open profile
  els.doctorPanel.querySelectorAll(".doctor-card").forEach(card => {
    card.addEventListener("click", () => openDoctorProfile(card.dataset.docId));
  });
}

function renderDoctorCard(doc) {
  const depts = (Array.isArray(doc.departments) ? doc.departments : [doc.departments])
              .map(did => DB.deptMap[did]).filter(Boolean);
  const avatar = avatarHTML(doc);
  const scheduleHTML = doc.schedule.slice(0, 2).map(s =>
    `<div class="sch-row"><span class="sch-day">${s.day}</span><span class="sch-time">${s.time}</span></div>`
  ).join('');

  return `
    <div class="doctor-card" data-doc-id="${doc.id}">
      <div class="doc-card-header">
        <div class="doc-avatar">${avatar}</div>
        <div>
          <div class="doc-name">${doc.name}</div>
          <div class="doc-desig">${doc.designation}</div>
        </div>
      </div>
      <div class="doc-card-body">
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
  ${depts.map(d => `<div class="doc-dept-tag">${d.icon} ${d.name}</div>`).join('')}
</div>
        <div class="doc-schedule-mini">${scheduleHTML}</div>
        <div style="font-size:12px;color:var(--gray-500);margin-top:6px">🚪 ${doc.chamber}</div>
      </div>
    </div>
  `;
}

// ── DOCTOR PROFILE MODAL ──────────────────────────────────────
function openDoctorProfile(docId) {
  const doc = DB.doctorMap[docId];
  if (!doc) return;
  const depts = (Array.isArray(doc.departments) ? doc.departments : [doc.departments])
              .map(did => DB.deptMap[did]).filter(Boolean);
  const avatar = avatarHTML(doc, true);

  // Diseases this doctor treats
  const diseases = doc.diseases.map(id => DB.diseaseMap[id]).filter(Boolean);

  const schedHTML = doc.schedule.map(s => `
    <tr>
      <td class="pm-day-cell">${s.day}</td>
      <td class="pm-time-cell">${s.time}</td>
    </tr>
  `).join('');

  const diseaseTags = diseases.map(d =>
    `<span class="pm-disease-tag" data-id="${d.id}" title="${d.nameEn}">${d.name}</span>`
  ).join('');

  els.profileModal.innerHTML = `
    <div class="pm-hero">
      <div class="pm-avatar">${avatar}</div>
      <div class="pm-info">
        <div class="pm-name">${doc.name}</div>
        <div class="pm-desig">${doc.designation}</div>
        <div class="pm-deg">${doc.degrees}</div>
      </div>
      <button class="pm-close" onclick="closeProfile()" aria-label="বন্ধ করুন">✕</button>
    </div>
    <div class="pm-body">
      <div class="pm-section">
        <div class="pm-section-title">বিভাগ ও কক্ষ</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          ${depts.length ? depts.map(d => `<span class="pm-dept-badge">${d.name}</span>`).join('') : '<span class="pm-dept-badge">বিভাগ নির্ধারিত নয়</span>'}
          <span class="pm-room">🚪 ${doc.chamber}</span>
        </div>
        

      <div class="pm-section">
        <div class="pm-section-title">চেম্বার সময়সূচি</div>
        <table class="pm-schedule-table">
          <thead>
            <tr><th>বার</th><th>সময়</th></tr>
          </thead>
          <tbody>${schedHTML}</tbody>
        </table>
      </div>

      <div class="pm-section">
        <div class="pm-section-title">চিকিৎসযোগ্য রোগসমূহ (${diseases.length}টি)</div>
        <div class="pm-disease-tags">${diseaseTags}</div>
      </div>

      <div class="pm-section">
        <div class="pm-section-title">🧪 টেস্টসমূহ ও মূল্য</div>
        ${doc.tests && doc.tests.length > 0
          ? `<table class="pm-tests-table">
              <thead>
                <tr><th>টেস্টের নাম</th><th>মূল্য (টাকা)</th></tr>
              </thead>
              <tbody>
                ${doc.tests.map(t => `
                  <tr>
                    <td>${t.name}</td>
                    <td class="pm-tests-price">৳ ${t.price}</td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
          : `<p class="pm-no-tests">এই ডাক্তারের জন্য কোনো টেস্ট তথ্য যোগ করা হয়নি।</p>`
        }
      </div>

      ${doc.visitFee
          ? (typeof doc.visitFee === 'object'
            ? `<div class="pm-visit-fee-wrap">
                 <div class="pm-visit-row pm-visit-new">
                   <span class="pm-visit-type">🆕 নতুন রোগী</span>
                   <span class="pm-visit-price">৳ ${doc.visitFee.new} টাকা</span>
                 </div>
                 <div class="pm-visit-divider"></div>
                 <div class="pm-visit-row pm-visit-old">
                   <span class="pm-visit-type">🔄 পুরাতন রোগী</span>
                   <span class="pm-visit-price">৳ ${doc.visitFee.old} টাকা</span>
                 </div>
               </div>
               ${doc.visitFee.note ? `<p class="pm-visit-note">⚠️ ${doc.visitFee.note}</p>` : ''}`
            : `<div class="pm-visit-fee-wrap">
                 <div class="pm-visit-row pm-visit-new" style="flex:1">
                   <span class="pm-visit-type">💳 ডাক্তার ভিজিট</span>
                   <span class="pm-visit-price">৳ ${doc.visitFee} টাকা</span>
                 </div>
               </div>`)
          : ''
        }
      </div>

      <div class="pm-appointment-wrap">
        <a
          href="https://jchlbd.com/appointment"
          target="_blank"
          rel="noopener noreferrer"
          class="pm-appointment-btn"
        >
          📅 সিরিয়াল নিন
        </a>
      </div>

    </div>
  `;
  els.profileOverlay.classList.add("open");

  // Click disease tag → open disease detail
  els.profileModal.querySelectorAll(".pm-disease-tag").forEach(tag => {
    tag.addEventListener("click", () => {
      closeProfile();
      showDiseaseDetail(tag.dataset.id);
    });
  });
}

function closeProfile() {
  els.profileOverlay.classList.remove("open");
}

// ── WELCOME ───────────────────────────────────────────────────
function showWelcome() {
  state.currentPart    = null;
  state.currentDisease = null;
  state.currentDoctor  = null;

  document.querySelectorAll(".bp-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));

  els.infoPanel.classList.remove("visible");
  els.doctorPanel.classList.remove("visible");
  els.diseaseDetail.classList.remove("visible");
  els.welcomeState.style.display = "block";
}

// ── HELPERS ───────────────────────────────────────────────────
function renderDiseaseCard(d) {
  const dept = DB.deptMap[d.department];
  return `
    <div class="disease-card" data-id="${d.id}">
      <div class="dc-name">${d.name}</div>
      <div class="dc-dept">${dept ? dept.name : ''}</div>
      <div class="dc-en">${d.nameEn}</div>
    </div>
  `;
}

function avatarHTML(doc, large = false) {
  if (doc.photo) {
    return `<img src="${doc.photo}" alt="${doc.name}" 
            style="width:100%;height:100%;object-fit:cover;border-radius:50%"
            onerror="this.style.display='none';this.nextSibling.style.display='flex'">
            <span style="display:none;font-size:${large?'36':'26'}px;
            color:rgba(255,255,255,.9);width:100%;height:100%;
            align-items:center;justify-content:center">
              ${doc.name.replace("ডাঃ ", "").trim()[0] || "ড"}
            </span>`;
  }
  const firstChar = doc.name.replace("ডাঃ ", "").trim()[0] || "ড";
  return `<span style="font-size:${large?'36':'26'}px;color:rgba(255,255,255,.9)">${firstChar}</span>`;
}

function stripImgTags(str) {
  return String(str).replace(/<img[^>]*>/gi, '').replace(/assets\/[^\s'"<>]*/gi, '').trim();
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scrollToContent() {
  const top = els.infoPanel.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

// Expose to inline onclick attributes
window.showWelcome       = showWelcome;
window.closeProfile      = closeProfile;
window.selectBodyPart    = selectBodyPart;
window.selectDepartment  = selectDepartment;
window.showDiseaseDetail = showDiseaseDetail;
window.goBackFromDisease = goBackFromDisease;

// ── TESTS PANEL ───────────────────────────────────────────────
function openTestsPanel() {
  const overlay = document.getElementById("tests-overlay");
  const searchEl = document.getElementById("tests-search");
  if (!overlay) return;
  searchEl.value = "";
  renderTestsPanel(HOSPITAL_TESTS);
  overlay.classList.add("open");
  overlay.onclick = function(e) {
    if (e.target === this) closeTestsPanel();
  };
  setTimeout(() => searchEl.focus(), 100);
}

function closeTestsPanel() {
  const overlay = document.getElementById("tests-overlay");
  if (overlay) overlay.classList.remove("open");
}

function filterTests(q) {
  if (!q.trim()) {
    renderTestsPanel(HOSPITAL_TESTS);
    return;
  }
  const lq = q.toLowerCase();
  const filtered = HOSPITAL_TESTS.filter(t =>
    t.name.toLowerCase().includes(lq) ||
    (t.short && t.short.toLowerCase().includes(lq)) ||
    t.category.includes(q)
  );
  renderTestsPanel(filtered, q);
}

function renderTestsPanel(tests, query = "") {
  const body = document.getElementById("tests-body");
  if (!body) return;

  // পুরনো footer সরাও
  const oldFooter = document.querySelector(".tp-total");
  if (oldFooter) oldFooter.remove();

  if (!tests || tests.length === 0) {
    body.innerHTML = `<div class="tp-empty">❌ "${esc(query)}" — কোনো টেস্ট পাওয়া যায়নি</div>`;
    return;
  }

  // Category অনুযায়ী group করো
  const grouped = {};
  tests.forEach(t => {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  });

  let html = '';
  let serial = 1;
  Object.keys(grouped).forEach(cat => {
    html += `<div class="tp-category">${cat} <span style="font-weight:400;opacity:.7">(${grouped[cat].length})</span></div>`;
    grouped[cat].forEach(t => {
      const shortBadge = t.short && t.short !== 'NaN' && t.short !== ''
        ? `<span style="font-size:11px;color:var(--blue-700);background:var(--blue-50);border-radius:4px;padding:1px 6px;margin-left:6px;font-family:var(--font-ui)">${t.short}</span>`
        : '';
      html += `
        <div class="tp-row">
          <span class="tp-row-name">${serial++}. ${t.name}${shortBadge}</span>
          <span class="tp-row-price">৳ ${t.price}</span>
        </div>`;
    });
  });

  body.innerHTML = html;

  // Footer — total count
  const footer = document.createElement('div');
  footer.className = 'tp-total';
  footer.textContent = `মোট ${tests.length}টি টেস্ট`;
  body.insertAdjacentElement('afterend', footer);
}

window.openTestsPanel  = openTestsPanel;
window.closeTestsPanel = closeTestsPanel;
window.filterTests     = filterTests;
