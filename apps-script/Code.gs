/**
 * シフト管理アプリ（ダミー）用 Apps Script
 *
 * このファイルはスプレッドシートの「拡張機能 → Apps Script」に丸ごと貼り付けて使う。
 * リポジトリには控えとして置いているだけで、ここを直したら貼り直し＋「新バージョン」でデプロイし直す。
 *
 * 役割は「スプシを読む・書く」だけ。過不足の計算や LINE 文面づくりは Next.js 側（src/lib/shift-rules.ts）で行う。
 */

const ROSTER_SHEET = '名簿';
const TEMPLATE_SHEET = 'ひな形';

// 月のシートのレイアウト（docs/requirements.md と実装計画の表に合わせる）
const PUBLISH_CELL = 'B1';
const DATE_ROW = 2;
const WEEKDAY_ROW = 3;
const HOLIDAY_ROW = 4;
const FIRST_MEMBER_ROW = 8;
const LAST_MEMBER_ROW = 40;
const FIRST_DAY_COL = 3; // C列 = 1日
const MAX_DAYS = 31; // C〜AG列
const DAYS_TOTAL_COL = FIRST_DAY_COL + MAX_DAYS; // AH列 = 日数

const AVAILABLE_COLOR = '#fff2cc'; // 勤務可能日の薄い黄色
const EMPTY_COLOR = '#ffffff';
const HOLIDAY_CALENDAR_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

// ダミーの名簿（docs/requirements.md「ダミーの名簿」）。学生は適当に選んだ
const DUMMY_ROSTER = [
  ['山崎', '社員', false],
  ['森', '社員', false],
  ['池田', '社員', false],
  ['橋本', '社員', false],
  ['阿部', '社員', false],
  ['佐藤', 'バイト', false],
  ['鈴木', 'バイト', true],
  ['高橋', 'バイト', false],
  ['田中', 'バイト', true],
  ['伊藤', 'バイト', false],
  ['渡辺', 'バイト', true],
  ['山本', 'バイト', false],
  ['中村', 'バイト', true],
  ['小林', 'バイト', false],
  ['加藤', 'バイト', true],
  ['吉田', 'バイト', false],
  ['山田', 'バイト', true],
  ['佐々木', 'バイト', false],
  ['山口', 'バイト', true],
  ['松本', 'バイト', false],
  ['井上', 'バイト', true],
  ['木村', 'バイト', false],
  ['林', 'バイト', false],
  ['斎藤', 'バイト', true],
  ['清水', 'バイト', false],
];

// ───────────────────────── 窓口（ウェブアプリ） ─────────────────────────

function doGet(e) {
  return respond(function () {
    const p = e.parameter;
    switch (p.action) {
      case 'members':
        return { members: getMembers() };
      case 'month':
        return getMonth(p.month);
      case 'availability':
        return { days: getAvailability(p.name, p.month) };
      default:
        throw new Error('unknown action: ' + p.action);
    }
  });
}

function doPost(e) {
  return respond(function () {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'submitAvailability':
        submitAvailability(body.name, body.month, body.days);
        return {};
      default:
        throw new Error('unknown action: ' + body.action);
    }
  });
}

function respond(fn) {
  let result;
  try {
    result = Object.assign({ ok: true }, fn());
  } catch (err) {
    result = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ───────────────────────── 読む・書く ─────────────────────────

/** 名簿シートのメンバー（表示順は名簿の順） */
function getMembers() {
  const sheet = getSheetOrThrow(ROSTER_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, 3)
    .getValues()
    .filter(function (r) {
      return String(r[0]).trim() !== '';
    })
    .map(function (r) {
      return { name: String(r[0]).trim(), type: String(r[1]).trim(), student: r[2] === true };
    });
}

/**
 * その月のシートの中身。シートがなければ exists:false（日付と祝日だけは返す。勤務可能日のカレンダーで使うため）
 * holiday は祝日名（祝日でなければ空文字）
 */
function getMonth(month) {
  const ym = parseMonth(month);
  const dayCount = daysInMonth(ym.year, ym.month);
  const sheet = SpreadsheetApp.getActive().getSheetByName(month);
  if (!sheet) {
    return {
      month: month,
      exists: false,
      published: false,
      days: buildDays(ym, holidayNames(month)),
      rows: [],
    };
  }

  const holidayRange = sheet.getRange(HOLIDAY_ROW, FIRST_DAY_COL, 1, dayCount);
  const notes = holidayRange.getNotes()[0];
  const marks = holidayRange.getDisplayValues()[0];
  const days = buildDays(
    ym,
    marks.map(function (mark, i) {
      return mark === '' ? '' : notes[i] || mark;
    })
  );

  const rows = [];
  const lastRow = Math.min(sheet.getLastRow(), LAST_MEMBER_ROW);
  if (lastRow >= FIRST_MEMBER_ROW) {
    const values = sheet
      .getRange(FIRST_MEMBER_ROW, 1, lastRow - FIRST_MEMBER_ROW + 1, FIRST_DAY_COL - 1 + dayCount)
      .getDisplayValues();
    values.forEach(function (r) {
      const name = String(r[0]).trim();
      if (name === '') return;
      rows.push({
        name: name,
        type: String(r[1]).trim(),
        cells: r.slice(FIRST_DAY_COL - 1).map(function (c) {
          return String(c).trim();
        }),
      });
    });
  }

  return {
    month: month,
    exists: true,
    published: sheet.getRange(PUBLISH_CELL).getValue() === true,
    days: days,
    rows: rows,
  };
}

/** その人が勤務可能日として出している日（セルが薄い黄色の日） */
function getAvailability(name, month) {
  const ym = parseMonth(month);
  const sheet = SpreadsheetApp.getActive().getSheetByName(month);
  if (!sheet) return [];
  const row = findMemberRow(sheet, name);
  if (row === -1) return [];
  const backgrounds = sheet
    .getRange(row, FIRST_DAY_COL, 1, daysInMonth(ym.year, ym.month))
    .getBackgrounds()[0];
  const days = [];
  backgrounds.forEach(function (bg, i) {
    if (bg.toLowerCase() === AVAILABLE_COLOR) days.push(i + 1);
  });
  return days;
}

/**
 * 勤務可能日を提出する（F-03）。その人の行の背景だけを塗り直し、中身の L/F/早/遅 は触らない。
 * シートがなければひな形から作る（F-14）。
 */
function submitAvailability(name, month, days) {
  const ym = parseMonth(month);
  const member = getMembers().filter(function (m) {
    return m.name === name;
  })[0];
  if (!member) throw new Error('名簿にいない名前です: ' + name);

  const dayCount = daysInMonth(ym.year, ym.month);
  if (!Array.isArray(days)) throw new Error('days が配列ではありません');
  const selected = {};
  days.forEach(function (d) {
    if (!Number.isInteger(d) || d < 1 || d > dayCount) throw new Error('日付がおかしいです: ' + d);
    selected[d] = true;
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureMonthSheet(month);
    let row = findMemberRow(sheet, name);
    if (row === -1) row = appendMemberRow(sheet, member);
    const colors = [];
    for (let d = 1; d <= dayCount; d++) colors.push(selected[d] ? AVAILABLE_COLOR : EMPTY_COLOR);
    sheet.getRange(row, FIRST_DAY_COL, 1, dayCount).setBackgrounds([colors]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── 月のシートづくり ─────────────────────────

/** 月のシートがなければ「ひな形」をコピーして作る（F-14） */
function ensureMonthSheet(month) {
  const ym = parseMonth(month);
  const ss = SpreadsheetApp.getActive();
  const existing = ss.getSheetByName(month);
  if (existing) return existing;

  const sheet = getSheetOrThrow(TEMPLATE_SHEET).copyTo(ss).setName(month);
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(ss.getNumSheets());

  sheet.getRange(DATE_ROW, FIRST_DAY_COL).setValue(new Date(ym.year, ym.month - 1, 1));

  // 社員が上、その下にバイト（それぞれ名簿の順）
  const members = getMembers();
  const ordered = members
    .filter(function (m) {
      return m.type === '社員';
    })
    .concat(
      members.filter(function (m) {
        return m.type !== '社員';
      })
    );
  if (ordered.length > LAST_MEMBER_ROW - FIRST_MEMBER_ROW + 1) {
    throw new Error('名簿の人数が多すぎます（' + (LAST_MEMBER_ROW - FIRST_MEMBER_ROW + 1) + '人まで）');
  }
  if (ordered.length > 0) {
    sheet
      .getRange(FIRST_MEMBER_ROW, 1, ordered.length, 2)
      .setValues(ordered.map(memberRowValues));
  }

  writeHolidays(sheet, month);
  return sheet;
}

/**
 * 4行目に祝日の印「祝」を書き、祝日名はセルのメモに入れる（F-08）。Google カレンダーの「日本の祝日」から取る。
 * 列が狭いのでセルには1文字だけ書く（名前を書くと隣のセルにはみ出す）。
 */
function writeHolidays(sheet, month) {
  const notes = holidayNames(month);
  const marks = notes.map(function (n) {
    return n === '' ? '' : '祝';
  });
  const range = sheet.getRange(HOLIDAY_ROW, FIRST_DAY_COL, 1, MAX_DAYS);
  range.setValues([marks]);
  range.setNotes([notes]);
}

/** その月の祝日名（31個の配列。祝日でない日は空文字） */
function holidayNames(month) {
  const ym = parseMonth(month);
  const calendar =
    CalendarApp.getCalendarById(HOLIDAY_CALENDAR_ID) ||
    CalendarApp.subscribeToCalendar(HOLIDAY_CALENDAR_ID);
  const start = new Date(ym.year, ym.month - 1, 1);
  const end = new Date(ym.year, ym.month, 1);
  const names = [];
  for (let i = 0; i < MAX_DAYS; i++) names.push('');
  calendar.getEvents(start, end).forEach(function (ev) {
    const title = ev.getTitle();
    if (!isPublicHoliday(title)) return;
    const i = ev.getAllDayStartDate().getDate() - 1;
    names[i] = names[i] ? names[i] + '・' + title : title;
  });
  return names;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function buildDays(ym, holidays) {
  const days = [];
  for (let d = 1; d <= daysInMonth(ym.year, ym.month); d++) {
    days.push({
      day: d,
      weekday: WEEKDAYS[new Date(ym.year, ym.month - 1, d).getDay()],
      holiday: holidays[d - 1] || '',
    });
  }
  return days;
}

// 国民の祝日（祝日法）の名前。このカレンダーには七五三などの記念日も入るので、名前で見分ける
const PUBLIC_HOLIDAYS = [
  '元日', '成人の日', '建国記念の日', '天皇誕生日', '春分の日', '昭和の日', '憲法記念日',
  'みどりの日', 'こどもの日', '海の日', '山の日', '敬老の日', '秋分の日', 'スポーツの日',
  '文化の日', '勤労感謝の日',
];

function isPublicHoliday(title) {
  const name = String(title).trim();
  // 振替休日・国民の休日は「休日」で拾う（「元日 振替休日」のような書き方にも対応）
  return name.indexOf('休日') !== -1 || PUBLIC_HOLIDAYS.some(function (h) {
    return name.indexOf(h) !== -1;
  });
}

function appendMemberRow(sheet, member) {
  const names = sheet
    .getRange(FIRST_MEMBER_ROW, 1, LAST_MEMBER_ROW - FIRST_MEMBER_ROW + 1, 1)
    .getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === '') {
      const row = FIRST_MEMBER_ROW + i;
      sheet.getRange(row, 1, 1, 2).setValues([memberRowValues(member)]);
      return row;
    }
  }
  throw new Error('シートに空いている行がありません');
}

function memberRowValues(m) {
  return [m.name, m.student ? m.type + '(学)' : m.type];
}

// ───────────────────────── 最初の準備（手で1回実行） ─────────────────────────

/** 名簿・ひな形・翌月のシートを作る。何度実行しても名簿とひな形を作り直すだけ（月のシートは消さない） */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActive();

  let roster = ss.getSheetByName(ROSTER_SHEET);
  if (!roster) roster = ss.insertSheet(ROSTER_SHEET, 0);
  roster.clear();
  roster.getRange(1, 1, 1, 3).setValues([['名前', '区分', '学生']]).setFontWeight('bold');
  roster.getRange(2, 1, DUMMY_ROSTER.length, 3).setValues(DUMMY_ROSTER);
  roster.getRange(2, 3, DUMMY_ROSTER.length, 1).insertCheckboxes();
  roster.setFrozenRows(1);

  const oldTemplate = ss.getSheetByName(TEMPLATE_SHEET);
  if (oldTemplate) ss.deleteSheet(oldTemplate);
  buildTemplate(ss.insertSheet(TEMPLATE_SHEET, 1));

  // 最初からある「シート1」は空なら消す
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getNumSheets() > 1) {
    ss.deleteSheet(defaultSheet);
  }

  ensureMonthSheet(nextMonthKey());
}

function buildTemplate(sheet) {
  const lastDayCol = FIRST_DAY_COL + MAX_DAYS - 1;
  const dayCols = sheet.getRange(DATE_ROW, FIRST_DAY_COL, 1, MAX_DAYS);
  const memberCells = sheet.getRange(
    FIRST_MEMBER_ROW,
    FIRST_DAY_COL,
    LAST_MEMBER_ROW - FIRST_MEMBER_ROW + 1,
    MAX_DAYS
  );
  const statusRow = sheet.getRange(7, FIRST_DAY_COL, 1, MAX_DAYS);

  sheet.getRange('A1').setValue('公開する');
  sheet.getRange(PUBLISH_CELL).insertCheckboxes();
  sheet.getRange(DATE_ROW, 1, 1, 2).setValues([['名前', '区分']]);
  sheet.getRange(DATE_ROW, DAYS_TOTAL_COL).setValue('日数');
  sheet.getRange(5, 1, 3, 1).setValues([['必要人数'], ['人数'], ['充足可否']]);

  // 2行目：C2 にその月の1日（月ごとに Apps Script が入れる）、D2 から右は前の日 +1（月をこえたら空）
  sheet
    .getRange(DATE_ROW, FIRST_DAY_COL + 1, 1, MAX_DAYS - 1)
    .setFormulaR1C1('=IF(R[0]C[-1]="","",IF(MONTH(R[0]C[-1]+1)=MONTH(R[0]C' + FIRST_DAY_COL + '),R[0]C[-1]+1,""))');
  dayCols.setNumberFormat('d');

  const m = 'R' + FIRST_MEMBER_ROW + 'C:R' + LAST_MEMBER_ROW + 'C';
  sheet.getRange(WEEKDAY_ROW, FIRST_DAY_COL, 1, MAX_DAYS).setFormulaR1C1('=IF(R2C="","",TEXT(R2C,"ddd"))');
  sheet
    .getRange(5, FIRST_DAY_COL, 1, MAX_DAYS)
    .setFormulaR1C1('=IF(R2C="","",IF(OR(WEEKDAY(R2C,2)>=6,R4C<>""),4,3))');
  sheet
    .getRange(6, FIRST_DAY_COL, 1, MAX_DAYS)
    .setFormulaR1C1(
      '=IF(R2C="","",COUNTIF(' + m + ',"L")+COUNTIF(' + m + ',"F")+0.5*(COUNTIF(' + m + ',"早")+COUNTIF(' + m + ',"遅")))'
    );
  statusRow.setFormulaR1C1('=IF(R2C="","",IF(R6C<R5C,"✕",IF(R6C=R5C,"○","多")))');

  // 右端の「日数」（F-09）
  const r = 'RC' + FIRST_DAY_COL + ':RC' + lastDayCol;
  sheet
    .getRange(FIRST_MEMBER_ROW, DAYS_TOTAL_COL, LAST_MEMBER_ROW - FIRST_MEMBER_ROW + 1, 1)
    .setFormulaR1C1(
      '=IF(RC1="","",COUNTIF(' + r + ',"L")+COUNTIF(' + r + ',"F")+COUNTIF(' + r + ',"早")+COUNTIF(' + r + ',"遅"))'
    );

  // 条件付き書式（F-06・F-07）。背景色（勤務可能日の黄色）の上に重ねて表示される
  const rule = function (range, text, color) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(text)
      .setBackground(color)
      .setRanges([range])
      .build();
  };
  sheet.setConditionalFormatRules([
    rule(memberCells, 'L', '#e06666'),
    rule(memberCells, 'F', '#6fa8dc'),
    rule(statusRow, '✕', '#f4cccc'),
    rule(statusRow, '○', '#d9ead3'),
    rule(statusRow, '多', '#fce5cd'),
  ]);

  memberCells.setBackground(EMPTY_COLOR).setHorizontalAlignment('center');
  sheet.getRange(DATE_ROW, FIRST_DAY_COL, 6, MAX_DAYS).setHorizontalAlignment('center');
  sheet.getRange(1, 1, 7, 2).setFontWeight('bold');
  sheet.setColumnWidths(FIRST_DAY_COL, MAX_DAYS, 36);
  sheet.setFrozenRows(7);
  sheet.setFrozenColumns(2);
}

// ───────────────────────── デモ用データ ─────────────────────────

/**
 * デモ用に L/F/早/遅 と勤務可能日の黄色を入れる。足りない日（1枠・早番だけ等）が何日か出るようにしてある。
 * その月の割り当てを全部上書きするので、本番の表では使わない。
 */
function fillSampleData(month) {
  const ym = parseMonth(month);
  const sheet = ensureMonthSheet(month);
  const dayCount = daysInMonth(ym.year, ym.month);
  const lastRow = Math.min(sheet.getLastRow(), LAST_MEMBER_ROW);
  const memberCount = lastRow - FIRST_MEMBER_ROW + 1;
  if (memberCount < 1) throw new Error('メンバーがいません');

  const types = sheet.getRange(FIRST_MEMBER_ROW, 2, memberCount, 1).getValues();
  const staffIdx = [];
  const partIdx = [];
  types.forEach(function (t, i) {
    (String(t[0]) === '社員' ? staffIdx : partIdx).push(i);
  });
  const required = sheet.getRange(5, FIRST_DAY_COL, 1, dayCount).getValues()[0];

  const values = [];
  const colors = [];
  for (let i = 0; i < memberCount; i++) {
    values.push(new Array(dayCount).fill(''));
    colors.push(new Array(dayCount).fill(EMPTY_COLOR));
  }

  for (let d = 0; d < dayCount; d++) {
    // 日によって並びをずらして、毎日ちがう人が入るようにする
    const pool = partIdx.map(function (_, k) {
      return partIdx[(k * 7 + d * 3) % partIdx.length];
    });
    // 入れる人より少し多めに「勤務可能日（黄色）」を付ける
    pool.slice(0, 7).forEach(function (i) {
      colors[i][d] = AVAILABLE_COLOR;
    });

    let need = Number(required[d]) || 3;
    if (d % 7 === 1) need -= 1; // 1枠足りない日
    const halfShort = d % 9 === 7; // 早番だけで遅番がいない日

    let k = 0;
    values[pool[k++]][d] = 'L';
    for (let n = 1; n < need; n++) values[pool[k++]][d] = 'F';
    if (halfShort) {
      values[pool[k - 1]][d] = '早';
    }
    if (d % 10 === 5 && staffIdx.length > 0) {
      // 社員が入る日（バイトを1人減らして社員を入れる）
      values[pool[k - 1]][d] = '';
      values[staffIdx[d % staffIdx.length]][d] = 'F';
    }
  }

  sheet.getRange(FIRST_MEMBER_ROW, FIRST_DAY_COL, memberCount, dayCount).setValues(values);
  sheet.getRange(FIRST_MEMBER_ROW, FIRST_DAY_COL, memberCount, dayCount).setBackgrounds(colors);
}

// ───────────────────────── スプシのメニュー ─────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('シフト')
    .addItem('翌月シートを作る', 'menuCreateNextMonth')
    .addItem('祝日を更新（開いている月のシート）', 'menuUpdateHolidays')
    .addItem('サンプルを入れる（開いている月のシート）', 'menuFillSample')
    .addToUi();
}

function menuCreateNextMonth() {
  const sheet = ensureMonthSheet(nextMonthKey());
  SpreadsheetApp.getActive().setActiveSheet(sheet);
}

function menuUpdateHolidays() {
  const sheet = SpreadsheetApp.getActiveSheet();
  writeHolidays(sheet, monthOfSheet(sheet));
}

function menuFillSample() {
  fillSampleData(monthOfSheet(SpreadsheetApp.getActiveSheet()));
}

// ───────────────────────── 小さな道具 ─────────────────────────

/** "2026-11" → { year: 2026, month: 11 } */
function parseMonth(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error('month は "2026-11" の形で指定してください: ' + month);
  return { year: Number(m[1]), month: Number(m[2]) };
}

function monthOfSheet(sheet) {
  const name = sheet.getName();
  parseMonth(name);
  return name;
}

function nextMonthKey() {
  const now = new Date();
  return Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function findMemberRow(sheet, name) {
  const names = sheet
    .getRange(FIRST_MEMBER_ROW, 1, LAST_MEMBER_ROW - FIRST_MEMBER_ROW + 1, 1)
    .getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === name) return FIRST_MEMBER_ROW + i;
  }
  return -1;
}

function getSheetOrThrow(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('「' + name + '」シートがありません。setupSpreadsheet を実行してください');
  return sheet;
}
