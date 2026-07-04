// data/stories.js — Story Nook launch stories (EXPANSION_2.md §C3).
// Parked data: exact transcription of the three authored stories, ready to wire up.
// Per item: { id, title, text, questions:[{ q, options, correct, type, hintParagraph }] }.

export const STORIES = [
  {
    id: 'story1',
    title: 'The box that wobbled',
    text: "Nobody knows who sends the mystery boxes to Boo Town. They simply appear at the gate at sunrise, tied with a silver ribbon. One morning, Pip found a box that was wobbling. It hopped left. It hopped right. Pip put her big ear against the lid and heard a tiny giggle. 'Hello?' whispered Pip. The box giggled louder. Pip untied the ribbon very carefully, and out bounced a brand new Boo with sky-blue fur, still laughing. 'I was practising my surprise!' said the new Boo. Pip laughed too. From that day on, whenever a box wobbles, everyone in Boo Town knows the surprise inside is simply too excited to wait.",
    questions: [
      { q: 'What was tied around the box?', options: ['a silver ribbon', 'a gold chain', 'a scarf'], correct: 0, type: 'retrieval', hintParagraph: 1 },
      { q: 'What did Pip hear inside?', options: ['a tiny giggle', 'a song', 'a sneeze'], correct: 0, type: 'retrieval', hintParagraph: 1 },
      { q: 'Why was the box wobbling?', options: ['the Boo inside was too excited to keep still', 'the wind was blowing it', 'it was empty'], correct: 0, type: 'inference', hintParagraph: 2 },
      { q: "In the story, 'whispered' means spoke...", options: ['very quietly', 'very loudly', 'very slowly'], correct: 0, type: 'vocab', hintParagraph: 1 },
    ],
  },
  {
    id: 'story2',
    title: "DJ Boo's quiet day",
    text: "One grey morning, DJ Boo's golden headphones went silent. No beat. No boom. Not even a tiny tap. DJ Boo sat on the edge of the dance stage with drooping ears. The other Boos gathered round. 'We can fix this,' said Munch. Curly hummed a tune. Beam clapped a rhythm. Little Fuzz stamped his feet, pat pat pat. Soon the whole town was humming, clapping and stamping together, louder and louder, until the stage itself seemed to bounce. DJ Boo's ears lifted. 'That,' said DJ Boo, grinning, 'is the best song I have ever heard.' The headphones stayed quiet all day, but nobody noticed, because the music was coming from everyone.",
    questions: [
      { q: "What colour are DJ Boo's headphones?", options: ['golden', 'purple', 'silver'], correct: 0, type: 'retrieval', hintParagraph: 1 },
      { q: 'What did Fuzz do to help?', options: ['stamped his feet', 'hummed a tune', 'fixed the headphones'], correct: 0, type: 'retrieval', hintParagraph: 2 },
      { q: 'How did DJ Boo feel at the start of the story?', options: ['sad', 'angry', 'sleepy'], correct: 0, type: 'inference', hintParagraph: 1 },
      { q: "'Drooping' ears are ears that are...", options: ['hanging down', 'standing up', 'very clean'], correct: 0, type: 'vocab', hintParagraph: 1 },
    ],
  },
  {
    id: 'story3',
    title: "Twiglet's tall problem",
    text: "Twiglet was the smallest giraffe anyone had ever seen, but she was still taller than every Boo house in town. At bedtime her friends squeezed into their snug little homes, and Twiglet's long neck poked out of every window she tried. 'I'll just sleep outside,' she said bravely, though the night looked cold. The Boos would not hear of it. Munch fetched planks. Pip fetched ladders. All evening the town hammered and painted, and by moonrise there stood the tallest, thinnest house in Boo Town, with a window right at the top. Twiglet slid inside, and her head fitted perfectly. 'It's like the house is giving me a hug,' she yawned. And it was the first house in town with a chimney shaped like a leaf.",
    questions: [
      { q: 'What poked out of the windows?', options: ["Twiglet's long neck", 'a ladder', 'a chimney'], correct: 0, type: 'retrieval', hintParagraph: 1 },
      { q: 'What did Munch fetch?', options: ['planks', 'ladders', 'paint'], correct: 0, type: 'retrieval', hintParagraph: 2 },
      { q: 'Why did the Boos build a tall thin house?', options: ['so Twiglet could fit and not sleep outside', 'because they ran out of wide wood', 'to see over the trees'], correct: 0, type: 'inference', hintParagraph: 2 },
      { q: "'Snug' means...", options: ['small, warm and comfy', 'cold and damp', 'very loud'], correct: 0, type: 'vocab', hintParagraph: 1 },
    ],
  },
];
