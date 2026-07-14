// js/grownups.js — the grown-ups corner (spec §5.7). Plain adult styling.

import { el, backControl } from './ui.js';
import { getState, mutate, exportCode, importCode, resetAll } from './state.js';
import { setSoundEnabled, setMusicEnabled, music } from './sfx.js';
import * as tts from './tts.js';
import { deleteAllVoices, voiceCount } from './voices.js';
import { setRequestsEnabled } from './requests.js';
import { hapticsSupported, setHapticsEnabled, haptic } from './haptics.js';
import { contentTier, setContentTier, TIERS } from './content.js';
import { lastHiccup, listSnapshots, restoreSnapshot } from './resilience.js';

const GOLDEN_MAX_WORDS = 10, GOLDEN_MAX_CHOICES = 5;

export function mount(container, params, ctx) {
  const s = getState();

  const root = el('div', { class: 'grownups' });
  const header = el('header', { class: 'gu-header' }, [
    backControl(() => ctx.go('hub')),
    el('h2', { text: "Grown-ups corner" })
  ]);

  // ---- audio toggles ----
  const toggles = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Sound & voice' }),
    toggle('Sound effects', s.settings.sound, v => { mutate(st => st.settings.sound = v); setSoundEnabled(v); }),
    toggle('Music', s.settings.music, v => { mutate(st => st.settings.music = v); setMusicEnabled(v); if (v) music.play('calm'); }),
    toggle('Voice (reads words aloud)', s.settings.voice, v => { mutate(st => st.settings.voice = v); tts.setEnabled(v); }),
    // Haptics toggle (RUN9 C7) — Android only; the row hides where vibration is unsupported.
    ...(hapticsSupported() ? [toggle('Gentle buzzes (haptics)', s.settings.haptics !== false, v => { mutate(st => st.settings.haptics = v); setHapticsEnabled(v); if (v) haptic('tick'); })] : []),
    el('p', { class: 'gu-note', text: tts.available() ? 'A voice is available on this device.' : 'No speech voice found — the Peek button covers spelling.' }),
    voiceSection()
  ]);

  // ---- voice picker (RUN9 C6b): choose from the device's installed English voices ----
  function voiceSection() {
    const wrap = el('div', { class: 'gu-voice' });
    function render() {
      wrap.innerHTML = '';
      const voices = tts.available() ? tts.listVoices() : [];
      if (!voices.length) { wrap.style.display = 'none'; return; }   // hide gracefully where absent
      wrap.style.display = '';
      const chosen = (getState().settings.voiceName) || tts.getVoiceName();
      wrap.appendChild(el('div', { class: 'gu-voice-label', text: 'Choose a voice' }));
      const list = el('div', { class: 'gu-voice-list' });
      voices.forEach(v => {
        const sel = v.name === chosen;
        const row = el('div', { class: 'gu-voice-row' + (sel ? ' sel' : '') }, [
          el('button', { class: 'gu-voice-pick', onclick: () => { mutate(st => st.settings.voiceName = v.name); tts.setVoiceByName(v.name); render(); } }, [
            el('span', { class: 'gv-name', text: v.name + (v.local ? '' : ' ☁️') }),
            el('span', { class: 'gv-lang', text: v.lang })
          ]),
          el('button', { class: 'btn soft gv-preview', text: '🔊 Hi', 'aria-label': 'Preview ' + v.name, onclick: () => { tts.setVoiceByName(v.name); tts.speak(`Hello ${v.name.split(/[ -]/)[0]}!`); } })
        ]);
        list.appendChild(row);
      });
      wrap.appendChild(list);
      wrap.appendChild(el('p', { class: 'gu-note', text: 'Tip: install the “enhanced” English (UK) voice in your device’s text-to-speech settings for a nicer voice everywhere.' }));
    }
    render();
    return wrap;
  }

  // ---- microphone / Boo voices (RUN3 C7) ----
  const delMsg = el('span', { class: 'gu-msg' });
  const delBtn = el('button', { class: 'btn danger', text: 'Delete all recordings', onclick: async () => { await deleteAllVoices(); delMsg.textContent = 'All recordings deleted.'; setTimeout(() => delMsg.textContent = '', 2500); } });
  const micCard = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Microphone & Boo voices' }),
    toggle('Recording (Boo voices)', s.settings.mic !== false, v => { mutate(st => st.settings.mic = v); }),
    el('p', { class: 'gu-note', text: 'When on, tapping a Boo\'s card offers "Give them a voice". Recordings are saved on THIS device only and never uploaded. Turn off to hide all recording buttons.' }),
    el('div', { class: 'gu-row' }, [delBtn, delMsg])
  ]);

  // ---- Boo requests (RUN3 C8) ----
  const requestsCard = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Boo requests' }),
    toggle('Occasional Boo requests', s.settings.requests !== false, v => { setRequestsEnabled(v); }),
    el('p', { class: 'gu-note', text: 'Now and then a Boo asks for a little something (like "play a maths game!"). At most one at a time, never a nag. Turn off to stop them entirely.' })
  ]);

  // ---- backup ----
  const codeBox = el('textarea', { class: 'gu-code', readonly: true, rows: '3', 'aria-label': 'Your backup code' });
  codeBox.value = exportCode();
  const copyBtn = el('button', { class: 'btn', text: 'Copy code', onclick: () => copy() });
  const copyMsg = el('span', { class: 'gu-msg' });
  async function copy() {
    try { await navigator.clipboard.writeText(codeBox.value); copyMsg.textContent = 'Copied ✓'; }
    catch { codeBox.select(); try { document.execCommand('copy'); copyMsg.textContent = 'Copied ✓'; } catch { copyMsg.textContent = 'Select the text and copy it.'; } }
    setTimeout(() => copyMsg.textContent = '', 2500);
  }

  const restoreInput = el('textarea', { class: 'gu-code', rows: '3', placeholder: 'Paste a backup code here…', 'aria-label': 'Paste backup code to restore' });
  const restoreMsg = el('span', { class: 'gu-msg' });
  const restoreBtn = el('button', { class: 'btn secondary', text: 'Restore from code', onclick: () => {
    const res = importCode(restoreInput.value);
    if (res.ok) { restoreMsg.textContent = 'Restored! Reloading…'; ctx.refreshAudio && ctx.refreshAudio(); setTimeout(() => location.reload(), 700); }
    else { restoreMsg.textContent = res.error || 'Could not restore.'; restoreMsg.classList.add('err'); }
  }});

  // Rolling snapshots (RUN5 C0b): the app auto-backs up once per day of play; here
  // they can be restored by date. Populated asynchronously from IndexedDB.
  const snapWrap = el('div', { class: 'gu-snaps' });
  const snapMsg = el('span', { class: 'gu-msg' });
  (async () => {
    let snaps = [];
    try { snaps = await listSnapshots(); } catch {}
    clearNode(snapWrap);
    if (!snaps.length) { snapWrap.appendChild(el('p', { class: 'gu-note', text: 'No automatic snapshots yet — one is taken each day she plays.' })); return; }
    for (const sn of snaps) {
      const when = snapshotLabel(sn);
      snapWrap.appendChild(el('div', { class: 'gu-snap-row' }, [
        el('span', { class: 'gu-snap-when', text: when }),
        el('button', { class: 'btn soft gu-snap-restore', text: 'Restore', onclick: () => {
          const res = restoreSnapshot(sn.code);
          if (res && res.ok) { snapMsg.classList.remove('err'); snapMsg.textContent = 'Restored! Reloading…'; setTimeout(() => location.reload(), 700); }
          else { snapMsg.classList.add('err'); snapMsg.textContent = (res && res.error) || 'Could not restore that snapshot.'; }
        } })
      ]));
    }
    snapWrap.appendChild(el('div', { class: 'gu-row' }, [snapMsg]));
  })();

  const backup = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Backup & restore' }),
    el('p', { class: 'gu-note', text: 'This code is her whole save. Keep it somewhere safe. Paste it on another device (or after a reset) to bring everything back.' }),
    codeBox,
    el('div', { class: 'gu-row' }, [copyBtn, copyMsg]),
    el('hr', {}),
    restoreInput,
    el('div', { class: 'gu-row' }, [restoreBtn, restoreMsg]),
    el('hr', {}),
    el('h4', { class: 'gr-sub', text: 'Automatic snapshots' }),
    el('p', { class: 'gu-note', text: 'Boo Town keeps the last three days’ snapshots on this device, just in case.' }),
    snapWrap
  ]);

  // ---- reset ----
  const resetInput = el('input', { class: 'text-input small', type: 'text', placeholder: 'type RESET', 'aria-label': 'type RESET to confirm' });
  const resetBtn = el('button', { class: 'btn danger', text: 'Reset everything', disabled: true, onclick: () => {
    resetAll();
    ctx.go('onboarding');
  }});
  resetInput.addEventListener('input', () => { if (resetInput.value.trim() === 'RESET') resetBtn.removeAttribute('disabled'); else resetBtn.setAttribute('disabled', ''); });

  const reset = el('div', { class: 'gu-card gu-danger' }, [
    el('h3', { text: 'Start over' }),
    el('p', { class: 'gu-note', text: 'This erases her name, guide, stars, Boos and town on THIS device. There is no undo (use a backup code first).' }),
    el('div', { class: 'gu-row' }, [resetInput, resetBtn])
  ]);

  // ---- content amount: Light / Medium / Full (RUN3 C9) ----
  const TIER_LABEL = { toddler: 'Toddler', light: 'Light', medium: 'Medium', full: 'Full' };
  const TIER_DESC = { toddler: 'For pre-readers: four simple games, everything spoken aloud.', light: 'Fewest choices — the simplest menus.', medium: 'More topics grouped tidily.', full: 'Every single list and topic.' };
  const tierDesc = el('p', { class: 'gu-note', text: TIER_DESC[contentTier()] });
  const tierSeg = el('div', { class: 'gu-seg' });
  function renderSeg() {
    tierSeg.innerHTML = '';
    for (const t of TIERS) tierSeg.appendChild(el('button', { class: 'gu-seg-btn' + (contentTier() === t ? ' sel' : ''), text: TIER_LABEL[t], onclick: () => { setContentTier(t); tierDesc.textContent = TIER_DESC[t]; renderSeg(); } }));
  }
  renderSeg();
  const contentCard = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'How many choices?' }),
    el('p', { class: 'gu-note', text: 'This only changes the menus she sees — all the learning stays installed, and her progress and Boos are never touched. Smart Mix quietly uses everything.' }),
    tierSeg, tierDesc,
    el('p', { class: 'gu-note gu-age-hint', text: 'The age question sets this automatically (4 and under → Toddler · 5–7 → Light · 8–9 → Medium · 10 and up → Full), but whatever you pick here always wins.' })
  ]);

  // ---- tabs (RUN6 C0.2): Settings first, so no setting hides behind the editors ----
  const TABS = [
    { id: 'settings', label: 'Settings',      cards: [toggles, contentCard, micCard, requestsCard] },
    { id: 'golden',   label: 'Golden Round',  cards: [goldenEditor(s)] },
    { id: 'ledger',   label: 'Star Ledger',   cards: [starLedger(s)] },
    { id: 'data',     label: 'Backup & data', cards: [backup, diagnostics(), reset] }
  ];
  const tabbar = el('div', { class: 'gu-tabs', role: 'tablist' });
  const panels = el('div', { class: 'gu-panels' });
  const tabBtns = {}, panelEls = {};
  function showTab(id) {
    for (const t of TABS) {
      const on = t.id === id;
      panelEls[t.id].classList.toggle('active', on);
      tabBtns[t.id].classList.toggle('active', on);
      tabBtns[t.id].setAttribute('aria-selected', String(on));
    }
    panels.scrollTop = 0;
  }
  for (const t of TABS) {
    const btn = el('button', { class: 'gu-tab', role: 'tab', dataset: { tab: t.id }, text: t.label,
      onclick: () => showTab(t.id) });
    tabBtns[t.id] = btn; tabbar.appendChild(btn);
    const panel = el('div', { class: 'gu-panel', role: 'tabpanel', dataset: { tab: t.id } }, t.cards);
    panelEls[t.id] = panel; panels.appendChild(panel);
  }
  showTab('settings');
  root.append(header, tabbar, panels);
  container.appendChild(root);

  // ---- diagnostics: last hiccup (RUN5 C0b oops net) ----
  function diagnostics() {
    const h = lastHiccup();
    const line = h && h.msg
      ? `Last hiccup: ${h.msg}${h.at ? ' (' + friendlyDate(h.at) + ')' : ''}`
      : 'No hiccups recorded — all smooth so far.';
    return el('div', { class: 'gu-card' }, [
      el('h3', { text: 'Under the hood' }),
      el('p', { class: 'gu-note gu-hiccup', text: line }),
      el('p', { class: 'gu-note', text: 'If something ever went wrong, this note is the most recent technical message — handy if you want to report it.' })
    ]);
  }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function snapshotLabel(sn) {
    const at = sn && sn.at;
    if (at) return friendlyDate(at);
    return (sn && sn.day) || 'a snapshot';
  }
  function friendlyDate(ms) {
    try {
      const d = new Date(ms);
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getDate()} ${mon} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch { return ''; }
  }

  // ---- Star Ledger (RUN5 C0): a visible per-game record, read straight from the save ----
  function starLedger(s) {
    const NAMES = {
      bubblepop: 'Bubble Pop', feedboos: 'Feed the Boos', spellboo: 'Spell Boo',
      blocks: 'Boo Blocks', bounce: 'Boo Bounce', beat: 'Boo Beat', teachme: 'Teach Me',
      dash: 'Boo Dash', clockshop: 'Clock Shop', boopop: 'Boo Pop', detective: 'Word Detective', booroll: 'Boo Roll', echoboos: 'Echo Boos',
      tcount: 'Counting Pop', tcolour: 'Colour Feast', tshape: 'Shape Sort', tletter: 'Letter Pop',
      tanimal: 'Animal Sounds', tpairs: 'Animal Pairs', tbigsmall: 'Big and Small'
    };
    const bg = (s.stars && s.stars.byGame) || {};
    const total = (s.stars && s.stars.total) || 0;
    const rows = Object.keys(NAMES)
      .map(k => ({ k, name: NAMES[k], plays: (bg[k] && bg[k].plays) || 0, earned: (bg[k] && bg[k].earned) || 0 }))
      .sort((a, b) => b.earned - a.earned || b.plays - a.plays);

    const table = el('table', { class: 'gu-ledger' });
    table.appendChild(el('tr', { class: 'gl-head' }, [
      el('th', { text: 'Game' }), el('th', { text: 'Rounds' }), el('th', { text: 'Stars' })
    ]));
    for (const r of rows) {
      table.appendChild(el('tr', { class: 'gl-row' + (r.plays ? '' : ' gl-empty') }, [
        el('td', { class: 'gl-name', text: r.name }),
        el('td', { class: 'gl-num', text: String(r.plays) }),
        el('td', { class: 'gl-num', text: String(r.earned) })
      ]));
    }

    return el('div', { class: 'gu-card' }, [
      el('h3', { text: '⭐ Star Ledger' }),
      el('div', { class: 'gl-total' }, [
        el('span', { class: 'gl-total-num', text: String(total) }),
        el('span', { class: 'gl-total-lbl', text: 'stars on this device' })
      ]),
      table,
      el('p', { class: 'gu-note', text: 'Stars and progress live on this device only; another tablet or phone keeps its own.' })
    ]);
  }

  // ---- Golden Round editor (RUN3 C3): parent-typed weekly challenge ----
  function goldenEditor(s) {
    const existing = s.golden || { words: [], choices: [] };
    const wordRows = [], choiceRows = [];

    const wordsWrap = el('div', { class: 'gr-rows' });
    for (let i = 0; i < GOLDEN_MAX_WORDS; i++) {
      const pre = existing.words[i] || {};
      const word = el('input', { class: 'text-input small gr-word', type: 'text', placeholder: `Word ${i + 1}`, value: pre.w || '' });
      const twin = el('input', { type: 'checkbox', class: 'gr-twin', checked: pre.twin ? 'checked' : undefined });
      const rival = el('input', { class: 'text-input small gr-rival', type: 'text', placeholder: 'rival spelling', value: pre.rival || '', style: { display: pre.twin ? '' : 'none' } });
      const clue = el('input', { class: 'text-input small gr-clue', type: 'text', placeholder: 'clue (use ___ for the gap)', value: pre.clue || '' });
      twin.addEventListener('change', () => { rival.style.display = twin.checked ? '' : 'none'; });
      wordRows.push({ word, twin, rival, clue });
      wordsWrap.appendChild(el('div', { class: 'gr-word-row' }, [word, el('label', { class: 'gr-twin-label' }, [twin, el('span', { text: 'twin' })]), rival, clue]));
    }

    const choicesWrap = el('div', { class: 'gr-rows' });
    for (let i = 0; i < GOLDEN_MAX_CHOICES; i++) {
      const pre = existing.choices[i] || {};
      const q = el('input', { class: 'text-input small gr-q', type: 'text', placeholder: `Question ${i + 1}`, value: pre.q || '' });
      const right = el('input', { class: 'text-input small gr-right', type: 'text', placeholder: 'right answer', value: pre.right || '' });
      const w = [0, 1, 2].map(k => el('input', { class: 'text-input small gr-wrong', type: 'text', placeholder: `wrong ${k + 1}`, value: (pre.wrong || [])[k] || '' }));
      choiceRows.push({ q, right, w });
      choicesWrap.appendChild(el('div', { class: 'gr-choice-row' }, [q, el('div', { class: 'gr-choice-ans' }, [right, ...w])]));
    }

    const msg = el('span', { class: 'gu-msg' });
    function save() {
      const words = wordRows.map(r => {
        const wv = r.word.value.trim(); if (!wv) return null;
        const o = { w: wv };
        if (r.twin.checked && r.rival.value.trim()) { o.twin = true; o.rival = r.rival.value.trim(); }
        if (r.clue.value.trim()) o.clue = r.clue.value.trim();
        return o;
      }).filter(Boolean);
      const choices = choiceRows.map(r => {
        const q = r.q.value.trim(), right = r.right.value.trim();
        const wrong = r.w.map(x => x.value.trim()).filter(Boolean);
        if (!q || !right || !wrong.length) return null;
        return { q, right, wrong };
      }).filter(Boolean);
      if (!words.length && !choices.length) { msg.textContent = 'Add at least one word or question first.'; msg.classList.add('err'); return; }
      mutate(st => { st.golden = { words, choices, savedAt: Date.now() }; });
      msg.classList.remove('err'); msg.textContent = `Saved! ${words.length} word(s), ${choices.length} question(s) — it's on the hub now.`;
    }
    function clearGolden() {
      mutate(st => { st.golden = null; });
      wordRows.forEach(r => { r.word.value = ''; r.rival.value = ''; r.clue.value = ''; r.twin.checked = false; r.rival.style.display = 'none'; });
      choiceRows.forEach(r => { r.q.value = ''; r.right.value = ''; r.w.forEach(x => x.value = ''); });
      msg.classList.remove('err'); msg.textContent = 'Golden Round cleared.';
    }

    return el('div', { class: 'gu-card' }, [
      el('h3', { text: '⭐ Golden Round' }),
      el('p', { class: 'gu-note', text: 'Type this week\'s spelling words and a few questions. Saving puts a gold card on her hub, worth double stars once a day. Tick "twin" for sound-alikes (their/there) and add the rival spelling.' }),
      el('h4', { class: 'gr-sub', text: 'Spelling words (up to 10)' }), wordsWrap,
      el('h4', { class: 'gr-sub', text: 'Questions (up to 5)' }), choicesWrap,
      el('div', { class: 'gu-row' }, [
        el('button', { class: 'btn gr-save', text: 'Save Golden Round', onclick: save }),
        el('button', { class: 'btn soft gr-clear', text: 'Clear', onclick: clearGolden }),
        msg
      ])
    ]);
  }

  function toggle(label, initial, onChange) {
    let on = initial;
    const sw = el('button', { class: 'gu-switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': label });
    sw.appendChild(el('span', { class: 'gu-knob' }));
    sw.addEventListener('click', () => { on = !on; sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); onChange(on); });
    return el('div', { class: 'gu-toggle' }, [ el('span', { class: 'gu-label', text: label }), sw ]);
  }

  return { unmount() {} };
}
