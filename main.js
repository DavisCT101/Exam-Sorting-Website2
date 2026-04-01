// Simple client logic for the demo
const STATE = {
  exams: [],
  sortKey: null,
  sortDir: 1,
  showAll: false,
  totalCount: 0,
};

const el = (id) => document.getElementById(id);
const tbody = () => el('examsTable').querySelector('tbody');

async function tryFetch(paths) {
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) return res.json();
    } catch (e) {
      // ignore and try next
    }
  }
  throw new Error('Could not fetch exams_data.json from any known path');
}

function fetchData() {
  // try local paths so demo works when served from simple-demo or from repo root
  const candidates = ['exams_data.json', '../exams_data.json', '/exams_data.json'];
  return tryFetch(candidates);
}

function uniqueNormalized(arr, key) {
  // return unique values preserving first-seen original casing/spacing
  const map = new Map();
  for (const item of arr) {
    const raw = item[key] || '';
    const norm = raw.trim().toLowerCase();
    if (!norm) continue;
    if (!map.has(norm)) map.set(norm, raw.trim());
  }
  return Array.from(map.values()).sort((a,b) => a.localeCompare(b));
}

function dedupeExams(arr) {
  const map = new Map();
  for (const e of arr) {
    // build a stable key out of main identifying fields
    const key = [e.day||'', e.timeSlot||'', (e.programme||'').trim().toLowerCase(), (e.unitCode||'').trim().toLowerCase(), (e.venue||'').trim().toLowerCase()].join('|');
    if (!map.has(key)) map.set(key, e);
  }
  return Array.from(map.values());
}

function populateFilters() {
  // Clear previous options (safety if populateFilters is called more than once)
  const dlist = el('programmeOptions'); dlist.innerHTML = '';
  const yearSel = el('yearFilter'); yearSel.innerHTML = '<option value="">All</option>';
  const daySel = el('dayFilter'); daySel.innerHTML = '<option value="">All</option>';

  // mark populated so subsequent calls are no-op
  if (dlist.dataset.populated === '1') return;

  const programmes = uniqueNormalized(STATE.exams, 'programme');
  programmes.forEach(p => { const opt = document.createElement('option'); opt.value = p; dlist.appendChild(opt); });

  const years = uniqueNormalized(STATE.exams, 'yearSemester');
  years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); });

  const days = uniqueNormalized(STATE.exams, 'day');
  days.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; daySel.appendChild(o); });
  dlist.dataset.populated = '1';

  // setup mobile-friendly suggestions (fallback for devices without datalist support)
  const suggestions = el('programmeSuggestions');
  suggestions.innerHTML = '';
  programmes.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p;
    b.addEventListener('click', () => {
      el('programmeFilter').value = p;
      suggestions.style.display = 'none';
    });
    suggestions.appendChild(b);
  });
}

function renderRows(list, limit) {
  const body = tbody();
  body.innerHTML = '';
  const toRender = (typeof limit === 'number') ? list.slice(0, limit) : list;
  toRender.forEach(row => {
    const tr = document.createElement('tr');
    ['day','timeSlot','programme','unitCode','unitName','venue'].forEach(k => {
      const td = document.createElement('td'); td.textContent = row[k] || ''; tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function applyFilters() {
  let res = STATE.exams.slice();
  const prog = el('programmeFilter').value.trim().toLowerCase();
  const year = el('yearFilter').value;
  const day = el('dayFilter').value;
  const text = el('textSearch').value.trim().toLowerCase();

  if (prog) res = res.filter(x => (x.programme||'').toLowerCase().includes(prog));
  if (year) res = res.filter(x => (x.yearSemester||'') === year);
  if (day) res = res.filter(x => (x.day||'') === day);
  if (text) res = res.filter(x => ((x.unitName||'') + ' ' + (x.unitCode||'') + ' ' + (x.venue||'')).toLowerCase().includes(text));

  if (STATE.sortKey) {
    res.sort((a,b) => {
      const A = (a[STATE.sortKey]||'').toString();
      const B = (b[STATE.sortKey]||'').toString();
      return A.localeCompare(B) * STATE.sortDir;
    });
  }

  // limit to 200 rows by default for demo performance
  const limit = STATE.showAll ? undefined : 200;
  renderRows(res, limit);
  updateCounts(res.length);
}

function updateCounts(visibleCount) {
  const countsEl = el('counts');
  countsEl.textContent = `Loaded: ${STATE.totalCount} exams — Showing: ${visibleCount}`;
}

function resetFilters() {
  el('programmeFilter').value = '';
  el('yearFilter').selectedIndex = 0;
  el('dayFilter').selectedIndex = 0;
  el('textSearch').value = '';
  STATE.sortKey = null; STATE.sortDir = 1;
  const limit = STATE.showAll ? undefined : 200;
  renderRows(STATE.exams, limit);
  updateCounts(STATE.exams.length);
}

function setupInteractions() {
  el('apply').addEventListener('click', applyFilters);
  el('reset').addEventListener('click', resetFilters);
  el('showAll').addEventListener('click', () => {
    STATE.showAll = !STATE.showAll;
    el('showAll').textContent = STATE.showAll ? 'Show first 200' : 'Show all';
    applyFilters();
  });

  // table sorting
  document.querySelectorAll('#examsTable thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (STATE.sortKey === key) STATE.sortDir = -STATE.sortDir; else { STATE.sortKey = key; STATE.sortDir = 1; }
      applyFilters();
    });
  });
}

// init
fetchData().then(data => {
  const loaded = Array.isArray(data) ? data : [];
  STATE.totalCount = loaded.length;
  STATE.exams = dedupeExams(loaded);
  populateFilters();
  setupInteractions();
  const limit = STATE.showAll ? undefined : 200;
  renderRows(STATE.exams, limit);
  updateCounts(STATE.exams.length);
}).catch(err => {
  console.error('Failed to load exams_data.json', err);
  const body = tbody(); body.innerHTML = '<tr><td colspan="6">Failed to load data. Check exams_data.json is present.</td></tr>';
});
// Simple Exam Sorter Demo
// Loads /exams_data.json from the repo root (serve the repo root with a static server)

const tableBody = document.querySelector('#examsTable tbody');
const programmeFilter = document.getElementById('programmeFilter');
const programmeOptions = document.getElementById('programmeOptions');
const yearFilter = document.getElementById('yearFilter');
const programmeSuggestions = document.getElementById('programmeSuggestions');
const dayFilter = document.getElementById('dayFilter');
const textSearch = document.getElementById('textSearch');
const applyBtn = document.getElementById('apply');
const resetBtn = document.getElementById('reset');

let exams = [];
let currentSort = { key: null, asc: true };

async function loadData() {
  try {
    const res = await fetch('/exams_data.json');
    if (!res.ok) throw new Error('Failed to load exams_data.json: ' + res.status);
    exams = await res.json();
    populateFilters();
    renderTable(exams.slice(0, 200)); // show first 200 by default for performance
  } catch (e) {
  tableBody.innerHTML = `<tr><td colspan="6">Error loading data: ${e.message}</td></tr>`;
    console.error(e);
  }
}

function populateFilters() {
  const programmes = Array.from(new Set(exams.map(e => e.programme))).sort();
  // populate datalist for searchable input
  programmes.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    programmeOptions.appendChild(opt);
  });
  // populate year options (all years)
  const years = Array.from(new Set(exams.map(e => e.yearSemester))).filter(Boolean).sort();
  years.forEach(y => yearFilter.appendChild(new Option(y, y)));

  // When the programme input changes, restrict year options to those available for the typed programme
  programmeFilter.addEventListener('input', () => {
    updateYearOptions(programmeFilter.value);
  });

  function updateYearOptions(prog) {
    // keep the 'All' default option
    while (yearFilter.options.length > 1) yearFilter.remove(1);
    let filteredExams = exams;
    if (prog && prog.trim() !== '') {
      const lower = prog.toLowerCase();
      filteredExams = exams.filter(e => e.programme && e.programme.toLowerCase().includes(lower));
    }
    const yrs = Array.from(new Set(filteredExams.map(e => e.yearSemester))).filter(Boolean).sort();
    yrs.forEach(y => yearFilter.appendChild(new Option(y, y)));
  }

  // Simple mobile-friendly suggestions fallback
  function showProgrammeSuggestions(filteredProg) {
    programmeSuggestions.innerHTML = '';
    if (!filteredProg || filteredProg.length === 0) { programmeSuggestions.style.display = 'none'; return }
    for (const p of filteredProg.slice(0, 30)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = p;
      btn.addEventListener('click', () => {
        programmeFilter.value = p;
        programmeSuggestions.style.display = 'none';
        updateYearOptions(p);
        applyFilters();
      });
      programmeSuggestions.appendChild(btn);
    }
    programmeSuggestions.style.display = 'block';
  }

  // Monitor input for fallback suggestions (works well on Android)
  programmeFilter.addEventListener('input', (ev) => {
    const v = ev.target.value.trim();
    // update year options as before
    updateYearOptions(v);
    if (!v) { programmeSuggestions.style.display = 'none'; return }
    const lower = v.toLowerCase();
    const matches = programmes.filter(p => p.toLowerCase().includes(lower));
    // Show suggestions for small screens or when datalist isn't effective
    showProgrammeSuggestions(matches);
  });

  // hide suggestions on blur (with small timeout to allow click)
  programmeFilter.addEventListener('blur', () => { setTimeout(() => programmeSuggestions.style.display = 'none', 150) });

  const days = Array.from(new Set(exams.map(e => e.day))).sort();
  days.forEach(d => dayFilter.appendChild(new Option(d, d)));
}

function applyFilters() {
  const prog = programmeFilter.value;
  const day = dayFilter.value;
  const text = textSearch.value.trim().toLowerCase();

  let filtered = exams.filter(e => {
    if (prog) {
      // make programme search substring and case-insensitive
      if (!e.programme || !e.programme.toLowerCase().includes(prog.toLowerCase())) return false;
    }
    if (day && e.day !== day) return false;
  const yr = yearFilter.value;
  if (yr && e.yearSemester !== yr) return false;
    if (text) {
      const hay = (e.unitName + ' ' + e.unitCode + ' ' + e.venue).toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  renderTable(filtered);
}

function renderTable(rows) {
  // Optionally sort
  if (currentSort.key) {
    rows.sort((a,b) => {
      const ka = a[currentSort.key];
      const kb = b[currentSort.key];
      if (typeof ka === 'number' && typeof kb === 'number') return currentSort.asc ? ka - kb : kb - ka;
      const sa = String(ka || '').toLowerCase();
      const sb = String(kb || '').toLowerCase();
      if (sa < sb) return currentSort.asc ? -1 : 1;
      if (sa > sb) return currentSort.asc ? 1 : -1;
      return 0;
    });
  }

  // Build rows (limit to 200 to keep UI responsive)
  const limited = rows.slice(0, 200);
  tableBody.innerHTML = limited.map(e => `
    <tr>
      <td>${escapeHtml(e.day)}</td>
      <td>${escapeHtml(e.timeSlot)}</td>
      <td>${escapeHtml(e.programme)}</td>
      <td>${escapeHtml(e.unitCode)}</td>
      <td>${escapeHtml(e.unitName)}</td>
      <td>${escapeHtml(e.venue)}</td>
    </tr>
  `).join('');
  if (rows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6">No results</td></tr>';
  } else if (rows.length > limited.length) {
    const moreRow = document.createElement('tr');
    moreRow.innerHTML = `<td colspan="6" class="small">Showing ${limited.length} of ${rows.length} results. Refine filters to see more.</td>`;
    tableBody.appendChild(moreRow);
  }
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Column header click -> sort
document.querySelectorAll('#examsTable th').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (!key) return;
    if (currentSort.key === key) currentSort.asc = !currentSort.asc;
    else { currentSort.key = key; currentSort.asc = true; }
    applyFilters();
  });
});

applyBtn.addEventListener('click', applyFilters);
resetBtn.addEventListener('click', () => {
  programmeFilter.value = '';
  dayFilter.value = '';
  yearFilter.value = '';
  textSearch.value = '';
  currentSort = { key: null, asc: true };
  renderTable(exams.slice(0,200));
});

loadData();
