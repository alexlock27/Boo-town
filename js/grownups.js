// js/grownups.js — the grown-ups corner (spec §5.7). Plain adult styling.

import { el, backControl, setCalmMotion, setBiggerText } from './ui.js';
import { replayTour } from './welcometour.js';
import { getState, mutate, commit, exportCode, importCode, resetAll } from './state.js';
import { setSoundEnabled, setMusicEnabled, music } from './sfx.js';
import * as tts from './tts.js';
import { deleteAllVoices, voiceCount } from './voices.js';
import { setRequestsEnabled } from './requests.js';
import { hapticsSupported, setHapticsEnabled, haptic } from './haptics.js';
import { contentTier, setContentTier, TIERS } from './content.js';
import { lastHiccup, listSnapshots, restoreSnapshot } from './resilience.js';
import { keepCopy, sendCopy, canShareFiles, buildBackupFile, formatBytes, inspectText, inspectSnapshot, restoreInspected, needsBackupReminder, storageStatus, lastBackupInfo, isIOSStandalone, currentBuildStamp } from './backup.js';
import { bloomStats } from '../data/bloom.js';
import { alphaKeysOn, alphaKeysDefault, setAlphaKeys, readAloudOn, setReadAloud } from './a11y.js';
// RUN17 X3: the Feelings Corner switch. The label and description are AUTHORED copy —
// imported, never retyped here. feelingsTierOk keeps the Medium/Full gate in one place.
import { TOGGLE_COPY as FEELINGS_TOGGLE_COPY, TOGGLE_LABEL as FEELINGS_TOGGLE_LABEL } from '../data/feelingsLines.js';
import { feelingsTierOk } from './feelings.js';

// Rough platform sniff, only to word the "where did it save?" helper text. Never gates
// behaviour — the buttons feature-detect (canShareFiles) regardless.
function platformNote() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  if (iOS) return { where: 'the Files app', routes: 'AirDrop to a grown-up’s iPhone, or Messages, Mail or chat' };
  if (/Android/.test(ua)) return { where: 'your Downloads', routes: 'Quick Share or Bluetooth to a grown-up’s phone, or chat and email' };
  return { where: 'your device’s downloads', routes: 'chat, email, or a nearby-share to a grown-up’s phone' };
}

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

  // ---- getting in (RUN12 S13) ----------------------------------------------------------
  // Two switches that change how a child reaches the app rather than what it teaches.
  // Both are device-local; the A-Z default follows the content tier until it is set here.
  const accessCard = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Getting in' }),
    toggle('A-Z letter keyboard', alphaKeysOn(), v => setAlphaKeys(v)),
    el('p', { class: 'gu-note', text: alphaKeysDefault()
      ? 'On by default at this age — letters in alphabet order rather than QWERTY.'
      : 'Letters in alphabet order rather than QWERTY. Off by default at this age.' }),
    toggle('Read questions aloud (a speaker button)', readAloudOn(), v => setReadAloud(v)),
    el('p', { class: 'gu-note', text: 'Adds a small speaker beside each question. It only speaks when she presses it — never on its own.' })
  ]);

  // ---- comfort & access (RUN18B Y15) ---------------------------------------------------
  // Two switches that change how the app FEELS rather than what it teaches, applied live —
  // she does not have to leave the screen, and she certainly does not have to restart — and
  // remembered on the device like every other setting here.
  const comfortCard = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Comfort & access' }),
    el('p', { class: 'gu-note', text: 'Small comforts for small eyes and busy screens.' }),
    toggle('Calm motion', s.settings.calmMotion === true, v => {
      mutate(st => st.settings.calmMotion = v);
      // Written NOW, not on the usual two-second debounce: a grown-up sets a comfort and puts
      // the tablet down, and the next thing that happens is often the tab closing.
      commit();
      setCalmMotion(v);
    }),
    el('p', { class: 'gu-note', text: 'Everything that moves takes the gentle path — no confetti storms, no long slides. On even if the tablet is not set that way.' }),
    toggle('Bigger text', s.settings.biggerText === true, v => {
      mutate(st => st.settings.biggerText = v);
      commit();
      setBiggerText(v);
    }),
    el('p', { class: 'gu-note', text: 'One step larger everywhere. Nothing is hidden or cut off — every screen grows with it.' }),
    // RUN18B Y16: the welcome tour's replay lives here, not on the hub — a child who has
    // been told does not need a permanent "tell me again" chip in the way of her games.
    el('button', { class: 'btn soft gu-tour-replay', text: 'Show the welcome tour again', onclick: (e) => {
      replayTour();
      e.target.textContent = 'It will show next time you open the hub';
      e.target.disabled = true;
    } })
  ]);

  // ---- voice picker (RUN9 C6b): choose from the device's installed English voices ----
  function voiceSection() {
    const wrap = el('div', { class: 'gu-voice' });
    function render() {
      wrap.innerHTML = '';
      const voices = tts.available() ? tts.listVoices() : [];
      wrap.style.display = '';
      const chosen = (getState().settings.voiceName) || tts.getVoiceName();
      wrap.appendChild(el('div', { class: 'gu-voice-label', text: 'Choose a voice' }));
      if (!voices.length) {
        wrap.appendChild(el('p', {
          class: 'gu-note gu-voice-tip',
          text: 'Install the English (UK) voice in the tablet\'s text-to-speech settings for a nicer voice.'
        }));
        return;
      }
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
    }
    render();
    return wrap;
  }

  // The Feelings Corner's authored description, with {name} filled in the way every other
  // piece of guide copy in the app is. Kept gender-neutral throughout, as authored.
  const feelingsNote = el('p', { class: 'gu-note' });
  const feelingsTierNote = el('p', { class: 'gu-note' });
  function renderFeelingsNote() {
    const st = getState();
    feelingsNote.textContent = FEELINGS_TOGGLE_COPY.replace(/\{name\}/g, (st && st.name) || 'they');
    const tierOk = feelingsTierOk();
    feelingsTierNote.textContent = tierOk
      ? 'Available on this device because the content setting is Medium or Full.'
      : 'It stays hidden while the content setting is Toddler or Light — this corner is for age 8 and up.';
    feelingsTierNote.classList.toggle('gu-note-off', !tierOk);
  }
  renderFeelingsNote();

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
    // RUN19 Z2 raised this to two at once (MAX_ACTIVE), and the sentence describing it was
    // left saying one. Copy that quietly contradicts the behaviour is worse than no copy.
    el('p', { class: 'gu-note', text: 'Now and then a Boo asks for a little something (like "play a maths game!"). At most two at a time, never a nag. Turn off to stop them entirely.' })
  ]);

  // ---- the Feelings Corner (RUN17 X3) ----
  // OFF by default and only offered from age 8 up (content tier Medium or Full). The
  // description beside the switch is AUTHORED in CONTENT_WARMTH.md and says exactly what
  // this does and does not do — including that nothing is recorded, not even for the
  // grown-up reading it. There is deliberately NO report, summary or history anywhere in
  // this screen, because there is nothing to report: nothing is ever stored (G17).
  const feelingsCard = el('div', { class: 'gu-card' }, [
    el('h3', { text: FEELINGS_TOGGLE_LABEL }),
    toggle(FEELINGS_TOGGLE_LABEL, s.settings.feelingsCorner === true, v => { mutate(st => { st.settings.feelingsCorner = v; }); renderFeelingsNote(); }),
    feelingsNote,
    feelingsTierNote
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

  // ---- Unified Restore (RUN8 v2 C3): file / code / snapshot → one preview → undo-safe ----
  const restoreMsg = el('span', { class: 'gu-msg' });
  const previewWrap = el('div', { class: 'gu-restore-preview' });
  function clearPreview() { clearNode(previewWrap); previewWrap.classList.remove('on'); }
  function showPreview(inspect) {
    clearNode(previewWrap);
    if (!inspect || !inspect.ok) { restoreMsg.classList.add('err'); restoreMsg.textContent = (inspect && inspect.error) || 'That backup could not be read.'; return; }
    restoreMsg.classList.remove('err'); restoreMsg.textContent = '';
    const p = inspect.preview;
    const card = el('div', { class: 'gu-preview-card' }, [
      el('h5', { class: 'gu-preview-title', text: p.name ? `${p.name}’s Boo Town` : 'A Boo Town save' }),
      el('ul', { class: 'gu-preview-facts' }, [
        el('li', { text: `⭐ ${p.stars} stars` }),
        el('li', { text: `👻 ${p.uniqueBoos} Boos` }),
        el('li', { text: `🏆 ${p.trophies} trophies` }),
        el('li', { text: `📅 saved ${p.savedDate}` }),
        el('li', { text: p.creations ? '🎨 includes drawings & jams' : '🎨 no creations included' }),
        ...(p.voices ? [el('li', { text: '🎙️ includes voice recordings' })] : [])
      ]),
      el('p', { class: 'gu-note', text: 'Restoring first keeps a “before restore” safety copy on this tablet, so you can undo it.' }),
      el('div', { class: 'gu-row' }, [
        el('button', { class: 'btn gu-restore-go', text: 'Restore this', onclick: async () => {
          restoreMsg.classList.remove('err'); restoreMsg.textContent = 'Restoring…';
          const r = await restoreInspected(inspect);
          if (r.ok) { restoreMsg.textContent = 'Restored! Reloading…'; setTimeout(() => location.reload(), 800); }
          else { restoreMsg.classList.add('err'); restoreMsg.textContent = r.error || 'Could not restore that backup.'; }
        } }),
        el('button', { class: 'btn soft', text: 'Cancel', onclick: clearPreview })
      ])
    ]);
    previewWrap.appendChild(card); previewWrap.classList.add('on');
  }

  const restoreFile = el('input', { class: 'gu-restore-file', type: 'file', accept: '.boo,.json', 'aria-label': 'Choose a backup file', onchange: async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { showPreview(inspectText(await f.text())); } catch { showPreview({ ok: false, error: 'That file could not be read.' }); }
    e.target.value = '';
  } });
  const restoreInput = el('textarea', { class: 'gu-code', rows: '3', placeholder: 'Paste a backup code here…', 'aria-label': 'Paste backup code to restore' });
  const restoreBtn = el('button', { class: 'btn secondary', text: 'Preview this code', onclick: () => showPreview(inspectText(restoreInput.value)) });

  // Rolling snapshots (RUN5 C0b): auto-backups + any "before restore" undo point. Each
  // opens the same preview card before it is applied.
  const snapWrap = el('div', { class: 'gu-snaps' });
  (async () => {
    let snaps = [];
    try { snaps = await listSnapshots(); } catch {}
    clearNode(snapWrap);
    if (!snaps.length) { snapWrap.appendChild(el('p', { class: 'gu-note', text: 'No automatic snapshots yet — one is taken each day she plays.' })); return; }
    for (const sn of snaps) {
      snapWrap.appendChild(el('div', { class: 'gu-snap-row' }, [
        el('span', { class: 'gu-snap-when', text: snapshotLabel(sn) }),
        el('button', { class: 'btn soft gu-snap-restore', text: 'Preview', onclick: () => showPreview(inspectSnapshot(sn)) })
      ]));
    }
  })();

  // ---- Keep a copy / Send a copy (RUN8 v2 C2): account-free file backups ----
  const plat = platformNote();
  let includeCreations = false, includeVoices = false;
  const sizeLine = el('p', { class: 'gu-note gu-backup-size', text: 'Backup file: measuring…' });
  async function refreshSize() {
    try { const f = await buildBackupFile({ includeCreations, includeVoices }); sizeLine.textContent = f ? `Backup file: about ${formatBytes(f.size)}` : 'Nothing to back up yet.'; }
    catch { sizeLine.textContent = ''; }
  }
  const keepMsg = el('span', { class: 'gu-msg' });
  const keepBtn = el('button', { class: 'btn big gu-keep', text: 'Keep a copy on this tablet', onclick: async () => {
    keepMsg.classList.remove('err'); keepMsg.textContent = 'Saving…';
    const r = await keepCopy({ includeCreations, includeVoices });
    if (r.ok) keepMsg.textContent = `Saved to ${plat.where} (${formatBytes(r.size)}) ✓`;
    else { keepMsg.classList.add('err'); keepMsg.textContent = r.error || 'Could not save the file.'; }
  } });
  const sendMsg = el('span', { class: 'gu-msg' });
  const sendBtn = el('button', { class: 'btn secondary gu-send', text: 'Send a copy off this tablet', onclick: async () => {
    sendMsg.classList.remove('err'); sendMsg.textContent = '';
    const r = await sendCopy({ includeCreations, includeVoices });
    if (r.ok) sendMsg.textContent = 'Shared ✓';
    else if (!r.aborted) { sendMsg.classList.add('err'); sendMsg.textContent = r.error || 'Could not open the share sheet.'; }
  } });
  const exportBlock = el('div', { class: 'gu-backup-export' }, [
    el('p', { class: 'gu-note', text: 'A backup is her whole save in one file. Keep one on this tablet, and send one to a grown-up — either survives cleared browser data or a deleted app.' }),
    toggle('Include her creations (drawings & jams)', includeCreations, v => { includeCreations = v; refreshSize(); }),
    toggle('Include voice recordings (her voice)', includeVoices, v => { includeVoices = v; refreshSize(); }),
    sizeLine,
    el('div', { class: 'gu-row' }, [keepBtn]),
    el('p', { class: 'gu-note', text: `Saves the file to ${plat.where}, safe from cleared browser data.` }),
    el('div', { class: 'gu-row' }, [keepMsg]),
    ...(canShareFiles() ? [
      el('div', { class: 'gu-row' }, [sendBtn]),
      el('p', { class: 'gu-note', text: `Opens the share sheet — ${plat.routes}. No account needed.` }),
      el('div', { class: 'gu-row' }, [sendMsg])
    ] : [])
  ]);
  refreshSize();

  // ---- status panel + gentle reminder (RUN8 v2 C4) ----
  const statusPanel = el('div', { class: 'gu-backup-status' });
  (async () => {
    clearNode(statusPanel);
    const st = await storageStatus();
    const lb = lastBackupInfo(s);
    const rows = [];
    if (st.persisted === true) rows.push(el('p', { class: 'gu-status-row ok', text: '🔒 Protected against automatic clearing: yes' }));
    else if (st.persisted === false) rows.push(el('div', { class: 'gu-status-row warn' }, [
      el('span', { text: '🔓 Protected against automatic clearing: no' }),
      el('span', { class: 'gu-status-tip', text: 'The browser may clear storage under pressure — keep a backup so nothing is lost.' })
    ]));
    if (typeof st.usage === 'number') rows.push(el('p', { class: 'gu-status-row', text: `💾 Space used on this tablet: ${formatBytes(st.usage)}` }));
    rows.push(el('p', { class: 'gu-status-row', text: `🗂️ Last backup: ${lb.text}` }));
    if (isIOSStandalone()) rows.push(el('p', { class: 'gu-status-row note', text: 'On iPad: deleting the app icon deletes its progress — send a backup first.' }));
    rows.push(el('p', { class: 'gu-status-row note', text: 'Clearing browser data erases progress; a backup is the protection.' }));
    rows.forEach(r => statusPanel.appendChild(r));
  })();

  const reminderBanner = el('div', { class: 'gu-backup-reminder' });
  if (needsBackupReminder(s)) {
    reminderBanner.classList.add('on');
    const rMsg = el('span', { class: 'gu-msg' });
    reminderBanner.appendChild(el('div', { class: 'gu-reminder-inner' }, [
      el('span', { class: 'gu-reminder-text', text: 'No recent backup. Tap to keep a copy on this tablet.' }),
      el('button', { class: 'btn gu-reminder-btn', text: 'Keep a copy now', onclick: async () => {
        rMsg.classList.remove('err'); rMsg.textContent = 'Saving…';
        const r = await keepCopy({});
        if (r.ok) { rMsg.textContent = 'Saved ✓'; reminderBanner.classList.remove('on'); const dot = tabBtns.data && tabBtns.data.querySelector('.gu-tab-dot'); if (dot) dot.remove(); }
        else { rMsg.classList.add('err'); rMsg.textContent = r.error || 'Could not save.'; }
      } }),
      rMsg
    ]));
  }

  const backup = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Keep her progress safe' }),
    reminderBanner,
    statusPanel,
    exportBlock,
    el('hr', {}),
    el('h4', { class: 'gr-sub', text: 'Or copy a backup code' }),
    el('p', { class: 'gu-note', text: 'The code is her whole save as text. Copy it somewhere safe, or paste one below to restore.' }),
    codeBox,
    el('div', { class: 'gu-row' }, [copyBtn, copyMsg]),
    el('hr', {}),
    el('h4', { class: 'gr-sub', text: 'Bring a backup back' }),
    el('p', { class: 'gu-note', text: 'Restore from a backup file, a pasted code, or an automatic snapshot — you’ll see what it holds before anything changes, and the current save is kept as an undo point.' }),
    el('label', { class: 'gu-restore-filelabel', text: 'Choose a backup file (.boo or .json)' }),
    restoreFile,
    restoreInput,
    el('div', { class: 'gu-row' }, [restoreBtn]),
    el('h5', { class: 'gu-restore-sub', text: 'Automatic snapshots (last three days + undo points)' }),
    snapWrap,
    previewWrap,
    el('div', { class: 'gu-row' }, [restoreMsg])
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
    el('p', { class: 'gu-note gu-age-hint', text: 'The age question sets this automatically (4 and under → Toddler · 5–7 → Light · 8–9 → Medium · 10 and up → Full), but whatever you pick here always wins.' }),
    // RUN18E L1: Sound Sorter/Blend It/Rhyme Time/Story Order move to the Light menu and
    // hide at Medium (the newer reading games take their place there) — this is the escape
    // hatch for a Medium child who still wants them.
    toggle('Show every game (ignore the age setting)', s.settings.showAgedOutGames === true, v => { mutate(st => { st.settings.showAgedOutGames = v; }); })
  ]);

  // ---- the build stamp, quietly (RUN18A H5) --------------------------------------------
  // A QA gap, not a feature: when a grown-up says "it still does the old thing", the first
  // question is which build they are actually running, and nothing on screen could answer
  // it. Read from the SERVICE-WORKER CACHE NAME via currentBuildStamp() — the one source
  // of truth — rather than from a constant duplicated into the UI, which is exactly how a
  // version line starts lying. It is async (caches.keys()), so the line fills itself in.
  const buildLine = el('p', { class: 'gu-note gu-build', text: 'Build: …' });
  currentBuildStamp().then(stamp => { buildLine.textContent = `Build: ${stamp}`; }).catch(() => { buildLine.textContent = 'Build: unknown'; });

  // ---- tabs (RUN6 C0.2): Settings first, so no setting hides behind the editors ----
  const TABS = [
    { id: 'settings', label: 'Settings',      cards: [toggles, accessCard, comfortCard, contentCard, micCard, requestsCard, feelingsCard, buildLine] },
    { id: 'golden',   label: 'Golden Round',  cards: [goldenEditor(s)] },
    { id: 'ledger',   label: 'Star Ledger',   cards: [starLedger(s)] },
    { id: 'bloom',    label: 'Bloom',         cards: [bloomReport(s)] },
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
  const reminderActive = needsBackupReminder(s);
  for (const t of TABS) {
    const btn = el('button', { class: 'gu-tab', role: 'tab', dataset: { tab: t.id }, onclick: () => showTab(t.id) }, [
      el('span', { class: 'gu-tab-label', text: t.label })
    ]);
    if (t.id === 'data' && reminderActive) btn.appendChild(el('span', { class: 'gu-tab-dot', 'aria-label': 'backup needed' }));
    tabBtns[t.id] = btn; tabbar.appendChild(btn);
    const panel = el('div', { class: 'gu-panel', role: 'tabpanel', dataset: { tab: t.id } }, t.cards);
    panelEls[t.id] = panel; panels.appendChild(panel);
  }
  // Settings stays the landing tab (RUN6 C0.2: no setting hides behind another panel). An
  // overdue backup is signalled by the dot on the Backup tab label and the banner waiting
  // inside it — hijacking the default tab would make the dot pointless. (RUN11 Q9.)
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
    if (sn && sn.label) return sn.label;                 // e.g. "before restore, 2026-07-24" (undo point)
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
  function bloomReport(s) {
    const rows = bloomStats(s);
    const table = el('table', { class: 'gu-ledger bloom-table' });
    table.appendChild(el('tr', { class: 'gl-head' }, [
      el('th', { text: 'Petal' }), el('th', { text: 'Mastered' }), el('th', { text: 'Plays' }), el('th', { text: 'Last played' })
    ]));
    rows.forEach(row => table.appendChild(el('tr', { class: 'gl-row' }, [
      el('td', { class: 'gl-name', text: row.display }),
      el('td', { class: 'gl-num', text: String(row.mastered) }),
      el('td', { class: 'gl-num', text: String(row.plays) }),
      el('td', { text: row.lastPlayed ? new Date(row.lastPlayed).toLocaleDateString() : '—' })
    ])));
    const quiet = rows.filter(row => row.quiet);
    return el('div', { class: 'gu-card bloom-report' }, [
      el('h3', { text: 'Brain Bloom' }),
      el('p', { class: 'gu-note', text: 'A neutral view of activity feeding each petal.' }),
      table,
      el('h4', { text: 'Quiet lately' }),
      el('p', { class: 'gu-note', text: quiet.length ? quiet.map(row => row.display).join(' · ') : 'No petals have been quiet lately.' })
    ]);
  }

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
