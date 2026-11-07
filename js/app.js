/* CUC Student Portal */
(() => {
  'use strict';
  const D = window.ACADEMIC_DATA;
  if (!D) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    const hit = list.find((a) => a.from_student === 'All' || (id >= Number(a.from_student) && id <= Number(a.to_student)));
    if (hit) return { hall: hit.hall, seats: list.length > 1 ? `Seat range ${hit.from_student} - ${hit.to_student}` : '' };
    return { hall: 'Not listed', seats: 'Your ID is not in the published hall list for this exam. Please confirm with the exams office.' };
  }

  function examsFor(g) {
    return D.subjects.map((s) => {
      const [dd, mm, yy] = s.exam_date.split('/').map(Number);
      return { ...s, start: new Date(yy, mm - 1, dd, 10, 0), end: new Date(yy, mm - 1, dd, 11, 0), ...hallFor(g, s.code) };
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

  function scramble(el, finalText) {
    if (!el || reduce) { if (el) el.textContent = finalText; return; }
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    const t0 = performance.now(), dur = 700;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      let out = '';
      for (let i = 0; i < finalText.length; i++) {
        const c = finalText[i];
        out += (c === '-' || c === ' ' || p > (i + 1) / (finalText.length + 1) ? c : chars[(Math.random() * chars.length) | 0]);
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick); else el.textContent = finalText;
    };
    requestAnimationFrame(tick);
  }

  function lines(root) {
    $$('.ln > span', root).forEach((s) => { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
  }

  /* ---------- reveal on scroll ---------- */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    : null;
  function watch(root) {
    $$('[data-reveal]', root).forEach((el, i) => {
      if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', Math.min(i, 10));
      if (io) io.observe(el); else el.classList.add('in');
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
      <div class="r-time"><b>${fmt12(s.start_time)}</b><span>to ${fmt12(s.end_time)} ${ampm(s.end_time)}</span></div>
      <div class="r-main"><h3>${s.course_title}</h3><p><span class="tag">${s.session_type}</span>${who}</p></div>
      <div class="r-room">${roomText(s.room)}<small>${s.room === 'ONLINE' ? '' : hallInfo(s.room)}</small></div>
    </li>`;
  }

  function examRow(e, detailed) {
    const p = dateParts(e.start);
    return `<li class="row" data-reveal>
      <div class="r-date"><b>${p.day} ${p.mon}</b><span>${p.wd}, 10:00 AM</span></div>
      <div class="r-main"><h3>${e.name}</h3><p>${e.code}${detailed ? ' · 1 hour' : ''}</p>${detailed && e.seats ? `<p>${e.seats}</p>` : ''}${detailed ? `<span class="ar" lang="ar">${e.arabic_name}</span>` : ''}</div>
      <div class="r-room">${e.hall}<small>${hallInfo(e.hall)}</small></div>
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
          <div><span class="lbl">Your hall</span><strong class="room" id="heroRoom">${ne.hall}</strong><span>${hallInfo(ne.hall)}</span></div>
          <div><span class="lbl">When</span><strong>${p.wd.slice(0, 3)} ${p.day} ${p.mon}</strong><span>10:00 - 11:00 AM</span></div>
          <div><span class="lbl">Starts in</span><strong id="countdown">${countdownText(ne.start, ne.end)}</strong><span>${ne.code}</span></div>
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
            <div><span class="lbl">Room</span><strong class="room" id="heroRoom">${roomText(s.room)}</strong><span>${hallInfo(s.room)}</span></div>
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
      <ul class="rows" id="weekList" style="margin-top:12px"></ul>`;
    $$('#seg button').forEach((b) => b.addEventListener('click', () => { state.day = b.dataset.day; paintDay(true); }));
    paintDay(false);
  }

  function paintDay(animate) {
    const g = state.user.group;
    const list = sessionsFor(g).filter((s) => s.day === state.day).sort((a, b) => mins(a.start_time) - mins(b.start_time));
    $$('#seg button').forEach((b) => { const on = b.dataset.day === state.day; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const on = $('#seg button.on'), th = $('#segThumb');
    if (on && th) { th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft}px)`; }
    const ul = $('#weekList');
    ul.innerHTML = list.length ? list.map((s) => sessionRow(s, null)).join('') : `<li class="empty">No classes on ${state.day}.</li>`;
    if (animate) {
      $$('li', ul).forEach((li, i) => { li.classList.add('in'); anim(li, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { d: 700, delay: i * 60 }); });
    } else watch(ul);
  }

  function renderExams() {
    const g = state.user.group, ex = examsFor(g);
    $('#v-exams').innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · Midterms</p>
      <h1 class="h1"><span class="ln"><span>Exam</span></span><span class="ln"><span><em>halls.</em></span></span></h1>
      <p class="lead">Seven exams, one hour each, all starting at 10:00 AM. Your hall is shown on the right.</p>
      <div class="actions"><button class="btn solid" id="btnIcs" type="button">Add to calendar</button><button class="btn" id="btnPrint" type="button">Print slip</button></div>
      <ul class="rows" style="margin-top:36px">${ex.map((e) => examRow(e, true)).join('')}</ul>
      <p class="exam-meta">Student ID ${state.user.id}</p>`;
    $('#btnIcs').addEventListener('click', downloadIcs);
    $('#btnPrint').addEventListener('click', () => window.print());
  }

  function renderSubjects() {
    const g = state.user.group, list = sessionsFor(g), ex = examsFor(g);
    const subs = D.subjects.filter((s) => list.some((x) => x.course_code === s.code));
    $('#v-subjects').innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · First term</p>
      <h1 class="h1"><span class="ln"><span>Your</span></span><span class="ln"><span><em>subjects.</em></span></span></h1>
      <div style="margin-top:48px">${subs.map((s) => {
        const sess = list.filter((x) => x.course_code === s.code).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || mins(a.start_time) - mins(b.start_time));
        const e = ex.find((x) => x.code === s.code);
        return `<div class="acc${state.openSubject === s.code ? ' open' : ''}" id="sub-${s.code}" data-reveal>
          <button class="acc-h" type="button" aria-expanded="${state.openSubject === s.code}">
            <span class="code">${s.code}</span>
            <div><h3>${s.name}</h3><span class="ar" lang="ar">${s.arabic_name}</span></div>
            <span class="plus"></span>
          </button>
          <div class="acc-b"><div><div class="acc-in">
            <p class="desc">${s.description}</p>
            ${sess.map((x) => `<div class="mini"><span>${x.day}</span><div>${fmt12(x.start_time)} - ${fmt12(x.end_time)} ${ampm(x.end_time)} · ${x.session_type}${x.instructor ? ' · ' + x.instructor : ''}</div><b>${roomText(x.room)}</b></div>`).join('')}
            ${e ? `<div class="mini"><span>Midterm</span><div>${dateParts(e.start).wd}, ${dateParts(e.start).day} ${dateParts(e.start).mon} · 10:00 AM</div><b>${e.hall}</b></div>` : ''}
          </div></div></div>
        </div>`;
      }).join('')}</div>`;
    $$('#v-subjects .acc-h').forEach((h) => h.addEventListener('click', () => {
      const a = h.parentElement, open = !a.classList.contains('open');
      $$('#v-subjects .acc').forEach((x) => { x.classList.remove('open'); $('.acc-h', x).setAttribute('aria-expanded', 'false'); });
      state.openSubject = null;
      if (open) { a.classList.add('open'); h.setAttribute('aria-expanded', 'true'); state.openSubject = a.id.slice(4); }
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
      <div style="margin-top:48px">${NOTICES.map((n) => `<article class="note" data-reveal><time>${n.d}</time><div><h3>${n.t}</h3><p>${n.p}</p>${n.a ? `<a class="link" href="#/${n.a[0]}">${n.a[1]}</a>` : ''}</div></article>`).join('')}</div>`;
  }

  const RENDER = { home: renderHome, week: renderWeek, exams: renderExams, subjects: renderSubjects, updates: renderUpdates };

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
    $$('#nav a, .menu-links a').forEach((l) => l.classList.toggle('on', l.dataset.view === name));
    if (a && ink && a.offsetWidth) {
      const w = a.firstChild.textContent.length * 8;
      ink.style.width = Math.min(a.offsetWidth - 28, w) + 'px';
      ink.style.transform = `translateX(${a.offsetLeft + 14}px)`;
    }
  }

  function show(name, first) {
    if (!RENDER[name]) name = 'home';
    state.view = name;
    $$('.view').forEach((v) => { v.hidden = v.dataset.name !== name; });
    const v = $(`#v-${name}`);
    RENDER[name]();
    moveInk(name);
    window.scrollTo(0, 0);
    watch(v);
    lines(v);
    if (!first) anim(v, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { d: 600 });
    const r = $('#heroRoom');
    if (r) scramble(r, r.textContent);
    syncRail();
  }

  function route() {
    const h = (location.hash.replace(/^#\/?/, '') || 'home');
    if (state.user) show(h);
  }
  window.addEventListener('hashchange', () => { closeMenu(); route(); });

  /* ---------- mobile menu ---------- */
  const burger = $('#btnBurger');
  function openMenu() { document.body.classList.add('menu-open'); burger.setAttribute('aria-expanded', 'true'); $('#menu').setAttribute('aria-hidden', 'false'); }
  function closeMenu() { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); $('#menu').setAttribute('aria-hidden', 'true'); }
  burger.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
  $$('#menu .menu-links a').forEach((a) => a.addEventListener('click', () => { if (a.dataset.view === state.view) closeMenu(); }));
  $('#menuSearch').addEventListener('click', () => { closeMenu(); setTimeout(openPalette, 250); });
  $('#menuOut').addEventListener('click', () => { closeMenu(); signOut(); });
  addEventListener('resize', () => { if (innerWidth > 960) closeMenu(); moveInk(state.view); syncRail(); });

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
  let palItems = [], palSel = 0;
  function openPalette() { pal.classList.add('open'); pal.setAttribute('aria-hidden', 'false'); document.body.classList.add('pal-open'); palIn.value = ''; paintPal(''); setTimeout(() => palIn.focus(), 60); }
  function closePalette() { pal.classList.remove('open'); pal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('pal-open'); }
  function paintPal(q) {
    const g = state.user.group; q = q.trim().toLowerCase();
    const sess = sessionsFor(g), ex = examsFor(g);
    const items = [];
    D.subjects.forEach((s) => items.push({ t: s.name, s: s.code, k: `${s.name} ${s.code} ${s.arabic_name}`, go: () => { state.openSubject = s.code; location.hash = '#/subjects'; if (state.view === 'subjects') show('subjects'); } }));
    ex.forEach((e) => items.push({ t: `${e.name} exam`, s: `${dateParts(e.start).day} ${dateParts(e.start).mon} · ${e.hall}`, k: `exam midterm ${e.name} ${e.code} ${e.hall}`, go: () => (location.hash = '#/exams') }));
    [...new Set(sess.map((x) => x.room))].forEach((r) => items.push({ t: roomText(r), s: hallInfo(r), k: `room hall ${r} ${hallInfo(r)}`, go: () => (location.hash = '#/week') }));
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
    } else if (e.key === 'Enter') pickPal(palSel);
  });
  pal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closePalette(); });
  $('#btnSearch').addEventListener('click', openPalette);
  addEventListener('keydown', (e) => {
    if (!state.user) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? closePalette() : openPalette(); }
    if (e.key === 'Escape') { closePalette(); closeMenu(); togglePop(false); }
  });

  /* ---------- auth ---------- */
  const gate = $('#gate'), form = $('#gateForm'), input = $('#gateInput'), err = $('#gateError');
  function lookup(raw) {
    let id = String(raw || '').trim().toLowerCase().replace('@cuc.edu.eg', '').replace(/\D/g, '');
    id = ALIASES[id] || id;
    const s = D.students[id];
    return s ? { id, name: s.name, group: s.group } : null;
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = lookup(input.value);
    if (!u) {
      err.textContent = input.value.trim() ? "This ID was not found in Group 9. Check the digits and try again." : 'Enter your student ID to continue.';
      const f = $('.field', form); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
      return;
    }
    err.textContent = '';
    try { localStorage.setItem(KEY_USER, u.id); } catch (x) {}
    enter(u, true);
  });
  input.addEventListener('input', () => { err.textContent = ''; });

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
      setTimeout(() => { gate.hidden = true; }, 1000);
    } else gate.hidden = true;
  }

  function signOut() {
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

  /* ---------- scroll chrome: header, custom rail ---------- */
  const rail = $('#rail'), thumb = $('#rail b'), top = $('#top');
  let railTimer;
  function syncRail() {
    const doc = document.documentElement, vh = innerHeight, H = doc.scrollHeight;
    if (H <= vh + 4 || document.body.classList.contains('is-gate')) { rail.classList.remove('on'); return; }
    const track = vh - 16, h = Math.max(48, (vh / H) * track);
    const y = (scrollY / (H - vh)) * (track - h);
    thumb.style.height = h + 'px';
    thumb.style.transform = `translateY(${y}px)`;
  }
  addEventListener('scroll', () => {
    top.classList.toggle('stuck', scrollY > 8);
    syncRail();
    if (document.documentElement.scrollHeight > innerHeight + 4) {
      rail.classList.add('on');
      clearTimeout(railTimer);
      railTimer = setTimeout(() => { if (!rail.classList.contains('drag') && !rail.matches(':hover')) rail.classList.remove('on'); }, 1100);
    }
  }, { passive: true });
  let drag = null;
  thumb.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, s: scrollY }; rail.classList.add('drag'); thumb.setPointerCapture(e.pointerId); e.preventDefault(); });
  thumb.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const vh = innerHeight, H = document.documentElement.scrollHeight, track = vh - 16, h = Math.max(48, (vh / H) * track);
    scrollTo(0, drag.s + ((e.clientY - drag.y) / (track - h)) * (H - vh));
  });
  const endDrag = () => { drag = null; rail.classList.remove('drag'); };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);
  rail.addEventListener('pointerdown', (e) => {
    if (e.target === thumb) return;
    const H = document.documentElement.scrollHeight;
    scrollTo({ top: (e.clientY / innerHeight) * (H - innerHeight), behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- cursor + magnetic ---------- */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduce) {
    document.body.classList.add('has-cursor');
    const c = $('#cursor');
    let tx = -50, ty = -50, x = -50, y = -50;
    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      c.classList.toggle('hover', !!e.target.closest('a,button,input,.row,[role="switch"],li[data-n]'));
    }, { passive: true });
    addEventListener('pointerdown', () => c.classList.add('down'));
    addEventListener('pointerup', () => c.classList.remove('down'));
    (function loop() {
      x += (tx - x) * 0.22; y += (ty - y) * 0.22;
      c.style.transform = `translate3d(${x}px,${y}px,0)`;
      requestAnimationFrame(loop);
    })();
    $$('.magnetic').forEach((m) => {
      m.addEventListener('pointermove', (e) => {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.35}px,${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      m.addEventListener('pointerleave', () => { m.style.transform = ''; });
    });
  }

  /* ---------- live countdown ---------- */
  setInterval(() => {
    const c = $('#countdown');
    if (c && state.user && state.view === 'home') { const e = nextExam(state.user.group); if (e) c.textContent = countdownText(e.start, e.end); }
  }, 20000);

  /* ---------- boot ---------- */
  lines(gate);
  let saved = null;
  try { saved = localStorage.getItem(KEY_USER); } catch (e) {}
  const u = saved && lookup(saved);
  if (u) enter(u, false); else setTimeout(() => input.focus(), 700);
})();

