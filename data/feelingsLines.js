// data/feelingsLines.js — the COMPLETE Feelings Corner script (RUN17 X3).
//
// Every word here is AUTHORED in CONTENT_WARMTH.md section X3 and transcribed exactly.
// Nothing was written by the implementer and nothing may be paraphrased, softened or
// extended. tests/r17x3-feelings.mjs diffs this file against the pack.
//
// G17 — THE RULE THIS FILE EXISTS TO KEEP:
// The Feelings Corner is NOT a mental health tool and must never behave like one. It
// NAMES a feeling, offers ONE calm activity, and STOPS. It never asks why, never gives
// advice, never interprets, never diagnoses, never scores, and never stores what was
// chosen. There are exactly TWO question marks in the whole flow — the opening question
// and the authored third-time line — and no third one may ever be added.
//
// There is no "wrong" feeling here, no ordering, no better and worse. The six are listed
// in the pack's own order.

// The one question, asked gently. The ONLY question in the flow apart from the
// third-time line below.
export const QUESTION = 'How are you feeling right now?';

// Each feeling is exactly three beats:
//   face  — how the Boo MIRRORS it, in face and posture (the pack's own words; the art
//           and the CSS posture class both read from this key)
//   line  — ONE validating line that names it and normalises it. Never advice.
//   offers— ONE optional offer, or two to choose between. Never insisted on.
export const FEELINGS = [
  { key: 'happy',   word: 'Happy',
    face: 'bright eyes, wide smile, slight bounce',
    line: "Happy is lovely. It's nice when it turns up.",
    offers: ['dance'] },
  { key: 'calm',    word: 'Calm',
    face: 'soft eyes half-closed, gentle sway',
    line: 'Calm is a nice quiet sort of feeling to have.',
    offers: ['breathe'] },
  { key: 'excited', word: 'Excited',
    face: 'wide eyes, wiggling, little hops',
    line: 'Excited! All fizzy and buzzy inside.',
    offers: ['dance'] },
  { key: 'tired',   word: 'Tired',
    face: 'droopy eyes, slow blink, small yawn',
    line: "Tired happens. Bodies get worn out, and that's fair enough.",
    offers: ['breathe'] },
  { key: 'worried', word: 'Worried',
    face: 'raised brows, small frame, fidget',
    line: 'Worried is a wobbly feeling. Lots and lots of people get it.',
    offers: ['breathe', 'sit'] },
  { key: 'sad',     word: 'Sad',
    face: 'downturned mouth, slow blink, still',
    line: 'Sad is a big feeling. It comes, and it goes.',
    offers: ['breathe', 'sit'] }
];

// The offers, by key. A button, never a demand — and never the only way out of the beat.
export const OFFERS = {
  dance:   { label: 'Dance it out!' },
  breathe: { label: 'Breathe with me' },
  sit:     { label: 'Sit a while' }
};

// The feelings whose third choice in one session earns the third-time line.
export const HEAVY = ['worried', 'sad'];

// "Sit a while": the Boo simply stays beside her, breathing slowly, doing nothing. No
// timer, no prompt, no reward. Leaving is always one tap — via the corner's own leave
// control, which is on screen the whole time, so no extra copy is invented for it.

// The breathing cycle. The ONE evidence-supported element in this corner, and it must be
// unhurried and skippable at any moment. Timings are exact: in 4s, hold 2s, out 6s, x4.
export const BREATHING = {
  inMs: 4000,
  holdMs: 2000,
  outMs: 6000,
  cycles: 4,
  copy: {
    in: 'Breathe in with me...',
    hold: '...and hold...',
    out: '...and out, slowly.'
  },
  close: "There. That's better."
};

// The 20-second Boo dance she can join by tapping.
export const DANCE_MS = 20000;

// THIRD-TIME LINE — appended once, only when worried or sad is chosen a THIRD time in one
// session, and never repeated afterwards in that session. Nothing follows it: no question
// of our own, no escalation, no offer, no logging.
export const THIRD_TIME_LINE = 'Feelings this big are easier with someone. Is there a grown-up you could tell?';
export const THIRD_TIME_AT = 3;

// GROWN-UPS TOGGLE COPY, shown beside the switch. Deliberately gender-neutral throughout
// ("they"/"them"), and it states the privacy promise this feature actually keeps.
// {name} is substituted with the child's name by the guide's own substitution path.
export const TOGGLE_COPY =
  'Feelings Corner — a quiet place where {name} can say how they\'re feeling and a Boo will ' +
  'sit with them. It names feelings and offers a breathing exercise. It never asks why, ' +
  'never gives advice, and nothing they choose is saved or shown to anyone, including you.';

export const TOGGLE_LABEL = 'Feelings Corner';

// The content tiers this corner is available at, on top of the grown-ups switch.
export const ALLOWED_TIERS = ['medium', 'full'];

export const FEELING_BY_KEY = Object.fromEntries(FEELINGS.map(f => [f.key, f]));
