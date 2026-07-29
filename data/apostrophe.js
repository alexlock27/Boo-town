// data/apostrophe.js — RUN18E L4/Part D: Apostrophe Patrol content.
// AUTHORED IN _programme/RUN18E.md APPENDIX A, PARTS D1/D2/D2+, COPIED EXACTLY.
//
// D2 possession items: `word` is the bare sign word (as printed, apostrophe-less); the two
// candidate landing forms are always `word+"'s"` ("before" the s that gets added) and
// `word+"'"` ("after" an s the word already has) — the game builds both at runtime so the
// content here only names which one is correct (`form`) and the spoken owner-count line.

export const SQUEEZE = [   // D1 — sixteen builds, verbatim
  { id: 'dont', a: 'do', b: 'not', build: "don't", note: 'the o pops out!' },
  { id: 'cant', a: 'can', b: 'not', build: "can't", note: 'n-o squeezed away!' },
  { id: 'isnt', a: 'is', b: 'not', build: "isn't", note: null },
  { id: 'didnt', a: 'did', b: 'not', build: "didn't", note: null },
  { id: 'wasnt', a: 'was', b: 'not', build: "wasn't", note: null },
  { id: 'couldnt', a: 'could', b: 'not', build: "couldn't", note: null },
  { id: 'im', a: 'I', b: 'am', build: "I'm", note: null },
  { id: 'ill', a: 'I', b: 'will', build: "I'll", note: null },
  { id: 'shes', a: 'she', b: 'is', build: "she's", note: null },
  { id: 'its', a: 'it', b: 'is', build: "it's", note: null },
  { id: 'were', a: 'we', b: 'are', build: "we're", note: null },
  { id: 'theyre', a: 'they', b: 'are', build: "they're", note: null },
  { id: 'youve', a: 'you', b: 'have', build: "you've", note: null },
  { id: 'wouldnt', a: 'would', b: 'not', build: "wouldn't", note: null },
  { id: 'thats', a: 'that', b: 'is', build: "that's", note: null },
  { id: 'lets', a: 'let', b: 'us', build: "let's", note: null }
];

export const POSSESSION = [   // D2 — eighteen items, verbatim
  { id: 'boo1', sentence: 'The ___ hat blew away.', word: 'Boo', form: 'before', count: 'One Boo', many: false, build: "Boo's" },
  { id: 'boo3', sentence: 'The ___ hats all blew away.', word: 'Boos', form: 'after', count: 'Three Boos', many: true, build: "Boos'" },
  { id: 'sister1', sentence: 'That is my ___ scarf.', word: 'sister', form: 'before', count: 'One sister', many: false, build: "sister's" },
  { id: 'sister2', sentence: 'The two ___ bikes are pink.', word: 'sisters', form: 'after', count: 'Two sisters', many: true, build: "sisters'" },
  { id: 'dog1', sentence: 'The ___ bowl is empty.', word: 'dog', form: 'before', count: 'One dog', many: false, build: "dog's" },
  { id: 'dogmany', sentence: 'The ___ tails wagged.', word: 'dogs', form: 'after', count: 'Lots of dogs', many: true, build: "dogs'" },
  { id: 'children', sentence: '___ toys were everywhere.', word: 'children', form: 'before', count: 'The children', many: true, build: "children's", note: 'children is already lots — so it just takes ’s!' },
  { id: 'men', sentence: 'The ___ shoes are muddy.', word: 'men', form: 'before', count: 'The men', many: true, build: "men's" },
  { id: 'grandma', sentence: 'My ___ garden has a pond.', word: 'grandma', form: 'before', count: 'One grandma', many: false, build: "grandma's" },
  { id: 'bird1', sentence: 'The ___ nest has three eggs.', word: 'bird', form: 'before', count: 'One bird', many: false, build: "bird's" },
  { id: 'birdmany', sentence: 'The ___ nests line the cliff.', word: 'birds', form: 'after', count: 'Many birds', many: true, build: "birds'" },
  { id: 'school', sentence: 'The ___ playground opens at nine.', word: 'school', form: 'before', count: 'The school', many: false, build: "school's" },
  { id: 'teachers', sentence: 'Both ___ scarves are stripy.', word: 'teachers', form: 'after', count: 'Two teachers', many: true, build: "teachers'" },
  { id: 'mouse', sentence: 'The ___ cheese went missing.', word: 'mouse', form: 'before', count: 'One mouse', many: false, build: "mouse's" },
  { id: 'mice', sentence: 'The ___ favourite game is chase.', word: 'mice', form: 'before', count: 'The mice', many: true, build: "mice's" },
  { id: 'dad', sentence: '___ jokes are the silliest.', word: 'Dad', form: 'before', count: 'Dad', many: false, build: "Dad's" },
  { id: 'girls', sentence: 'The ___ sandcastle survived the wave!', word: 'girls', form: 'after', count: 'The girls', many: true, build: "girls'" },
  { id: 'child', sentence: 'One ___ wish came true.', word: 'child', form: 'before', count: 'One child', many: false, build: "child's" }
];

// D2+ — the six no-comma decoys (level 3 only)
export const NO_COMMA_DECOYS = [
  { id: 'its_dog', sentence: 'The dog wagged its tail.', word: 'its' },
  { id: 'hers_scarf', sentence: 'Is this scarf hers?', word: 'hers' },
  { id: 'yours_sand', sentence: 'That sandcastle is yours!', word: 'yours' },
  { id: 'its_house', sentence: 'The house lost its roof in the wind.', word: 'its' },
  { id: 'theirs_medal', sentence: 'The medals are theirs now.', word: 'theirs' },
  { id: 'ours_biscuit', sentence: 'Is the last biscuit ours?', word: 'ours' }
];

export const VAN_PX_S = 40;   // level 3: the sign's delivery-van drift speed
