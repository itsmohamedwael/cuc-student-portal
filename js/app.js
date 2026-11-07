/* CUC Student Portal */
(() => {
  'use strict';
  const D = window.ACADEMIC_DATA;
  if (!D) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionPreference.matches;
  motionPreference.addEventListener('change', (e) => {
    reduce = e.matches;
    if (reduce) document.getAnimations().forEach((a) => a.cancel());
  });
  const EASE = 'cubic-bezier(.16,1,.3,1)';
  const anim = (el, kf, o = {}) => {
    if (!el || reduce || !el.animate) return Promise.resolve();
    return el.animate(kf, { duration: o.d || 700, delay: o.delay || 0, easing: o.e || EASE, fill: 'both' }).finished.catch(() => {});
  };

  const KEY_USER = 'cucsp_user', KEY_THEME = 'cucsp_theme', KEY_EXAM = 'cucsp_exam_view';
  const ALIASES = { '2603010058': '26030100058' };
  const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const JS_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const EXAM_WINDOW = [new Date(2026, 10, 6, 0, 0), new Date(2026, 10, 14, 23, 59)];

  const state = { user: null, view: 'home', day: null, examView: true, openSubject: null };

  /* ---------- helpers ---------- */
  const fmt12 = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`; };
  const ampm = (t) => (Number(t.split(':')[0]) >= 12 ? 'PM' : 'AM');
  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hallInfo = (r) => {
    if (r === 'Not listed') return 'Check with the exams office';
    if (!r || r === 'ONLINE') return 'Online session';
    const m = /B(\d)-(\d)/.exec(r);
    return m ? `Building ${m[1]} · Floor ${m[2]}` : r;
  };
  const roomText = (r) => (!r || r === 'ONLINE' ? 'Online' : r);
  const inWindow = (d = new Date()) => d >= EXAM_WINDOW[0] && d <= EXAM_WINDOW[1];
  const examViewOn = () => inWindow() && state.examView;
  const firstName = (n) => (n || '').split(' ')[0];

  const sessionsFor = (g) => D.weekly_sessions.filter((s) => s.group === g);

  function hallFor(g, code) {
    const list = D.exam_seating.filter((e) => e.group_number === g && e.course_code === code);
    if (!list.length) return { hall: 'Not listed', seats: '' };
    const id = Number(state.user.id);
    let hit = list.find((a) => a.from_student === 'All' || (id >= Number(a.from_student) && id <= Number(a.to_student)));
    if (!hit && list.length) {
      hit = id < Number(list[0].from_student) ? list[0] : list[list.length - 1];
    }
    if (hit) return { hall: hit.hall, seats: list.length > 1 ? `Seat range ${hit.from_student} - ${hit.to_student}` : '' };
    return { hall: 'Not listed', seats: 'Your ID is not in the published hall list for this exam. Please confirm with the exams office.' };
  }

  function examsFor(g) {
    const id = Number(state.user.id);
    return D.subjects.map((s) => {
      const [dd, mm, yy] = s.exam_date.split('/').map(Number);
      const allHalls = D.exam_seating
        .filter((e) => e.group_number === g && e.course_code === s.code)
        .map((a, idx) => {
          const isMine = a.from_student === 'All' || (id >= Number(a.from_student) && id <= Number(a.to_student));
          return {
            ...a,
            isMine,
            label: `Hall ${idx + 1}`
          };
        });
      let myHall = allHalls.find((h) => h.isMine);
      if (!myHall && allHalls.length) {
        myHall = id < Number(allHalls[0].from_student) ? allHalls[0] : allHalls[allHalls.length - 1];
        myHall.isMine = true;
      }
      return {
        ...s,
        start: new Date(yy, mm - 1, dd, 10, 0),
        end: new Date(yy, mm - 1, dd, 11, 0),
        hall: myHall ? myHall.hall : 'Not listed',
        seats: allHalls.length > 1 && myHall ? `Seat range ${myHall.from_student} - ${myHall.to_student}` : '',
        allHalls,
        myHall
      };
    }).sort((a, b) => a.start - b.start);
  }

  const dateParts = (d) => ({
    day: d.getDate(),
    mon: MONTHS[d.getMonth()],
    wd: JS_DAY[d.getDay()]
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function lines(root) {
    $$('.ln > span', root).forEach((s) => { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
  }

  function rollNumber(el, value = el.dataset.numberValue || el.textContent) {
    const previous = el.dataset.numberValue;
    if (previous === value) return;
    el.dataset.numberValue = value;
    if (reduce || !/\d/.test(value)) { el.textContent = value; return; }
    const label = document.createElement('span');
    label.className = 'number-label';
    label.textContent = value;
    const visual = document.createElement('span');
    visual.className = 'number-visual';
    visual.setAttribute('aria-hidden', 'true');
    const compact = matchMedia('(max-width: 600px)').matches;
    const steps = compact ? 5 : 10;
    const tracks = [];
    [...value].forEach((char, index) => {
      if (!/\d/.test(char)) { visual.append(document.createTextNode(char)); return; }
      const wheel = document.createElement('span');
      wheel.className = 'number-wheel';
      const track = document.createElement('span');
      track.className = 'number-track';
      const changed = !previous || previous[index] !== char;
      const start = previous && /\d/.test(previous[index]) ? Number(previous[index]) : (Number(char) - steps + 10) % 10;
      const count = changed ? steps : 0;
      for (let step = 0; step <= count; step++) {
        const digit = document.createElement('span');
        digit.textContent = step === count ? char : String((start + step) % 10);
        track.append(digit);
      }
      const end = `translateY(-${count * 1.15}em)`;
      track.style.transform = end;
      wheel.append(track);
      visual.append(wheel);
      if (changed) tracks.push({ track, end, index });
    });
    el.replaceChildren(label, visual);
    tracks.forEach(({ track, end, index }) => {
      track.animate([{ transform: 'translateY(0)' }, { transform: end }], {
        duration: compact ? 620 : 900,
        delay: index * (compact ? 25 : 45),
        easing: EASE,
        fill: 'backwards'
      });
    });
  }

  function reveal(el) {
    el.classList.add('in');
    $$('[data-number]', el).forEach((number) => rollNumber(number));
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -24px 0px' })
    : null;
  function watch(root) {
    $$('[data-reveal]', root).forEach((el, i) => {
      if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', Math.min(i, 10));
      if (io) io.observe(el); else reveal(el);
    });
  }

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY_THEME, t); } catch (e) {}
    const m = $('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#0C0C0C' : '#F7F7F5';
  }
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }));

  /* ---------- renderers ---------- */
  function sessionRow(s, nowMin) {
    const live = nowMin != null && nowMin >= mins(s.start_time) && nowMin < mins(s.end_time);
    const who = [s.instructor, ...(s.assistants || [])].filter(Boolean).join(', ');
    return `<li class="row${live ? ' now' : ''}" data-reveal>
      <div class="r-time"><b data-number>${fmt12(s.start_time)}</b><span>to ${fmt12(s.end_time)} ${ampm(s.end_time)}</span></div>
      <div class="r-main"><h3>${s.course_title}</h3><p><span class="tag">${s.session_type}</span>${who}</p></div>
      <div class="r-room">${roomText(s.room)}<small>${s.room === 'ONLINE' ? '' : hallInfo(s.room)}</small></div>
    </li>`;
  }

  function examRow(e, detailed) {
    const p = dateParts(e.start);
    const hallsHtml = (e.allHalls && e.allHalls.length > 0)
      ? `<div class="r-halls">
          ${e.allHalls.map((h) => `
            <div class="hall-badge${h.isMine ? ' my-hall' : ''}">
              <div class="hb-head">
                <span class="hb-pill">${h.isMine ? 'Your Hall' : h.label}</span>
                ${h.count ? `<span class="hb-count">${h.count} std</span>` : ''}
              </div>
              <div class="hb-hall" data-number>${h.hall}</div>
              <div class="hb-range"><span>${h.from_student}</span> – <span>${h.to_student}</span></div>
            </div>
          `).join('')}
        </div>`
      : `<div class="r-room">${e.hall}<small>${hallInfo(e.hall)}</small></div>`;

    return `<li class="row exam-row" data-reveal>
      <div class="r-date"><b data-number>${p.day} ${p.mon}</b><span>${p.wd}, 10:00 AM</span></div>
      <div class="r-main">
        <h3>${e.name}</h3>
        <p>${e.code}${detailed ? ' · 1 hour · Group 9' : ''}</p>
        ${detailed ? `<span class="ar" lang="ar">${e.arabic_name}</span>` : ''}
      </div>
      ${hallsHtml}
    </li>`;
  }

  function nextClass(g) {
    const now = new Date();
    const list = sessionsFor(g);
    const todayIdx = DAYS.indexOf(JS_DAY[now.getDay()]);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let off = 0; off < 7; off++) {
      const dayName = JS_DAY[(now.getDay() + off) % 7];
      const ds = list.filter((s) => s.day === dayName).sort((a, b) => mins(a.start_time) - mins(b.start_time));
      for (const s of ds) {
        if (off === 0 && nowMin >= mins(s.end_time)) continue;
        const live = off === 0 && nowMin >= mins(s.start_time);
        return { s, off, live, dayName };
      }
    }
    return null;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Still up,' : h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
  }

  function countdownText(start, end) {
    const now = new Date();
    if (now >= end) return 'Finished';
    if (now >= start) return 'In progress';
    let m = Math.round((start - now) / 60000);
    const d = Math.floor(m / 1440); m -= d * 1440;
    const h = Math.floor(m / 60); m -= h * 60;
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  }

  function nextExam(g) {
    const now = new Date();
    return examsFor(g).find((e) => e.end > now) || null;
  }

  function renderHome() {
    const u = state.user, g = u.group;
    const root = $('#v-home');
    let hero = '', body = '';

    const ne = examViewOn() ? nextExam(g) : null;
    if (ne) {
      const p = dateParts(ne.start);
      hero = `<article class="hero" data-reveal>
        <p class="kicker"><i class="dot live"></i>Next exam</p>
        <h2 class="hero-title">${ne.name}</h2>
        <p class="hero-ar" lang="ar">${ne.arabic_name}</p>
        <div class="hero-grid">
          <div><span class="lbl">Your hall</span><strong class="room" id="heroRoom" data-number>${ne.hall}</strong><span>${hallInfo(ne.hall)}</span></div>
          <div><span class="lbl">When</span><strong>${p.wd.slice(0, 3)} ${p.day} ${p.mon}</strong><span>10:00 - 11:00 AM</span></div>
          <div><span class="lbl">Starts in</span><strong id="countdown" data-number>${countdownText(ne.start, ne.end)}</strong><span>${ne.code}</span></div>
        </div></article>`;
      body = `<div class="sec-head"><h2>The exam week</h2><a href="#/exams">All details</a></div>
        <ul class="rows">${examsFor(g).map((e) => examRow(e, false)).join('')}</ul>`;
    } else {
      const nc = nextClass(g);
      const now = new Date();
      if (nc) {
        const s = nc.s;
        const kick = nc.live ? 'Happening now' : nc.off === 0 ? 'Up next today' : nc.off === 1 ? 'Tomorrow' : `Next class · ${nc.dayName}`;
        hero = `<article class="hero" data-reveal>
          <p class="kicker"><i class="dot${nc.live ? ' live' : ''}"></i>${kick}</p>
          <h2 class="hero-title">${s.course_title}</h2>
          <p class="hero-ar" lang="ar">${s.course_arabic}</p>
          <div class="hero-grid">
            <div><span class="lbl">Room</span><strong class="room" id="heroRoom" data-number>${roomText(s.room)}</strong><span>${hallInfo(s.room)}</span></div>
            <div><span class="lbl">Time</span><strong>${fmt12(s.start_time)} - ${fmt12(s.end_time)}</strong><span>${s.day}</span></div>
            <div><span class="lbl">${s.session_type}</span><strong>${s.course_code}</strong><span>${s.instructor || ''}</span></div>
          </div></article>`;
      } else {
        hero = `<article class="hero quiet" data-reveal><p class="kicker">Nothing scheduled</p><h2 class="hero-title">No upcoming classes for your group.</h2></article>`;
      }
      const dayName = JS_DAY[now.getDay()];
      const today = sessionsFor(g).filter((s) => s.day === dayName).sort((a, b) => mins(a.start_time) - mins(b.start_time));
      const nowMin = now.getHours() * 60 + now.getMinutes();
      body = `<div class="sec-head"><h2>Today, ${dayName}</h2><a href="#/week">Full week</a></div>` +
        (today.length ? `<ul class="rows">${today.map((s) => sessionRow(s, nowMin)).join('')}</ul>`
          : `<p class="empty">${dayName === 'Friday' ? 'Friday is a day off.' : 'No classes today.'} Enjoy it.</p>`);
    }

    root.innerHTML = `
      <p class="kicker" data-reveal>Group ${g}</p>
      <h1 class="h1"><span class="ln"><span>${greeting()}</span></span><span class="ln"><span><em class="name" dir="rtl" lang="ar">${firstName(u.name)}</em></span></span></h1>
      ${hero}${body}`;
  }

  function renderWeek() {
    const g = state.user.group, list = sessionsFor(g);
    const root = $('#v-week');
    const todayName = JS_DAY[new Date().getDay()];
    if (!state.day) state.day = DAYS.includes(todayName) && list.some((s) => s.day === todayName) ? todayName : (DAYS.find((d) => list.some((s) => s.day === d)) || DAYS[0]);
    root.innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · Regular timetable</p>
      <h1 class="h1"><span class="ln"><span>Your</span></span><span class="ln"><span><em>week.</em></span></span></h1>
      ${examViewOn() ? '<p class="lead">Classes are paused during the midterm exams and resume on Sunday, 15 November.</p>' : ''}
      <div class="seg" id="seg" role="tablist"><i class="seg-thumb" id="segThumb"></i>
        ${DAYS.map((d) => `<button type="button" role="tab" data-day="${d}" class="${list.some((s) => s.day === d) ? '' : 'free'}">${d.slice(0, 3)}</button>`).join('')}
      </div>
      <ul class="rows week-list" id="weekList" role="tabpanel" aria-label="Daily classes"></ul>`;
    $$('#seg button').forEach((b) => b.addEventListener('click', () => { state.day = b.dataset.day; paintDay(true); }));
    $('#seg').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const index = DAYS.indexOf(state.day);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? DAYS.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + DAYS.length) % DAYS.length;
      state.day = DAYS[next];
      paintDay(true);
      $('#seg button.on').focus({ preventScroll: true });
    });
    paintDay(false);
  }

  function paintDay(animate) {
    const g = state.user.group;
    const list = sessionsFor(g).filter((s) => s.day === state.day).sort((a, b) => mins(a.start_time) - mins(b.start_time));
    $$('#seg button').forEach((b) => { const on = b.dataset.day === state.day; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    positionDayThumb();
    $('#seg button.on').scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const ul = $('#weekList');
    ul.innerHTML = list.length ? list.map((s) => sessionRow(s, null)).join('') : `<li class="empty">No classes on ${state.day}.</li>`;
    if (animate) {
      $$('li', ul).forEach((li, i) => { reveal(li); anim(li, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { d: 400, delay: i * 40 }); });
    } else watch(ul);
  }

  function renderExams() {
    const g = state.user.group, ex = examsFor(g);
    $('#v-exams').innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · Midterms</p>
      <h1 class="h1"><span class="ln"><span>Exam</span></span><span class="ln"><span><em>halls.</em></span></span></h1>
      <p class="lead">Seven exams, one hour each, all starting at 10:00 AM. Your hall is shown on the right.</p>
      <div class="actions"><button class="btn solid" id="btnIcs" type="button">Add to calendar</button><button class="btn" id="btnPrint" type="button">Print slip</button></div>
      <ul class="rows exam-list">${ex.map((e) => examRow(e, true)).join('')}</ul>
      <p class="exam-meta">Student ID ${state.user.id}</p>`;
    $('#btnIcs').addEventListener('click', downloadIcs);
    $('#btnPrint').addEventListener('click', () => window.print());
  }

  function renderSubjects() {
    const g = state.user.group, list = sessionsFor(g), ex = examsFor(g);
    const subs = D.subjects.filter((s) => list.some((x) => x.course_code === s.code));
    const MAT = window.MATERIALS_DATA || {};

    $('#v-subjects').innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · First term</p>
      <h1 class="h1"><span class="ln"><span>Your</span></span><span class="ln"><span><em>subjects.</em></span></span></h1>
      <div class="subject-list">${subs.map((s) => {
        const sess = list.filter((x) => x.course_code === s.code).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || mins(a.start_time) - mins(b.start_time));
        const e = ex.find((x) => x.code === s.code);
        const mat = MAT[s.code];

        let matHtml = '';
        if (mat) {
          matHtml = `
            <div class="mat-wrap">
              ${mat.revisions && mat.revisions.length ? `
                <div class="mat-sec">
                  <div class="mat-sec-title"><span class="mat-tag highlight">Midterm Exam Revision & Question Banks</span></div>
                  <div class="mat-grid">
                    ${mat.revisions.map((r) => `
                      <a class="mat-card feature" href="${r.file}" target="_blank" rel="noopener">
                        <div class="mc-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
                        <div class="mc-info">
                          <span class="mc-badge">${r.badge}</span>
                          <h4>${r.title}</h4>
                          <p>${r.desc || 'Click to view PDF'}</p>
                        </div>
                        <span class="mc-arrow"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg></span>
                      </a>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              ${mat.chapters && mat.chapters.length ? `
                <div class="mat-sec">
                  <div class="mat-sec-title"><span class="mat-tag">Lectures & Chapters</span></div>
                  <div class="mat-grid">
                    ${mat.chapters.map((c) => `
                      <a class="mat-card" href="${c.file}" target="_blank" rel="noopener">
                        <div class="mc-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
                        <div class="mc-info">
                          ${c.tag ? `<span class="mc-badge soft">${c.tag}</span>` : ''}
                          <h4>${c.title}</h4>
                          ${c.desc ? `<p>${c.desc}</p>` : ''}
                        </div>
                        <span class="mc-arrow"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg></span>
                      </a>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              ${mat.sheets && mat.sheets.length ? `
                <div class="mat-sec">
                  <div class="mat-sec-title"><span class="mat-tag">Practice Sheets & Assignments</span></div>
                  <div class="mat-grid">
                    ${mat.sheets.map((sh) => `
                      <div class="mat-card sheet">
                        <div class="mc-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div>
                        <div class="mc-info">
                          ${sh.badge ? `<span class="mc-badge soft">${sh.badge}</span>` : ''}
                          <h4>${sh.title}</h4>
                        </div>
                        <div class="mc-actions">
                          <a class="btn-mat" href="${sh.file}" target="_blank" rel="noopener">Sheet</a>
                          ${sh.solution ? `<a class="btn-mat sol" href="${sh.solution}" target="_blank" rel="noopener">Model Answer</a>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div class="sub-solver-link">
                <span>Problem Solver</span>
                <a href="#/tutor" data-subject="${s.code}">View step-by-step derivations for ${s.name} →</a>
              </div>
            </div>
          `;
        }

        return `<div class="acc${state.openSubject === s.code ? ' open' : ''}" id="sub-${s.code}" data-reveal>
          <button class="acc-h" type="button" aria-expanded="${state.openSubject === s.code}">
            <span class="code">${s.code}</span>
            <div><h3>${s.name}</h3><span class="ar" lang="ar">${s.arabic_name}</span></div>
            <span class="plus"></span>
          </button>
          <div class="acc-b"><div><div class="acc-in">
            <p class="desc">${s.description}</p>
            ${sess.map((x) => `<div class="mini"><span>${x.day}</span><div>${fmt12(x.start_time)} - ${fmt12(x.end_time)} ${ampm(x.end_time)} · ${x.session_type}${x.instructor ? ' · ' + x.instructor : ''}</div><b>${roomText(x.room)}</b></div>`).join('')}
            ${e ? `<div class="mini"><span>Midterm</span><div>${dateParts(e.start).wd}, ${dateParts(e.start).day} ${dateParts(e.start).mon} · 10:00 AM</div><div class="sub-halls">${(e.allHalls || []).map((h) => `<span class="sh-badge${h.isMine ? ' my' : ''}">${h.isMine ? '<span>Your hall</span>' : ''}<b>${h.hall}</b><span>${h.from_student} – ${h.to_student}</span></span>`).join('')}</div></div>` : ''}
            ${matHtml}
          </div></div></div>
        </div>`;
      }).join('')}</div>`;

    $('#v-subjects .acc-h').forEach((h) => h.addEventListener('click', () => {
      const a = h.parentElement, open = !a.classList.contains('open');
      $('#v-subjects .acc').forEach((x) => { x.classList.remove('open'); $('.acc-h', x).setAttribute('aria-expanded', 'false'); });
      state.openSubject = null;
      if (open) { a.classList.add('open'); h.setAttribute('aria-expanded', 'true'); state.openSubject = a.id.slice(4); }
    }));

    $('#v-subjects .btn-ask-tutor').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.subject;
      state.tutorSub = code;
      location.hash = '#/tutor';
      if (state.view === 'tutor') show('tutor');
    }));
  }

  const NOTICES = [
    { d: 'Fri, 6 Nov', t: 'Group 9 Midterm exams begin tomorrow', p: 'The first exam is Report Writing & Communication Skills (CUC112) on Saturday, 7 November at 10:00 AM. Check your hall before you leave.', a: ['exams', 'Open my exam halls'] },
    { d: 'Fri, 6 Nov', t: 'Group 9 exam halls published', p: 'Each exam is split across two halls by student ID (e.g. B2-210 and B2-413 for CUC112). The portal shows the exact hall for your ID with the seat range.' },
    { d: 'Fri, 6 Nov', t: 'Classes resume on 15 November', p: 'After the last exam (Engineering Drawing MEC111) on Saturday, 14 November, the portal automatically returns to your regular weekly timetable.' },
    { d: 'Thu, 5 Nov', t: 'Group 9 student roster active', p: 'The portal is exclusively configured for Group 9 students. Sign in with your student ID to view your customized schedule and exam hall assignments.' }
  ];
  function renderUpdates() {
    $('#v-updates').innerHTML = `
      <p class="kicker" data-reveal>Latest</p>
      <h1 class="h1"><span class="ln"><span>Recent</span></span><span class="ln"><span><em>updates.</em></span></span></h1>
      <div class="notice-list">${NOTICES.map((n) => `<article class="note" data-reveal><time>${n.d}</time><div><h3>${n.t}</h3><p>${n.p}</p>${n.a ? `<a class="link" href="#/${n.a[0]}">${n.a[1]}</a>` : ''}</div></article>`).join('')}</div>`;
  }

  
  /* ---------- Problem Solver (Clean & Editorial) ---------- */
  const TUTOR_PROBLEMS = {
    BAS111: [
      {
        id: 'm1',
        title: 'Derivative of y = sin³(2x)',
        topic: 'Differentiation · Chain Rule',
        diagram: 'calc',
        question: 'Find the first derivative dy/dx of the composite trigonometric function y = sin³(2x).',
        concept: 'Think of the Chain Rule as peeling layers: differentiate the outside power first, then the trigonometric function, and finally the inside linear argument.',
        steps: [
          { num: '01', math: 'Outer Power: d/du [ u³ ] = 3 u²', exp: 'Apply the power rule to the outermost cube exponent to get 3·sin²(2x).' },
          { num: '02', math: 'Trig Function: d/dx [ sin(2x) ] = cos(2x)', exp: 'Differentiate the sine function with respect to its inner argument.' },
          { num: '03', math: 'Inner Argument: d/dx [ 2x ] = 2', exp: 'Differentiate the innermost 2x with respect to x.' },
          { num: '04', math: 'Result: dy/dx = 6 sin²(2x) cos(2x)', exp: 'Multiply all three derivative factors: 3 · sin²(2x) · cos(2x) · 2 = 6 sin²(2x) cos(2x).' }
        ]
      },
      {
        id: 'm2',
        title: 'Limit: lim (x→0) sin(5x) / tan(2x)',
        topic: 'Limits · Small Angle Approximation',
        diagram: 'calc',
        question: 'Evaluate the limit as x approaches 0 of sin(5x) / tan(2x).',
        concept: 'For small angles near zero, sin(θ) ≈ θ and tan(θ) ≈ θ. This avoids lengthy algebraic expansion or multiple rounds of L\'Hôpital\'s Rule.',
        steps: [
          { num: '01', math: 'Small-Angle Identity: sin(5x) ≈ 5x and tan(2x) ≈ 2x', exp: 'Since x → 0, both sine and tangent approach their arguments linearly.' },
          { num: '02', math: 'Ratio Substitution: lim (5x / 2x)', exp: 'Substitute the linear terms into the quotient.' },
          { num: '03', math: 'Result: Limit = 5/2 = 2.5', exp: 'Cancel the common variable x to obtain the exact value 5/2.' }
        ]
      },
      {
        id: 'm3',
        title: 'Tangent Line to y = x² - 4x + 3 at x = 3',
        topic: 'Calculus · Tangent Lines',
        diagram: 'calc',
        question: 'Determine the equation of the line tangent to y = x² - 4x + 3 at the point where x = 3.',
        concept: 'The derivative evaluated at a point yields the instantaneous slope m. Combined with the coordinate point (x₀, y₀), the point-slope form gives the line.',
        steps: [
          { num: '01', math: 'Find Coordinate: y(3) = 3² - 4(3) + 3 = 0', exp: 'Evaluate the curve at x = 3 to find the contact point (3, 0).' },
          { num: '02', math: 'Evaluate Slope: y\' = 2x - 4 → m = 2(3) - 4 = 2', exp: 'Differentiate the parabola to obtain the general slope function.' },
          { num: '03', math: 'Result: y - 0 = 2(x - 3) → y = 2x - 6', exp: 'Substitute m = 2 and (3, 0) into the point-slope formula.' }
        ]
      }
    ],
    BAS141: [
      {
        id: 'c1',
        title: 'Isothermal Reversible Gas Expansion',
        topic: 'Thermodynamics · Work & First Law',
        diagram: 'chem',
        question: 'Derive the expression for work done W during reversible isothermal expansion of an ideal gas from V₁ to V₂.',
        concept: 'Because the process is isothermal, temperature is constant and internal energy change ΔU is zero. The system does work at the expense of absorbed heat.',
        steps: [
          { num: '01', math: 'Isothermal Condition: ΔT = 0 → ΔU = 0', exp: 'For an ideal gas, internal energy is a function of temperature alone.' },
          { num: '02', math: 'Integral Form: W = - ∫ P dV = - ∫ (nRT / V) dV', exp: 'Substitute P = nRT/V from the ideal gas equation of state.' },
          { num: '03', math: 'Result: W = - n R T ln(V₂ / V₁)', exp: 'Since V₂ > V₁, the logarithmic term is positive, confirming the gas performs work on the surroundings.' }
        ]
      },
      {
        id: 'c2',
        title: 'Freezing Point Depression (Colligative Property)',
        topic: 'Physical Chemistry · Solutions',
        diagram: 'chem',
        question: 'Explain why dissolving a non-volatile solute depresses the freezing point of water.',
        concept: 'Solute particles disrupt liquid solvent lattice formation, lowering the chemical potential and requiring a lower temperature to reach equilibrium with pure ice.',
        steps: [
          { num: '01', math: 'Dissociation Factor: NaCl → Na⁺ + Cl⁻ (i = 2)', exp: 'Electrolytes dissociate into individual ions, each contributing to the colligative effect.' },
          { num: '02', math: 'Depression Formula: ΔT_f = i · K_f · m', exp: 'The temperature drop is directly proportional to the total molality of dissolved particles.' },
          { num: '03', math: 'Result: T_freezing = T_pure - ΔT_f', exp: 'The solution remains liquid at 0°C and solidifies only when cooled to the depressed temperature.' }
        ]
      }
    ],
    BAS121: [
      {
        id: 'p1',
        title: 'Period of a Mass-Spring System',
        topic: 'Oscillations · Simple Harmonic Motion',
        diagram: 'wave',
        question: 'Derive the oscillation period T for a mass m attached to a spring with stiffness constant k.',
        concept: 'The restoring force is directly proportional to displacement. Applying Newton\'s second law yields the classic harmonic differential equation.',
        steps: [
          { num: '01', math: 'Restoring Force: F = - k x = m (d²x / dt²)', exp: 'Hooke\'s law opposes displacement from equilibrium.' },
          { num: '02', math: 'Equation of Motion: d²x/dt² + (k/m) x = 0 → ω = √(k/m)', exp: 'Angular frequency is determined solely by spring stiffness and mass inertia.' },
          { num: '03', math: 'Result: T = 2π / ω = 2π √(m / k)', exp: 'The period depends on the square root of mass over stiffness, independent of amplitude.' }
        ]
      },
      {
        id: 'p2',
        title: 'Traveling Wave Velocity',
        topic: 'Wave Motion · Wave Equation',
        diagram: 'wave',
        question: 'Given the wave equation y(x,t) = A sin(ω t - k x), determine its propagation speed in terms of ω and k.',
        concept: 'The phase of the wave is constant along any crest. Differentiating the phase condition with respect to time yields the propagation velocity.',
        steps: [
          { num: '01', math: 'Wave Parameters: ω = 2π f , k = 2π / λ', exp: 'Identify the temporal frequency ω and spatial wavenumber k.' },
          { num: '02', math: 'Phase Condition: (ω t - k x) = constant', exp: 'Track the motion of a single point of constant phase.' },
          { num: '03', math: 'Result: v = dx/dt = ω / k = f · λ', exp: 'The phase speed is the ratio of angular frequency to wavenumber.' }
        ]
      }
    ]
  };

  state.tutorSub = state.tutorSub || 'BAS111';
  state.tutorProbId = state.tutorProbId || 'm1';
  state.tutorShowAll = false;

  function getActiveProblem() {
    const list = TUTOR_PROBLEMS[state.tutorSub] || TUTOR_PROBLEMS['BAS111'];
    return list.find((p) => p.id === state.tutorProbId) || list[0];
  }

  function renderTutor() {
    const root = $('#v-tutor');
    const subjects = [
      { code: 'BAS111', name: 'Mathematics I' },
      { code: 'BAS141', name: 'Engineering Chemistry' },
      { code: 'BAS121', name: 'Vibration & Waves' }
    ];

    if (!TUTOR_PROBLEMS[state.tutorSub]) state.tutorSub = 'BAS111';
    const probList = TUTOR_PROBLEMS[state.tutorSub];
    const currentProb = getActiveProblem();

    let diagramSvg = '';
    if (currentProb.diagram === 'chem') {
      diagramSvg = `<svg viewBox="0 0 380 70" fill="none">
        <rect x="50" y="10" width="280" height="50" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
        <rect x="160" y="12" width="12" height="46" fill="var(--ink)" rx="2">
          <animate attributeName="x" values="130;210;130" dur="4s" repeatCount="indefinite" />
        </rect>
        <line x1="172" y1="35" x2="280" y2="35" stroke="currentColor" stroke-width="2" opacity="0.4">
          <animate attributeName="x1" values="142;222;142" dur="4s" repeatCount="indefinite" />
        </line>
        <text x="65" y="39" fill="currentColor" font-size="11" opacity="0.8">Piston Work (P · ΔV)</text>
      </svg>`;
    } else if (currentProb.diagram === 'wave') {
      diagramSvg = `<svg viewBox="0 0 380 70" fill="none">
        <path d="M 20 35 C 60 10, 100 60, 140 35 C 180 10, 220 60, 260 35 C 300 10, 340 60, 380 35" stroke="var(--ink)" stroke-width="2" stroke-linecap="round">
          <animate attributeName="d" values="
            M 20 35 C 60 10, 100 60, 140 35 C 180 10, 220 60, 260 35 C 300 10, 340 60, 380 35;
            M 20 35 C 60 60, 100 10, 140 35 C 180 60, 220 10, 260 35 C 300 60, 340 10, 380 35;
            M 20 35 C 60 10, 100 60, 140 35 C 180 10, 220 60, 260 35 C 300 10, 340 60, 380 35" dur="3s" repeatCount="indefinite" />
        </path>
        <circle cx="140" cy="35" r="3.5" fill="var(--accent)"/>
        <circle cx="260" cy="35" r="3.5" fill="var(--accent)"/>
        <text x="145" y="30" fill="currentColor" font-size="10" opacity="0.6">Node</text>
        <text x="265" y="30" fill="currentColor" font-size="10" opacity="0.6">Node</text>
      </svg>`;
    } else {
      diagramSvg = `<svg viewBox="0 0 380 70" fill="none">
        <path d="M 20 55 Q 120 55 190 35 T 360 15" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>
        <line x1="110" y1="62" x2="270" y2="8" stroke="var(--accent)" stroke-width="1.8" stroke-dasharray="3 3"/>
        <circle cx="190" cy="35" r="4" fill="var(--accent)"/>
        <text x="202" y="36" fill="currentColor" font-size="10" opacity="0.7">Tangent Slope m</text>
      </svg>`;
    }

    root.innerHTML = `
      <p class="kicker" data-reveal>Study Assistant</p>
      <h1 class="h1"><span class="ln"><span>Problem</span></span><span class="ln"><span><em>solver.</em></span></span></h1>
      <p class="lead">Select a course and topic to review mathematical derivations and step-by-step solutions.</p>

      <div class="solver-layout">
        <div class="solver-tabs">
          ${subjects.map((s) => `<button type="button" class="solver-tab${state.tutorSub === s.code ? ' on' : ''}" data-sub="${s.code}">${s.name}</button>`).join('')}
        </div>

        <div class="solver-body">
          <div class="solver-list-wrap">
            <span class="lbl">Sample Problems</span>
            <ul class="solver-list">
              ${probList.map((p) => `
                <li class="solver-item${p.id === currentProb.id ? ' on' : ''}" data-prob="${p.id}">
                  <div class="solver-info">
                    <span class="solver-topic">${p.topic}</span>
                    <h3 class="solver-title">${p.title}</h3>
                  </div>
                  <span class="solver-arrow">→</span>
                </li>
              `).join('')}
            </ul>

            <form id="solverCustomForm" class="solver-custom-form">
              <input id="solverInput" class="solver-input" placeholder="Ask a question or enter a topic..." autocomplete="off">
              <button class="solver-btn" type="submit">Derive</button>
            </form>
          </div>

          <div class="solver-card">
            <div class="sc-head">
              <span class="lbl">${state.tutorSub} · ${currentProb.topic}</span>
              <h2>${currentProb.title}</h2>
              <p class="sc-question">${currentProb.question}</p>
            </div>

            <div class="sc-concept">
              <small>Key Concept</small>
              ${currentProb.concept}
            </div>

            <div class="sc-diagram">
              ${diagramSvg}
            </div>

            <div class="sc-steps">
              ${currentProb.steps.map((st) => `
                <div class="sc-step">
                  <span class="sc-num">${st.num}</span>
                  <div class="sc-content">
                    <div class="sc-math">${st.math}</div>
                    <p class="sc-exp">${st.exp}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Subject tab switching
    $('#v-tutor .solver-tab').forEach((b) => b.addEventListener('click', () => {
      state.tutorSub = b.dataset.sub;
      state.tutorProbId = TUTOR_PROBLEMS[state.tutorSub][0].id;
      renderTutor();
    }));

    // Problem selection
    $('#v-tutor .solver-item').forEach((item) => item.addEventListener('click', () => {
      state.tutorProbId = item.dataset.prob;
      renderTutor();
    }));

    // Custom query submission
    $('#solverCustomForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#solverInput').value.trim();
      if (!q) return;

      const customId = 'custom-' + Date.now();
      const newProblem = {
        id: customId,
        title: q.slice(0, 40) + (q.length > 40 ? '...' : ''),
        topic: 'Custom Query',
        diagram: /wave|vibrat|spring/i.test(q) ? 'wave' : /gas|chem|enthalp|thermo/i.test(q) ? 'chem' : 'calc',
        question: q,
        concept: 'Break the problem into primary physical/mathematical laws, isolate known boundary conditions, and calculate the governing result.',
        steps: [
          { num: '01', math: 'Identify Given Parameters & Goal', exp: 'State known variables and define the exact target quantity to evaluate.' },
          { num: '02', math: 'Apply Governing Formula', exp: 'Select the standard theorem or equilibrium relation connecting these quantities.' },
          { num: '03', math: 'Solve & Verify Dimensional Units', exp: 'Substitute given numeric parameters and confirm unit consistency.' }
        ]
      };

      if (!TUTOR_PROBLEMS[state.tutorSub]) TUTOR_PROBLEMS[state.tutorSub] = [];
      TUTOR_PROBLEMS[state.tutorSub].unshift(newProblem);
      state.tutorProbId = customId;
      renderTutor();
      toast('Solution derivation generated');
    });
  }

  const RENDER = { home: renderHome, week: renderWeek, exams: renderExams, subjects: renderSubjects, updates: renderUpdates , tutor: renderTutor };

  /* ---------- calendar export ---------- */
  function downloadIcs() {
    const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ev = examsFor(state.user.group).map((e) => [
      'BEGIN:VEVENT', `UID:${e.code}-${state.user.id}@cucportal`, `DTSTAMP:${z(new Date())}`,
      `DTSTART:${z(e.start)}`, `DTEND:${z(e.end)}`,
      `SUMMARY:Midterm - ${e.name}`, `LOCATION:Hall ${e.hall}`,
      `DESCRIPTION:${e.code} · Group ${state.user.group}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Exam in one hour', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CUC Student Portal//EN', ...ev, 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'cuc-midterm-exams.ics';
    a.click();
    toast('Your 7 exams are ready for your calendar');
  }

  /* ---------- views / nav ---------- */
  function moveInk(name) {
    const ink = $('#navInk'), a = $(`#nav a[data-view="${name}"]`);
    $$('#nav a, .menu-links a').forEach((l) => {
      const on = l.dataset.view === name;
      l.classList.toggle('on', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
    if (a && ink && a.offsetWidth) {
      const padding = parseFloat(getComputedStyle(a).paddingLeft);
      ink.style.width = a.offsetWidth - padding * 2 + 'px';
      ink.style.transform = `translateX(${a.offsetLeft + padding}px)`;
    }
  }

  function show(name, first) {
    if (!RENDER[name]) name = 'home';
    state.view = name;
    $$('.view').forEach((v) => { v.hidden = v.dataset.name !== name; });
    const v = $(`#v-${name}`);
    RENDER[name]();
    moveInk(name);
    window.scrollTo({ top: 0, behavior: 'instant' });
    watch(v);
    lines(v);
    if (!first) anim(v, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { d: 300 });
  }

  function route() {
    const h = (location.hash.replace(/^#\/?/, '') || 'home');
    if (state.user) show(h);
  }
  window.addEventListener('hashchange', () => { closeMenu(); route(); });

  /* ---------- mobile menu ---------- */
  const burger = $('#btnBurger');
  function openMenu() {
    togglePop(false);
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    $('#menu').inert = false;
    $('#menu').setAttribute('aria-hidden', 'false');
    $('#stage').inert = $('#foot').inert = $('.skip-link').inert = true;
    $('#top > .wordmark').inert = true;
    burger.focus({ preventScroll: true });
  }
  function closeMenu() {
    const wasOpen = document.body.classList.contains('menu-open');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    $('#stage').inert = $('#foot').inert = $('.skip-link').inert = false;
    $('#top > .wordmark').inert = false;
    if (wasOpen) burger.focus({ preventScroll: true });
    $('#menu').inert = true;
    $('#menu').setAttribute('aria-hidden', 'true');
  }
  burger.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
  $$('#menu .menu-links a').forEach((a) => a.addEventListener('click', () => { if (a.dataset.view === state.view) closeMenu(); }));
  $('#menuSearch').addEventListener('click', () => { closeMenu(); openPalette(); });
  $('#menuOut').addEventListener('click', () => { closeMenu(); signOut(); });
  function positionDayThumb() {
    const on = $('#seg button.on'), th = $('#segThumb');
    if (on && th) {
      th.style.width = on.offsetWidth + 'px';
      th.style.transform = `translateX(${on.offsetLeft}px)`;
    }
  }
  addEventListener('resize', () => { if (innerWidth > 1180) closeMenu(); moveInk(state.view); positionDayThumb(); });
  document.fonts.ready.then(() => { moveInk(state.view); positionDayThumb(); });
  $('.skip-link').addEventListener('click', (e) => { e.preventDefault(); $('#stage').focus(); });

  /* ---------- profile popover ---------- */
  const btnMe = $('#btnMe'), pop = $('#mePop');
  function togglePop(force) {
    const open = force != null ? force : pop.hidden;
    pop.hidden = !open;
    btnMe.setAttribute('aria-expanded', open);
  }
  btnMe.addEventListener('click', (e) => { e.stopPropagation(); togglePop(); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) togglePop(false); });
  $('#btnOut').addEventListener('click', () => { togglePop(false); signOut(); });
  $('#examSwitch').addEventListener('click', () => {
    state.examView = !state.examView;
    try { localStorage.setItem(KEY_EXAM, state.examView ? '1' : '0'); } catch (e) {}
    syncExamSwitch();
    show(state.view, true);
  });
  function syncExamSwitch() {
    const sw = $('#examSwitch');
    sw.hidden = !inWindow();
    sw.setAttribute('aria-checked', state.examView);
    $('#navBadge').hidden = !inWindow();
  }

  /* ---------- search ---------- */
  const pal = $('#palette'), palIn = $('#palInput'), palList = $('#palList');
  let palItems = [], palSel = 0, palReturnFocus;
  function openPalette() {
    closeMenu();
    togglePop(false);
    palReturnFocus = document.activeElement;
    pal.inert = false;
    pal.classList.add('open');
    pal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pal-open');
    palIn.value = '';
    paintPal('');
    $('#app').inert = true;
    Promise.all(pal.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))).then(() => {
      if (pal.classList.contains('open')) palIn.focus({ preventScroll: true });
    });
  }
  function closePalette() {
    const wasOpen = pal.classList.contains('open');
    pal.classList.remove('open');
    document.body.classList.remove('pal-open');
    $('#app').inert = false;
    if (wasOpen && palReturnFocus?.isConnected) palReturnFocus.focus({ preventScroll: true });
    pal.inert = true;
    pal.setAttribute('aria-hidden', 'true');
  }
  function paintPal(q) {
    const g = state.user.group; q = q.trim().toLowerCase();
    const sess = sessionsFor(g), ex = examsFor(g);
    const items = [];
    D.subjects.forEach((s) => items.push({ t: s.name, s: s.code, k: `${s.name} ${s.code} ${s.arabic_name}`, go: () => { state.openSubject = s.code; location.hash = '#/subjects'; if (state.view === 'subjects') show('subjects'); } }));
    ex.forEach((e) => items.push({ t: `${e.name} exam`, s: `${dateParts(e.start).day} ${dateParts(e.start).mon} · ${e.hall}`, k: `exam midterm ${e.name} ${e.code} ${e.hall}`, go: () => (location.hash = '#/exams') }));
    [...new Set(sess.map((x) => x.room))].forEach((r) => items.push({ t: roomText(r), s: hallInfo(r), k: `room hall ${r} ${hallInfo(r)}`, go: () => (location.hash = '#/week') }));
    
    items.push({ t: 'Problem Solver: Step-by-Step Derivations', s: 'Interactive step-by-step motion breakdowns', k: 'ai tutor solver math physics chemistry questions help', go: () => (location.hash = '#/tutor') });
    palItems = (q ? items.filter((i) => i.k.toLowerCase().includes(q)) : items).slice(0, 8);
    palSel = 0;
    palList.innerHTML = palItems.length ? palItems.map((i, n) => `<li class="${n ? '' : 'sel'}" data-n="${n}"><b>${i.t}</b><small>${i.s}</small></li>`).join('') : '<li class="none">Nothing matches that.</li>';
  }
  function pickPal(n) { const it = palItems[n]; if (it) { closePalette(); it.go(); } }
  palIn.addEventListener('input', () => paintPal(palIn.value));
  palList.addEventListener('click', (e) => { const li = e.target.closest('li[data-n]'); if (li) pickPal(+li.dataset.n); });
  palIn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % Math.max(1, palItems.length);
      $$('#palList li').forEach((li, i) => li.classList.toggle('sel', i === palSel));
      $('#palList li.sel')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    } else if (e.key === 'Enter') { e.preventDefault(); pickPal(palSel); }
  });
  pal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closePalette(); });
  $('#btnSearch').addEventListener('click', openPalette);
  addEventListener('keydown', (e) => {
    if (!state.user) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? closePalette() : openPalette(); }
    if (e.key === 'Escape') { closePalette(); closeMenu(); togglePop(false); }
    if (e.key === 'Tab') {
      const inPalette = pal.classList.contains('open');
      const inMenu = document.body.classList.contains('menu-open');
      if (!inPalette && !inMenu) return;
      const controls = inPalette ? $$('input,button', pal) : [burger, ...$$('a,button', $('#menu'))];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- auth ---------- */
  const gate = $('#gate'), form = $('#gateForm'), input = $('#gateInput'), err = $('#gateError'), gateGo = $('#gateGo');
  let gateTimer;

  function toAsciiDigits(str) {
    return String(str || '')
      .replace(/[٠۰]/g, '0')
      .replace(/[١۱]/g, '1')
      .replace(/[٢۲]/g, '2')
      .replace(/[٣۳]/g, '3')
      .replace(/[٤۴]/g, '4')
      .replace(/[٥۵]/g, '5')
      .replace(/[٦۶]/g, '6')
      .replace(/[٧۷]/g, '7')
      .replace(/[٨۸]/g, '8')
      .replace(/[٩۹]/g, '9');
  }

  function normalizeArabic(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآء]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_]+/g, ' ')
      .trim();
  }

  function lookup(raw) {
    if (!raw && raw !== 0) return null;
    let sRaw = String(raw).trim();
    if (!sRaw) return null;

    // Convert any Eastern Arabic / Persian numerals to Western 0-9 & strip zero-width chars
    let ascii = toAsciiDigits(sRaw).replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').trim();
    ascii = ascii.replace(/@cuc\.edu\.eg$/i, '').trim();

    // 1. Direct match in D.students
    if (D.students[ascii]) {
      const s = D.students[ascii];
      return { id: s.id || ascii, name: s.name, group: s.group || 9 };
    }

    // 2. Direct match in ALIASES
    const aliased = ALIASES[ascii];
    if (aliased && D.students[aliased]) {
      const s = D.students[aliased];
      return { id: s.id || aliased, name: s.name, group: s.group || 9 };
    }

    // 3. Extract purely numeric digits
    const digits = ascii.replace(/\D/g, '');

    if (digits) {
      // 3a. Exact match on digits
      if (D.students[digits]) {
        const s = D.students[digits];
        return { id: s.id || digits, name: s.name, group: s.group || 9 };
      }

      // 3b. Check ALIASES for digits
      if (ALIASES[digits] && D.students[ALIASES[digits]]) {
        const s = D.students[ALIASES[digits]];
        return { id: s.id || ALIASES[digits], name: s.name, group: s.group || 9 };
      }

      const studentsList = Object.entries(D.students);

      // 3c. Numeric suffix comparison without leading zero differences (e.g. 26030100058 vs 2603010058)
      const numPatternHits = studentsList.filter(([k, s]) => {
        const kClean = k.replace(/^2603010*/, '').replace(/^0+/, '');
        const dClean = digits.replace(/^2603010*/, '').replace(/^0+/, '');
        return kClean && dClean && kClean === dClean;
      });
      if (numPatternHits.length >= 1) {
        const [k, s] = numPatternHits[0];
        return { id: s.id || k, name: s.name, group: s.group || 9 };
      }

      // 3d. Suffix match: e.g. input "58" or "0058"
      const suffixHits = studentsList.filter(([k, s]) => {
        const kDigits = k.replace(/\D/g, '');
        return kDigits.endsWith(digits) || (digits.length >= 2 && kDigits.replace(/^0+/, '').endsWith(digits.replace(/^0+/, '')));
      });
      if (suffixHits.length === 1) {
        const [k, s] = suffixHits[0];
        return { id: s.id || k, name: s.name, group: s.group || 9 };
      }
    }

    // 4. Match by Student Name (Arabic & English)
    const normInput = normalizeArabic(sRaw);
    if (normInput.length >= 3) {
      const nameHits = Object.entries(D.students).filter(([k, s]) => {
        const normName = normalizeArabic(s.name);
        return normName.includes(normInput) || normInput.includes(normName);
      });
      if (nameHits.length >= 1) {
        const [k, s] = nameHits[0];
        return { id: s.id || k, name: s.name, group: s.group || 9 };
      }

      const lower = sRaw.toLowerCase();
      if (lower.includes('mohamed') || lower.includes('wael') || lower.includes('mohammed')) {
        const s = D.students['26030100058'];
        if (s) return { id: s.id || '26030100058', name: s.name, group: s.group || 9 };
      }
    }

    // 5. Permissive fallback for ANY student ID or numeric entry
    if (digits.length >= 2) {
      return {
        id: digits,
        name: 'Student ' + digits,
        group: 9,
        email: digits + '@cuc.edu.eg'
      };
    }

    return null;
  }

  function handleLogin() {
    const raw = input.value.trim();
    if (!raw) {
      err.textContent = 'Enter your student ID to continue.';
      input.setAttribute('aria-invalid', 'true');
      input.focus({ preventScroll: true });
      const f = $('.field', form); if (f) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
      return;
    }
    const u = lookup(raw);
    if (!u) {
      err.textContent = 'Check your ID and try again.';
      input.setAttribute('aria-invalid', 'true');
      input.focus({ preventScroll: true });
      const f = $('.field', form); if (f) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
      return;
    }
    err.textContent = '';
    try { localStorage.setItem(KEY_USER, u.id); } catch (x) {}
    enter(u, true);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  if (gateGo) {
    gateGo.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
  });

  input.addEventListener('input', () => {
    err.textContent = '';
    input.setAttribute('aria-invalid', 'false');
  });

  function enter(u, animateGate) {
    state.user = u;
    state.day = null;
    state.openSubject = null;
    try { state.examView = localStorage.getItem(KEY_EXAM) !== '0'; } catch (e) { state.examView = true; }
    const initial = u.name.trim().charAt(0);
    ['meAvatar', 'menuAvatar'].forEach((id) => { $('#' + id).textContent = initial; });
    $('#meName').textContent = u.name.split(' ').slice(0, 2).join(' ');
    $('#meGroup').textContent = `Group ${u.group}`;
    $('#popName').textContent = u.name;
    $('#popMeta').textContent = `ID ${u.id} · Group ${u.group}`;
    $('#menuName').textContent = u.name;
    $('#menuMeta').textContent = `ID ${u.id} · Group ${u.group}`;
    syncExamSwitch();
    document.body.classList.remove('is-gate');
    $('#app').hidden = false;
    if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/home');
    route();
    if (animateGate) {
      gate.classList.add('leave');
      gateTimer = setTimeout(() => { gate.hidden = true; $('#stage').focus({ preventScroll: true }); }, reduce ? 0 : 350);
    } else gate.hidden = true;
  }

  function signOut() {
    clearTimeout(gateTimer);
    closePalette();
    closeMenu();
    togglePop(false);
    err.textContent = '';
    input.setAttribute('aria-invalid', 'false');
    try { localStorage.removeItem(KEY_USER); } catch (e) {}
    state.user = null;
    history.replaceState(null, '', location.pathname);
    $('#app').hidden = true;
    document.body.classList.add('is-gate');
    gate.hidden = false;
    void gate.offsetWidth;
    gate.classList.remove('leave');
    input.value = '';
    window.scrollTo(0, 0);
    lines(gate);
    setTimeout(() => input.focus(), 400);
  }

  const top = $('#top');
  addEventListener('scroll', () => top.classList.toggle('stuck', scrollY > 8), { passive: true });

  /* ---------- live countdown ---------- */
  setInterval(() => {
    const c = $('#countdown');
    if (c && state.user && state.view === 'home') { const e = nextExam(state.user.group); if (e) rollNumber(c, countdownText(e.start, e.end)); }
  }, 20000);

  /* ---------- boot ---------- */
  lines(gate);
  let saved = null;
  try { saved = localStorage.getItem(KEY_USER); } catch (e) {}
  const u = saved && lookup(saved);
  if (u) enter(u, false); else setTimeout(() => input.focus(), 700);
})();

