(function () {
  'use strict';

  var STORAGE_KEY = 'kids-calendar:v1';
  var DEFAULT_NAME = '宝贝';
  var EMOJIS = ['🧺', '🦁', '🎂', '🎬', '🏃', '🎨', '🍦', '✨', '🎠', '🏖️', '🎁', '🌈', '⚽', '📚', '🎵', '🚀'];
  var COLORS = {
    mint: '薄荷绿',
    yellow: '阳光黄',
    lav: '香芋紫',
    sky: '天空蓝',
    coral: '珊瑚红'
  };
  var WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'];
  var WEEKDAY_FULL = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  var HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  var els = {
    childEyebrow: document.getElementById('child-eyebrow'),
    monthLabel: document.getElementById('month-label'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    todayJump: document.getElementById('today-jump'),

    settingsBtn: document.getElementById('settings-btn'),
    printBtn: document.getElementById('print-btn'),
    addBtn: document.getElementById('add-btn'),

    todayPill: document.getElementById('today-pill'),
    heroTitle: document.getElementById('hero-title'),
    heroSub: document.getElementById('hero-sub'),
    heroAdd: document.getElementById('hero-add'),

    weekdays: document.getElementById('weekdays'),
    days: document.getElementById('days'),

    upcomingTitle: document.getElementById('upcoming-title'),
    upcomingCount: document.getElementById('upcoming-count'),
    upcomingList: document.getElementById('upcoming-list'),
    upcomingEmpty: document.getElementById('upcoming-empty'),
    emptyText: document.getElementById('empty-text'),
    emptyAdd: document.getElementById('empty-add'),

    eventDialog: document.getElementById('event-dialog'),
    eventForm: document.getElementById('event-form'),
    eventDialogTitle: document.getElementById('event-dialog-title'),
    eventDialogSub: document.getElementById('event-dialog-sub'),
    eventDate: document.getElementById('event-date'),
    eventTitle: document.getElementById('event-title'),
    eventNote: document.getElementById('event-note'),
    emojiRow: document.getElementById('emoji-row'),
    swatchRow: document.getElementById('swatch-row'),
    deleteEvent: document.getElementById('delete-event'),
    saveEvent: document.getElementById('save-event'),

    settingsDialog: document.getElementById('settings-dialog'),
    settingsForm: document.getElementById('settings-form'),
    childName: document.getElementById('child-name'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),

    toast: document.getElementById('toast')
  };

  var state = loadState();
  var now = startOfDay(new Date());
  var view = { year: now.getFullYear(), month: now.getMonth() };
  var lastToday = now;
  var editingId = null;
  var selectedEmoji = EMOJIS[0];
  var selectedColor = 'mint';
  var toastTimer = null;

  init();

  function init() {
    buildPickers();
    bindEvents();
    render();
    window.setInterval(checkDateRollover, 60000);
  }

  /* ---------- storage ---------- */

  function defaultState() {
    return {
      version: 1,
      childName: DEFAULT_NAME,
      settings: { weekStart: 1, theme: 'cream' },
      events: []
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      return defaultState();
    }
  }

  function normalizeState(raw) {
    var base = defaultState();
    if (!raw || typeof raw !== 'object') return base;

    var name = typeof raw.childName === 'string' && raw.childName.trim()
      ? raw.childName.trim().slice(0, 12)
      : base.childName;

    var seen = new Set();
    var events = [];
    if (Array.isArray(raw.events)) {
      raw.events.forEach(function (item) {
        var event = normalizeEvent(item);
        if (!event || seen.has(event.id)) return;
        seen.add(event.id);
        events.push(event);
      });
    }

    return {
      version: 1,
      childName: name,
      settings: Object.assign({}, base.settings, raw.settings && typeof raw.settings === 'object' ? raw.settings : {}),
      events: events
    };
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var date = parseDateKey(String(raw.date || ''));
    if (!date) return null;

    var title = String(raw.title || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!title) return null;

    var emoji = Array.from(String(raw.emoji || '✨')).slice(0, 2).join('') || '✨';
    var color = Object.prototype.hasOwnProperty.call(COLORS, raw.color) ? raw.color : 'mint';
    var note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 120) : '';
    var createdAt = Number(raw.createdAt);
    if (!Number.isFinite(createdAt)) createdAt = Date.now();

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 80) : makeId(),
      date: dateKey(date),
      title: title,
      emoji: emoji,
      color: color,
      note: note,
      createdAt: createdAt
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast('保存失败：浏览器不允许本地存储，请先导出备份');
      return false;
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return 'evt_' + window.crypto.randomUUID();
    }
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- date helpers ---------- */

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseDateKey(key) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dayDiff(from, to) {
    var fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    var toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toUtc - fromUtc) / 86400000);
  }

  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function formatDateCN(date) {
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function formatWeekday(date) {
    return WEEKDAY_FULL[date.getDay() === 0 ? 6 : date.getDay() - 1];
  }

  function monthGrid(year, month) {
    var first = new Date(year, month, 1);
    var offset = (first.getDay() + 6) % 7;
    var cells = [];
    for (var index = 0; index < 42; index += 1) {
      var date = new Date(year, month, 1 - offset + index);
      cells.push({
        date: date,
        key: dateKey(date),
        inMonth: date.getFullYear() === year && date.getMonth() === month
      });
    }
    return cells;
  }

  function compareEvents(a, b) {
    return a.date.localeCompare(b.date)
      || a.createdAt - b.createdAt
      || a.title.localeCompare(b.title, 'zh-CN');
  }

  function getMonthEvents(year, month) {
    var prefix = year + '-' + pad(month + 1);
    return state.events
      .filter(function (event) { return event.date.slice(0, 7) === prefix; })
      .sort(compareEvents);
  }

  function isPastMonth(year, month, today) {
    return year < today.getFullYear()
      || (year === today.getFullYear() && month < today.getMonth());
  }

  function isCurrentMonth(year, month, today) {
    return year === today.getFullYear() && month === today.getMonth();
  }

  function getUpcomingEvents(monthEvents, today, current, past) {
    if (past) return monthEvents;
    if (!current) return monthEvents;
    return monthEvents.filter(function (event) {
      var date = parseDateKey(event.date);
      return date && dayDiff(today, date) >= 0;
    });
  }

  function defaultDateForView(today) {
    if (isCurrentMonth(view.year, view.month, today)) return dateKey(today);
    if (view.year > today.getFullYear()
      || (view.year === today.getFullYear() && view.month > today.getMonth())) {
      return view.year + '-' + pad(view.month + 1) + '-01';
    }
    return dateKey(today);
  }

  /* ---------- rendering ---------- */

  function render() {
    var today = startOfDay(new Date());
    var year = view.year;
    var month = view.month;
    var current = isCurrentMonth(year, month, today);
    var past = isPastMonth(year, month, today);
    var monthEvents = getMonthEvents(year, month);
    var upcoming = getUpcomingEvents(monthEvents, today, current, past);

    renderHeader(year, month, current);
    renderHero(monthEvents, upcoming, today, current, past);
    renderWeekdays();
    renderCalendar(year, month, monthEvents, today, current);
    renderSidebar(monthEvents, upcoming, today, current, past);
    updateDocumentTitle();
  }

  function renderHeader(year, month, current) {
    els.childEyebrow.textContent = state.childName + '的';
    els.monthLabel.innerHTML = '<strong>' + year + '</strong> 年 <strong>' + (month + 1) + '</strong> 月';
    els.todayJump.classList.toggle('hidden', current);
  }

  function renderHero(monthEvents, upcoming, today, current, past) {
    if (current) {
      els.todayPill.innerHTML = '<span class="dot"></span> 今天 · '
        + (today.getMonth() + 1) + '月' + today.getDate() + '日 ' + formatWeekday(today);
    } else {
      els.todayPill.innerHTML = '<span class="dot"></span> 正在看 · '
        + view.year + '年' + (view.month + 1) + '月';
    }

    if (past) {
      els.heroTitle.textContent = '这个月已经过去啦';
      if (monthEvents.length) {
        els.heroSub.innerHTML = '这个月留下了 <b>' + monthEvents.length + '</b> 个小小回忆。点「今天」回去看看接下来的好事。';
      } else {
        els.heroSub.textContent = '这个月没有留下期待。点「今天」回去看看接下来的好事。';
      }
      els.heroAdd.classList.add('hidden');
      return;
    }

    if (upcoming.length) {
      var next = upcoming[0];
      var nextDate = parseDateKey(next.date);
      var diff = nextDate ? dayDiff(today, nextDate) : 0;
      var label = '<em>' + escapeHtml(next.emoji) + ' ' + escapeHtml(next.title) + '</em>';

      if (diff === 0) {
        els.heroTitle.innerHTML = '今天就是 ' + label + ' 的日子！';
      } else if (diff === 1) {
        els.heroTitle.innerHTML = '明天就是 ' + label + ' 啦！';
      } else {
        els.heroTitle.innerHTML = '距离 ' + label + ' <span class="countdown-phrase">还有 <strong>' + diff + '</strong> 天</span>';
      }

      els.heroSub.innerHTML = '本月有 <b>' + monthEvents.length + '</b> 个小小期待，慢慢等，都会来。';
      els.heroAdd.classList.add('hidden');
      return;
    }

    els.heroAdd.classList.remove('hidden');
    if (monthEvents.length) {
      els.heroTitle.textContent = '这个月的期待都实现啦';
      els.heroSub.textContent = '再写一个新的期待，或者翻到下个月看看。';
      els.heroAdd.textContent = '＋ 再写一个期待';
    } else {
      els.heroTitle.textContent = '这个月还没有期待';
      els.heroSub.textContent = '点「添加期待」，把下一件好事放进来。';
      els.heroAdd.textContent = '＋ 写下第一个期待';
    }
  }

  function renderWeekdays() {
    els.weekdays.innerHTML = WEEKDAY_SHORT.map(function (day) {
      return '<span>' + day + '</span>';
    }).join('');
  }

  function renderCalendar(year, month, monthEvents, today, current) {
    var eventsByDate = {};
    monthEvents.forEach(function (event) {
      if (!eventsByDate[event.date]) eventsByDate[event.date] = [];
      eventsByDate[event.date].push(event);
    });

    var cells = monthGrid(year, month);
    els.days.innerHTML = cells.map(function (cell) {
      var events = eventsByDate[cell.key] || [];
      var isToday = current && cell.inMonth && sameDate(cell.date, today);
      var isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
      var classes = ['day'];
      if (!cell.inMonth) classes.push('out');
      if (isWeekend) classes.push('weekend');
      if (isToday) classes.push('today');
      if (events.length) {
        classes.push('cat-' + events[0].color);
      } else {
        classes.push('is-empty');
      }

      var detail = events.length
        ? '，有 ' + events.length + ' 个期待'
        : '，点击添加期待';
      var label = formatDateCN(cell.date) + ' ' + formatWeekday(cell.date)
        + (isToday ? '，今天' : '') + detail;
      var interactive = events.length
        ? ''
        : ' role="button" tabindex="0"';

      return '<div class="' + classes.join(' ') + '"' + interactive + ' data-date="' + cell.key + '" aria-label="' + escapeAttr(label) + '">'
        + '<span class="day-num">' + cell.date.getDate() + '</span>'
        + (isToday ? '<span class="today-label">今天</span>' : '')
        + (events.length
          ? '<div class="day-events">' + events.map(eventChip).join('') + '</div>'
          : '')
        + '</div>';
    }).join('');
  }

  function eventChip(event) {
    var date = parseDateKey(event.date);
    var label = '编辑期待：' + (date ? formatDateCN(date) : '') + ' ' + event.title;
    var tooltip = event.title + (event.note ? ' · ' + event.note : '');
    return '<button type="button" class="event ev-' + event.color + '" data-event-id="' + escapeAttr(event.id) + '"'
      + ' aria-label="' + escapeAttr(label) + '" title="' + escapeAttr(tooltip) + '">'
      + '<span class="ev-emoji" aria-hidden="true">' + escapeHtml(event.emoji) + '</span>'
      + '<span class="ev-text">' + escapeHtml(event.title) + '</span>'
      + '</button>';
  }

  function renderSidebar(monthEvents, upcoming, today, current, past) {
    var list = past ? monthEvents : upcoming;
    els.upcomingTitle.textContent = past ? '这个月的期待' : '接下来的期待';
    els.upcomingCount.textContent = list.length + ' 个';

    if (!list.length) {
      els.upcomingList.innerHTML = '';
      els.upcomingEmpty.classList.remove('hidden');
      if (past) {
        els.emptyText.textContent = '这个月没有留下期待';
        els.emptyAdd.textContent = '写下第一件好事 →';
      } else if (monthEvents.length) {
        els.emptyText.textContent = '这个月的期待都实现啦';
        els.emptyAdd.textContent = '再写一个期待 →';
      } else {
        els.emptyText.textContent = '这个月还没有期待';
        els.emptyAdd.textContent = '写下第一件好事 →';
      }
      return;
    }

    els.upcomingEmpty.classList.add('hidden');
    els.upcomingList.innerHTML = list.map(function (event, index) {
      var date = parseDateKey(event.date);
      if (!date) return '';
      var diff = dayDiff(today, date);
      var countdown;
      var countdownClass = '';
      if (diff < 0) {
        countdown = '已经过去';
        countdownClass = 'past';
      } else if (diff === 0) {
        countdown = '就是今天';
        countdownClass = 'soon';
      } else if (diff === 1) {
        countdown = '明天';
        countdownClass = 'soon';
      } else {
        countdown = '还有 ' + diff + ' 天';
        if (diff <= 7) countdownClass = 'soon';
      }

      var next = index === 0 && !past && diff >= 0;
      var label = '编辑期待：' + formatDateCN(date) + ' ' + event.title;
      var tooltip = event.title + (event.note ? ' · ' + event.note : '');

      return '<li' + (next ? ' class="next"' : '') + '>'
        + '<button type="button" class="up-item" data-event-id="' + escapeAttr(event.id) + '"'
        + ' aria-label="' + escapeAttr(label) + '" title="' + escapeAttr(tooltip) + '">'
        + '<span class="date-badge" aria-hidden="true"><span>' + (date.getMonth() + 1) + '月</span><strong>' + pad(date.getDate()) + '</strong></span>'
        + '<span class="up-body"><p>' + escapeHtml(event.emoji) + ' ' + escapeHtml(event.title) + '</p>'
        + '<small>' + formatWeekday(date) + ' · <span class="' + countdownClass + '">' + countdown + '</span></small></span>'
        + '</button></li>';
    }).join('');
  }

  function updateDocumentTitle() {
    document.title = state.childName + '的期待日历 · ' + view.year + '年' + (view.month + 1) + '月';
  }

  /* ---------- events ---------- */

  function bindEvents() {
    els.prevMonth.addEventListener('click', function () { changeMonth(-1); });
    els.nextMonth.addEventListener('click', function () { changeMonth(1); });
    els.todayJump.addEventListener('click', goToday);

    els.addBtn.addEventListener('click', function () {
      openAddDialog(defaultDateForView(startOfDay(new Date())));
    });
    els.heroAdd.addEventListener('click', function () {
      openAddDialog(defaultDateForView(startOfDay(new Date())));
    });
    els.emptyAdd.addEventListener('click', function () {
      openAddDialog(defaultDateForView(startOfDay(new Date())));
    });

    els.days.addEventListener('click', onCalendarClick);
    els.days.addEventListener('keydown', onCalendarKeydown);
    els.upcomingList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-event-id]');
      if (button) openEditDialog(button.getAttribute('data-event-id'));
    });

    els.settingsBtn.addEventListener('click', openSettings);
    els.printBtn.addEventListener('click', printCalendar);
    els.eventForm.addEventListener('submit', submitEventForm);
    els.deleteEvent.addEventListener('click', deleteCurrentEvent);
    els.settingsForm.addEventListener('submit', saveSettings);

    els.exportBtn.addEventListener('click', exportJson);
    els.importBtn.addEventListener('click', function () { els.importFile.click(); });
    els.importFile.addEventListener('change', importJson);

    els.emojiRow.addEventListener('click', function (event) {
      var button = event.target.closest('.emoji-btn');
      if (!button) return;
      selectedEmoji = button.getAttribute('data-emoji');
      syncPickers();
    });

    els.swatchRow.addEventListener('click', function (event) {
      var button = event.target.closest('.swatch');
      if (!button) return;
      selectedColor = button.getAttribute('data-color');
      syncPickers();
    });

    document.querySelectorAll('[data-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        closeDialog(button.closest('dialog'));
      });
    });

    [els.eventDialog, els.settingsDialog].forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeDialog(dialog);
      });
      dialog.addEventListener('close', function () {
        if (!document.querySelector('dialog[open]')) {
          document.body.classList.remove('dialog-open');
        }
      });
    });

    window.addEventListener('beforeprint', function () {
      document.title = state.childName + '的期待日历 · ' + view.year + '年' + (view.month + 1) + '月';
    });
    window.addEventListener('afterprint', updateDocumentTitle);
  }

  function changeMonth(delta) {
    var date = new Date(view.year, view.month + delta, 1);
    view = { year: date.getFullYear(), month: date.getMonth() };
    render();
  }

  function goToday() {
    var today = startOfDay(new Date());
    view = { year: today.getFullYear(), month: today.getMonth() };
    render();
  }

  function onCalendarClick(event) {
    var eventButton = event.target.closest('[data-event-id]');
    if (eventButton) {
      openEditDialog(eventButton.getAttribute('data-event-id'));
      return;
    }
    var day = event.target.closest('.day');
    if (day && day.getAttribute('data-date')) {
      openAddDialog(day.getAttribute('data-date'));
    }
  }

  function onCalendarKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('[data-event-id]')) return;
    var day = event.target.closest('.day');
    if (!day || !day.getAttribute('data-date')) return;
    event.preventDefault();
    openAddDialog(day.getAttribute('data-date'));
  }

  /* ---------- event dialog ---------- */

  function buildPickers() {
    els.emojiRow.innerHTML = EMOJIS.map(function (emoji, index) {
      return '<button type="button" class="emoji-btn" data-emoji="' + escapeAttr(emoji) + '"'
        + ' aria-pressed="' + String(index === 0) + '" aria-label="选择 ' + escapeAttr(emoji) + '">'
        + escapeHtml(emoji) + '</button>';
    }).join('');

    els.swatchRow.innerHTML = Object.keys(COLORS).map(function (key, index) {
      return '<button type="button" class="swatch ' + key + '" data-color="' + key + '"'
        + ' aria-pressed="' + String(index === 0) + '" aria-label="' + escapeAttr(COLORS[key]) + '"></button>';
    }).join('');
  }

  function syncPickers() {
    els.emojiRow.querySelectorAll('.emoji-btn').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-emoji') === selectedEmoji));
    });
    els.swatchRow.querySelectorAll('.swatch').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-color') === selectedColor));
    });
  }

  function openAddDialog(dateString) {
    editingId = null;
    selectedEmoji = EMOJIS[0];
    selectedColor = 'mint';
    els.eventDialogTitle.textContent = '添加一个期待';
    els.eventDialogSub.textContent = '写下一件会发生的好事，给它选个贴纸。';
    els.eventForm.reset();
    els.eventDate.value = dateString || defaultDateForView(startOfDay(new Date()));
    els.eventNote.value = '';
    els.deleteEvent.classList.add('hidden');
    els.saveEvent.textContent = '存起来';
    syncPickers();
    openDialog(els.eventDialog);
    window.setTimeout(function () { els.eventTitle.focus(); }, 80);
  }

  function openEditDialog(id) {
    var found = state.events.find(function (event) { return event.id === id; });
    if (!found) return;

    editingId = id;
    selectedEmoji = found.emoji;
    selectedColor = found.color;
    els.eventDialogTitle.textContent = '编辑期待';
    els.eventDialogSub.textContent = '改一改时间、贴纸或名字都可以。';
    els.eventDate.value = found.date;
    els.eventTitle.value = found.title;
    els.eventNote.value = found.note || '';
    els.deleteEvent.classList.remove('hidden');
    els.saveEvent.textContent = '保存修改';
    syncPickers();
    openDialog(els.eventDialog);
    window.setTimeout(function () {
      els.eventTitle.focus();
      els.eventTitle.select();
    }, 80);
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    document.body.classList.add('dialog-open');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    if (!document.querySelector('dialog[open]')) {
      document.body.classList.remove('dialog-open');
    }
  }

  function submitEventForm(event) {
    event.preventDefault();

    var date = parseDateKey(els.eventDate.value);
    var title = els.eventTitle.value.trim().replace(/\s+/g, ' ').slice(0, 40);
    var note = els.eventNote.value.trim().slice(0, 120);

    if (!date) {
      showToast('先选一个日期吧');
      els.eventDate.focus();
      return;
    }
    if (!title) {
      showToast('给这个期待起个名字吧');
      els.eventTitle.focus();
      return;
    }

    var wasEditing = Boolean(editingId);

    if (wasEditing) {
      state.events = state.events.map(function (item) {
        if (item.id !== editingId) return item;
        return {
          id: item.id,
          date: dateKey(date),
          title: title,
          emoji: selectedEmoji,
          color: selectedColor,
          note: note,
          createdAt: item.createdAt
        };
      });
    } else {
      state.events.push({
        id: makeId(),
        date: dateKey(date),
        title: title,
        emoji: selectedEmoji,
        color: selectedColor,
        note: note,
        createdAt: Date.now()
      });
    }

    editingId = null;
    var saved = saveState();
    closeDialog(els.eventDialog);
    view = { year: date.getFullYear(), month: date.getMonth() };
    render();
    if (saved) showToast(wasEditing ? '期待已更新 ✨' : '期待贴上日历啦 ✨');
  }

  function deleteCurrentEvent() {
    if (!editingId) return;
    var found = state.events.find(function (event) { return event.id === editingId; });
    if (!found) return;
    if (!window.confirm('删除「' + found.title + '」这个期待吗？')) return;

    state.events = state.events.filter(function (event) { return event.id !== editingId; });
    editingId = null;
    var saved = saveState();
    closeDialog(els.eventDialog);
    render();
    if (saved) showToast('已删除这个期待');
  }

  /* ---------- settings & backup ---------- */

  function openSettings() {
    els.childName.value = state.childName;
    openDialog(els.settingsDialog);
    window.setTimeout(function () { els.childName.focus(); els.childName.select(); }, 80);
  }

  function saveSettings(event) {
    event.preventDefault();
    var name = els.childName.value.trim().replace(/\s+/g, ' ').slice(0, 12);
    state.childName = name || DEFAULT_NAME;
    var saved = saveState();
    closeDialog(els.settingsDialog);
    render();
    if (saved) showToast('名字已保存');
  }

  function exportJson() {
    var payload = {
      version: 1,
      childName: state.childName,
      settings: state.settings,
      events: state.events,
      exportedAt: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'kids-calendar-' + dateKey(new Date()) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('备份已导出');
  }

  function importJson() {
    var file = els.importFile.files && els.importFile.files[0];
    els.importFile.value = '';
    if (!file) return;

    file.text().then(function (text) {
      var data = JSON.parse(text);
      var rawEvents = Array.isArray(data) ? data : (data && Array.isArray(data.events) ? data.events : null);
      if (!rawEvents) throw new Error('格式不正确');

      var imported = [];
      var seen = new Set();
      rawEvents.forEach(function (item) {
        var event = normalizeEvent(item);
        if (!event || seen.has(event.id)) return;
        seen.add(event.id);
        imported.push(event);
      });

      if (rawEvents.length && !imported.length) throw new Error('没有可用的期待');

      if (!window.confirm('导入 ' + imported.length + ' 个期待，会替换当前日历。继续吗？')) return;

      state.events = imported;
      if (data && !Array.isArray(data) && typeof data.childName === 'string' && data.childName.trim()) {
        state.childName = data.childName.trim().slice(0, 12);
      }
      var saved = saveState();
      goToday();
      closeDialog(els.settingsDialog);
      if (saved) showToast('已导入 ' + imported.length + ' 个期待');
    }).catch(function () {
      showToast('导入失败：请选择正确的 JSON 备份');
    });
  }

  /* ---------- print ---------- */

  function printCalendar() {
    document.querySelectorAll('dialog[open]').forEach(closeDialog);
    window.setTimeout(function () { window.print(); }, 80);
  }

  /* ---------- misc ---------- */

  function checkDateRollover() {
    var today = startOfDay(new Date());
    if (dateKey(today) === dateKey(lastToday)) return;

    if (view.year === lastToday.getFullYear() && view.month === lastToday.getMonth()) {
      view = { year: today.getFullYear(), month: today.getMonth() };
    }
    lastToday = today;
    render();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return HTML_ESCAPES[character];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('show');
    }, 2600);
  }
}());
