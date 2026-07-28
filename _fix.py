import io
p = 'js/expedition/postcard.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("""import { renderItem } from '../art.js';""",
              """import { renderItem, renderExpGlyph } from '../art.js';""")

old = """export function postcardPlan(party = [], node = 'hotel', date = new Date()) {
  const scene = SCENE[node] || SCENE.hotel;
  const rows = party.map((boo, index) => ({
    boo, x: 70 + (index % 6) * 96 + (Math.floor(index / 6) ? 42 : 0), y: 188
  }));"""
new = """export function postcardPlan(party = [], node = 'hotel', date = new Date()) {
  const scene = SCENE[node] || SCENE.hotel;
  // RUN18C C4: the back row stood at y 188 — ABOVE the ground band, which starts at 208 —
  // so six of eight Boos floated in the sky. Nobody had seen it, because until C4 the
  // postcard went straight into the Gallery and was never put in front of her. Both rows
  // stand on the grass now, the near one overlapping the far one, which reads as depth.
  const rows = party.map((boo, index) => ({
    boo, x: 70 + (index % 6) * 96 + (Math.floor(index / 6) ? 42 : 0), y: Math.floor(index / 6) ? 284 : 250
  }));"""
assert old in s, 'plan'
s = s.replace(old, new)

old = """  c.font = '56px sans-serif'; c.fillText(plan.scene.detail, 520, 132);"""
new = """  // The node's landmark, drawn in the house sticker style. It was the emoji from SCENE
  // above painted with fillText — emoji-as-art in a scene, which house law forbids, and
  // C4 is what puts this scene on a child's screen for the first time.
  try { const mark = await svgImage(renderExpGlyph(node in SCENE ? node : 'hotel', { size: 96 })); c.drawImage(mark, 506, 74, 96, 96); }
  catch { c.font = '56px sans-serif'; c.fillText(plan.scene.detail, 520, 132); }"""
assert old in s, 'detail'
s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
