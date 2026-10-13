/* Party games: Live Quiz Show (everyone answers on their own phone at the same time, fastest right answer
   scores most; any spare screen can be the "TV"), Who's the Imposter? (everyone gets the secret word except
   one person; give clues, vote, catch them) and Forehead Charades (hold the phone to your forehead, the family
   acts it out, tilt down for "got it", up to pass). The first two run on the arcade engine (arcade.js).
   Loaded after pet.js. */
'use strict';

/* =========================================================
   Live Quiz Show
   ========================================================= */
// [question, right answer, wrong, wrong, wrong, category]
const QUIZ = [
  ['What is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Earth', 'Mars', '🔭'], ['How many legs does a spider have?', '8', '6', '10', '4', '🐾'],
  ['What do bees make?', 'Honey', 'Milk', 'Silk', 'Butter', '🐾'], ['Which planet is called the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury', '🔭'],
  ['What is the biggest ocean on Earth?', 'Pacific', 'Atlantic', 'Indian', 'Arctic', '🌍'], ['How many continents are there?', '7', '5', '6', '9', '🌍'],
  ['What is frozen water called?', 'Ice', 'Steam', 'Fog', 'Dew', '🔬'], ['Which animal is the tallest?', 'Giraffe', 'Elephant', 'Horse', 'Camel', '🐾'],
  ['What color do you get mixing blue and yellow?', 'Green', 'Purple', 'Orange', 'Brown', '🎨'], ['How many days are in a leap year?', '366', '365', '364', '360', '🔢'],
  ['What is the fastest land animal?', 'Cheetah', 'Lion', 'Horse', 'Greyhound', '🐾'], ['What gas do plants breathe in?', 'Carbon dioxide', 'Oxygen', 'Helium', 'Nitrogen', '🔬'],
  ['Which is the largest mammal?', 'Blue whale', 'Elephant', 'Giraffe', 'Hippo', '🐾'], ['What is 7 × 8?', '56', '54', '64', '48', '🔢'],
  ['What is the capital of the United States?', 'Washington, D.C.', 'New York', 'Chicago', 'Philadelphia', '🌍'], ['How many sides does a hexagon have?', '6', '5', '7', '8', '🔢'],
  ['Which planet has the biggest rings?', 'Saturn', 'Jupiter', 'Uranus', 'Neptune', '🔭'], ['What do caterpillars turn into?', 'Butterflies', 'Bees', 'Beetles', 'Dragonflies', '🐾'],
  ['What is the hardest natural material?', 'Diamond', 'Gold', 'Iron', 'Glass', '🔬'], ['Which Great Lake is NOT touching Michigan?', 'Lake Ontario', 'Lake Huron', 'Lake Erie', 'Lake Superior', '〽️'],
  ['What is Michigan’s state bird?', 'Robin', 'Cardinal', 'Blue jay', 'Eagle', '〽️'], ['Detroit is famous as the “Motor ___”?', 'City', 'Town', 'Land', 'State', '〽️'],
  ['Which bridge connects Michigan’s two peninsulas?', 'Mackinac Bridge', 'Golden Gate', 'Ambassador Bridge', 'Brooklyn Bridge', '〽️'], ['What is Michigan’s nickname?', 'The Great Lakes State', 'The Sunshine State', 'The Lone Star State', 'The Empire State', '〽️'],
  ['Which Detroit team plays hockey?', 'Red Wings', 'Tigers', 'Lions', 'Pistons', '〽️'], ['Which Detroit team plays baseball?', 'Tigers', 'Lions', 'Red Wings', 'Pistons', '〽️'],
  ['What shape is a stop sign?', 'Octagon', 'Hexagon', 'Square', 'Circle', '🔢'], ['How many players are on a soccer team on the field?', '11', '9', '10', '12', '⚽'],
  ['How many points is a touchdown worth?', '6', '7', '3', '5', '⚽'], ['In which sport do you hit a shuttlecock?', 'Badminton', 'Tennis', 'Golf', 'Volleyball', '⚽'],
  ['How many rings are on the Olympic flag?', '5', '4', '6', '7', '⚽'], ['What is the main ingredient in guacamole?', 'Avocado', 'Tomato', 'Pepper', 'Lime', '🍕'],
  ['Which fruit has its seeds on the outside?', 'Strawberry', 'Blueberry', 'Apple', 'Banana', '🍕'], ['What is a baby kangaroo called?', 'Joey', 'Cub', 'Kit', 'Calf', '🐾'],
  ['What is a baby cow called?', 'Calf', 'Foal', 'Kid', 'Pup', '🐾'], ['How many hearts does an octopus have?', '3', '1', '2', '8', '🐾'],
  ['Which bird can’t fly?', 'Penguin', 'Eagle', 'Parrot', 'Robin', '🐾'], ['What is the closest star to Earth?', 'The Sun', 'The Moon', 'Polaris', 'Sirius', '🔭'],
  ['What do you call a scientist who studies dinosaurs?', 'Paleontologist', 'Biologist', 'Astronomer', 'Geologist', '🔬'], ['How many teeth does a grown-up usually have?', '32', '28', '24', '36', '🔬'],
  ['What is the biggest organ of the human body?', 'Skin', 'Heart', 'Liver', 'Brain', '🔬'], ['How many bones are in the human body?', '206', '106', '306', '156', '🔬'],
  ['What planet do we live on?', 'Earth', 'Mars', 'Venus', 'Pluto', '🔭'], ['How many minutes are in an hour?', '60', '100', '30', '24', '🔢'],
  ['What is 12 + 15?', '27', '25', '28', '37', '🔢'], ['What is half of 50?', '25', '20', '30', '15', '🔢'],
  ['Which country has the pyramids of Giza?', 'Egypt', 'Mexico', 'Peru', 'India', '🌍'], ['Which country is shaped like a boot?', 'Italy', 'Spain', 'France', 'Greece', '🌍'],
  ['What is the longest river in the world?', 'Nile', 'Amazon', 'Mississippi', 'Yangtze', '🌍'], ['Which is the coldest continent?', 'Antarctica', 'Europe', 'Asia', 'North America', '🌍'],
  ['What language is spoken in Mexico?', 'Spanish', 'Portuguese', 'French', 'English', '🌍'], ['What is the capital of France?', 'Paris', 'London', 'Rome', 'Madrid', '🌍'],
  ['How many colors are in a rainbow?', '7', '5', '6', '8', '🎨'], ['What color are a flamingo’s feathers?', 'Pink', 'Blue', 'White', 'Green', '🐾'],
  ['What do you call a group of wolves?', 'Pack', 'Herd', 'Flock', 'School', '🐾'], ['What do you call a group of fish?', 'School', 'Pack', 'Team', 'Herd', '🐾'],
  ['Which instrument has 88 keys?', 'Piano', 'Guitar', 'Violin', 'Flute', '🎨'], ['How many strings does a regular guitar have?', '6', '4', '5', '8', '🎨'],
  ['What is the opposite of “ancient”?', 'Modern', 'Old', 'Huge', 'Quiet', '🔤'], ['Which word rhymes with “cat”?', 'Hat', 'Dog', 'Cup', 'Sun', '🔤'],
  ['How many letters are in the alphabet?', '26', '24', '25', '28', '🔤'], ['Which is a vowel?', 'E', 'B', 'T', 'K', '🔤'],
  ['What is the plural of “mouse”?', 'Mice', 'Mouses', 'Meese', 'Mousies', '🔤'], ['Which month has the fewest days?', 'February', 'April', 'June', 'November', '🔢'],
  ['What is the boiling point of water in °F?', '212°', '100°', '180°', '250°', '🔬'], ['Which way does the sun rise?', 'East', 'West', 'North', 'South', '🔭'],
  ['What makes a rainbow?', 'Sunlight and rain', 'Wind', 'Clouds only', 'Moonlight', '🔬'], ['What is a group of stars that makes a picture called?', 'Constellation', 'Galaxy', 'Comet', 'Orbit', '🔭'],
  ['Who was the first person to walk on the Moon?', 'Neil Armstrong', 'Buzz Aldrin', 'Sally Ride', 'John Glenn', '🔭'], ['How long does Earth take to go around the Sun?', '1 year', '1 month', '1 day', '1 week', '🔭'],
  ['What is the main food of pandas?', 'Bamboo', 'Fish', 'Berries', 'Grass', '🐾'], ['Which animal is known as the “King of the Jungle”?', 'Lion', 'Tiger', 'Gorilla', 'Elephant', '🐾'],
  ['How many arms does a starfish usually have?', '5', '4', '6', '8', '🐾'], ['What do frogs start life as?', 'Tadpoles', 'Caterpillars', 'Eggs with shells', 'Puppies', '🐾'],
  ['What is the biggest bird?', 'Ostrich', 'Eagle', 'Swan', 'Pelican', '🐾'], ['Which sense do you use with your nose?', 'Smell', 'Taste', 'Touch', 'Hearing', '🔬'],
  ['Pizza first came from which country?', 'Italy', 'USA', 'Greece', 'France', '🍕'], ['What is popcorn made from?', 'Corn', 'Rice', 'Wheat', 'Potatoes', '🍕'],
  ['Which vegetable is orange and crunchy?', 'Carrot', 'Celery', 'Pea', 'Lettuce', '🍕'], ['What is a Coney dog topped with in Detroit?', 'Chili', 'Ketchup only', 'Cheese sauce', 'Pineapple', '〽️'],
  ['What kind of pizza is Detroit known for?', 'Square, deep-dish', 'Thin and round', 'Folded', 'Pizza bagels', '〽️'], ['What is Michigan’s state tree?', 'White pine', 'Oak', 'Maple', 'Palm', '〽️'],
  ['How many players are on a basketball team on the court?', '5', '6', '7', '4', '⚽'], ['In bowling, what is it called when you knock all pins down on the first try?', 'Strike', 'Spare', 'Gutter', 'Split', '⚽'],
  ['What do you call a score of zero in tennis?', 'Love', 'Nil', 'Duck', 'Zip', '⚽'], ['Which sport uses a puck?', 'Hockey', 'Soccer', 'Golf', 'Baseball', '⚽'],
  ['What is 9 × 9?', '81', '72', '99', '89', '🔢'], ['What is 100 − 37?', '63', '73', '67', '53', '🔢'],
  ['How many sides does a triangle have?', '3', '4', '2', '5', '🔢'], ['What comes after a thousand million?', 'Billion', 'Trillion', 'Gazillion', 'Zillion', '🔢'],
  ['What do you call molten rock that comes out of a volcano?', 'Lava', 'Magma', 'Ash', 'Steam', '🔬'], ['What force keeps us on the ground?', 'Gravity', 'Magnetism', 'Wind', 'Friction', '🔬'],
  ['Which tool helps you see tiny things up close?', 'Microscope', 'Telescope', 'Periscope', 'Stethoscope', '🔬'], ['What season comes after winter?', 'Spring', 'Summer', 'Fall', 'Monsoon', '🌍'],
  ['What do you call a word that means the same as another?', 'Synonym', 'Antonym', 'Verb', 'Noun', '🔤'], ['What is the biggest desert in the world?', 'Antarctica', 'Sahara', 'Gobi', 'Mojave', '🌍'],
];
const QZ_N = 10, QZ_MS = 20000;
const qzCur = (g) => g.qs.findIndex((_, i) => !g.skip?.[i] && g.p.some((x) => !(g.ans[x] && i in g.ans[x])));
const qzQ = (g, i) => { const Q = QUIZ[g.qs[i]]; return { q: Q[0], cat: Q[5], ch: g.ord[i].map((k) => Q[1 + k]), right: g.ord[i].indexOf(0) }; };
const qzPts = (a, right) => (a && a[0] === right ? 500 + Math.round(500 * Math.max(0, 1 - a[1] / QZ_MS)) : 0);
const QZ_SHAPES = [['▲', '#e11d48'], ['◆', '#2563eb'], ['●', '#d97706'], ['■', '#16a34a']];
GX.quiz = {
  name: 'Quiz Show', e: '🎤', g1: '#7c3aed', g2: '#e11d48', tag: 'Buzz in from every phone', max: 6, bot: true, hidden: true, botDelay: 2500, botNote: 'Knows a lot, not everything',
  how: `${QZ_N} questions. Everyone answers on their own phone at the same time — right answers score up to 1,000, more the faster you are. Any spare screen (iPad, laptop) can show the questions like a TV.`,
  init: () => { const qs = shuffle([...QUIZ.keys()]).slice(0, QZ_N); return { qs, ord: qs.map(() => shuffle([0, 1, 2, 3])), ans: {}, skip: {}, qAt: {} }; },
  need(g) { const i = qzCur(g); return i < 0 ? [] : g.p.filter((x) => !(g.ans[x] && i in g.ans[x])); },
  prompt(g) { const i = qzCur(g); return `Question ${i + 1} of ${g.qs.length}`; },
  scores(g) { const s = Object.fromEntries(g.p.map((x) => [x, 0])); g.qs.forEach((_, i) => { const r = qzQ(g, i).right; for (const x of g.p) s[x] += qzPts(g.ans[x]?.[i], r); }); return s; },
  status(g) {
    if (qzCur(g) >= 0) return { over: false };
    const s = this.scores(g), top = Math.max(...Object.values(s)), w = g.p.filter((x) => s[x] === top);
    return { over: true, winner: w.length === 1 ? w[0] : 'draw' };
  },
  act(g, who, v) {
    const [, qi, c, ms] = String(v).split(':'), i = Number(qi);
    if (i !== qzCur(g) || (g.ans[who] && i in g.ans[who])) return false;
    g.ans = { ...g.ans, [who]: { ...(g.ans[who] || {}), [i]: [Number(c), Math.max(0, Math.min(QZ_MS, Number(ms) || QZ_MS))] } };
  },
  bot(g) { const i = qzCur(g), r = qzQ(g, i).right; return `a:${i}:${Math.random() < .65 ? r : (r + 1 + mpRand(3)) % 4}:${3000 + mpRand(9000)}`; },
  view(g, who, st) {
    if (st.over) return qzBoard(g, true);
    const i = qzCur(g), Q = qzQ(g, i), me = g.mode === 'remote' ? actor() : who;
    if (!g.qAt[i]) { g.qAt = { ...g.qAt, [i]: Date.now() }; setTimeout(save); }
    // Last question's answer, until you tap on (or 5 seconds pass)
    const prev = i - 1;
    if (me && prev >= 0 && (ui.qzSeen?.[g.id] ?? -1) < prev && g.ans[me] && prev in g.ans[me]) {
      const P = qzQ(g, prev), a = g.ans[me][prev], pts = qzPts(a, P.right);
      return `<div class="qz-reveal ${pts ? 'ok' : 'no'}"><div class="qz-big">${pts ? '✅ Correct!' : a[0] < 0 ? '⏰ Too slow!' : '❌ Not quite'}</div>${pts ? `<div class="qz-pts">+${pts}</div>` : ''}<p>${esc(P.q)}<br><b>${esc(P.ch[P.right])}</b></p></div>
        ${qzBoard(g)}<div class="btn-row"><button class="btn" data-action="qz-next" data-id="${g.id}" data-i="${prev}">Next question ▶</button></div>`;
    }
    if (who) {
      ui.qzAt ||= {}; const key = g.id + ':' + i; if (!ui.qzAt[key]) ui.qzAt[key] = Date.now();
      return `<div class="qz-q"><span class="qz-cat">${Q.cat}</span>${esc(Q.q)}</div><div class="qz-timer" data-qz="${key}" style="--ms:${QZ_MS}ms;--d:${-(Date.now() - ui.qzAt[key])}ms"><i></i></div>
        <div class="game-stage qz-stage"><div class="qz-choices">${Q.ch.map((c, k) => `<button class="qz-ch" style="--c:${QZ_SHAPES[k][1]}" data-action="qz-pick" data-id="${g.id}" data-i="${i}" data-k="${k}"><span>${QZ_SHAPES[k][0]}</span>${esc(c)}</button>`).join('')}</div></div>`;
    }
    const waiting = mpNeed(g).filter((x) => x !== BOT), late = Date.now() - (g.qAt[i] || Date.now()) > QZ_MS + 5000;
    return `<div class="qz-q small-q"><span class="qz-cat">${Q.cat}</span>${esc(Q.q)}</div><div class="qz-locked">🔒 Locked in! Waiting for ${esc(waiting.map(playerName).join(', ') || 'the robot')}…</div>
      ${qzBoard(g)}${late && waiting.length ? `<div class="btn-row"><button class="btn secondary" data-action="qz-skip" data-id="${g.id}" data-i="${i}">⏭ Skip the slowpokes</button></div>` : ''}`;
  },
  // Big-screen view for a spare screen: the question, who's answered, the scores
  tv(g, st) {
    const s = this.scores(g);
    if (st.over) return `<div class="qz-tv">${qzBoard(g, true)}</div>`;
    const i = qzCur(g), Q = qzQ(g, i);
    if (!g.qAt[i]) { g.qAt = { ...g.qAt, [i]: Date.now() }; setTimeout(save); }
    return `<div class="qz-tv"><div class="qz-tvn">Question ${i + 1} of ${g.qs.length}</div><div class="qz-q tvq"><span class="qz-cat">${Q.cat}</span>${esc(Q.q)}</div>
      <div class="qz-choices tv">${Q.ch.map((c, k) => `<div class="qz-ch" style="--c:${QZ_SHAPES[k][1]}"><span>${QZ_SHAPES[k][0]}</span>${esc(c)}</div>`).join('')}</div>
      <div class="qz-who">${g.p.map((x) => `<span class="${g.ans[x] && i in g.ans[x] ? 'in' : ''}">${esc(playerEmoji(x))}<small>${s[x]}</small></span>`).join('')}</div>
      ${ui.mpTv === g.id ? `<div class="btn-row"><button class="btn secondary" data-action="qz-tv" data-id="${g.id}">Back to my answers</button></div>` : ''}</div>`;
  },
};
function qzBoard(g, final) {
  const s = GX.quiz.scores(g), rank = [...g.p].sort((a, b) => s[b] - s[a]), top = s[rank[0]] || 1;
  return `<div class="qz-board${final ? ' final' : ''}">${rank.map((x, k) => `<div class="qz-row" style="--c:${mpColor(g, x)}"><b>${final ? ['🥇', '🥈', '🥉'][k] || `${k + 1}.` : `${k + 1}.`}</b><span>${esc(playerEmoji(x))} ${esc(playerName(x))}</span><i style="--w:${Math.round((s[x] / top) * 100)}%"></i><em>${s[x].toLocaleString()}</em></div>`).join('')}</div>`;
}

/* =========================================================
   Who's the Imposter?
   ========================================================= */
const IMP_WORDS = {
  '🐾 Animals': ['Elephant', 'Penguin', 'Kangaroo', 'Giraffe', 'Octopus', 'Dolphin', 'Owl', 'Turtle', 'Zebra', 'Squirrel', 'Shark', 'Butterfly'],
  '🍕 Food': ['Pizza', 'Tacos', 'Pancakes', 'Ice cream', 'Spaghetti', 'Popcorn', 'Sushi', 'Burger', 'Watermelon', 'Cereal', 'Hot dog', 'Cupcake'],
  '📍 Places': ['Beach', 'Zoo', 'Library', 'Airport', 'Hospital', 'Farm', 'Movie theater', 'Playground', 'Grocery store', 'Camping', 'Castle', 'Space'],
  '👷 Jobs': ['Doctor', 'Teacher', 'Firefighter', 'Chef', 'Pilot', 'Astronaut', 'Farmer', 'Police officer', 'Dentist', 'Artist', 'Mail carrier', 'Vet'],
  '⚽ Sports': ['Soccer', 'Basketball', 'Swimming', 'Hockey', 'Baseball', 'Bowling', 'Skating', 'Gymnastics', 'Tennis', 'Karate', 'Golf', 'Football'],
  '🏠 At home': ['Bathtub', 'Fridge', 'Couch', 'Toothbrush', 'Pillow', 'Microwave', 'Laundry', 'Lamp', 'Stairs', 'Mailbox', 'Vacuum', 'Backyard'],
  '🎉 Holidays': ['Halloween', 'Christmas', 'Birthday', 'Thanksgiving', 'Easter', 'Fourth of July', 'Valentine’s Day', 'New Year’s Eve', 'Snow day', 'Summer vacation', 'Field trip', 'Sleepover'],
};
const impPhase = (g) => {
  if (g.p.some((x) => !g.seen[x])) return 'look';
  if (g.loud ? !g.talked : Object.values(g.clues).reduce((a, c) => a + c.length, 0) < g.p.length * 2) return 'clue';
  if (g.p.some((x) => !g.votes[x])) return 'vote';
  return impCaught(g) && !g.guess ? 'guess' : 'done';
};
const impTally = (g) => { const t = {}; for (const v of Object.values(g.votes)) t[v] = (t[v] || 0) + 1; return t; };
const impCaught = (g) => { const t = impTally(g), top = Math.max(0, ...Object.values(t)), w = Object.keys(t).filter((x) => t[x] === top); return w.length === 1 && w[0] === g.imp; };
const impCrewWins = (g) => impCaught(g) && g.guess !== g.word;
const impNextClue = (g) => g.order[Object.values(g.clues).reduce((a, c) => a + c.length, 0) % g.order.length];
GX.imposter = {
  name: 'Who’s the Imposter?', e: '🕵️', g1: '#0f172a', g2: '#7c3aed', tag: '3+ players · party game', max: 8, min: 3, bot: false, hidden: true,
  how: 'Everyone gets the same secret word — except the imposter, who only knows the category. Take turns giving a one-word clue (twice around), then vote. Catch the imposter… unless they can guess the word!',
  init(p, opts = {}) {
    const cat = mpPick(Object.keys(IMP_WORDS));
    return { cat, word: mpPick(IMP_WORDS[cat]), imp: mpPick(p), order: shuffle(p.slice()), seen: {}, clues: {}, votes: {}, guess: '', loud: !!opts.loud };
  },
  need(g) {
    const ph = impPhase(g);
    return ph === 'look' ? g.p.filter((x) => !g.seen[x]) : ph === 'clue' ? [g.loud ? g.order[0] : impNextClue(g)] : ph === 'vote' ? g.p.filter((x) => !g.votes[x]) : ph === 'guess' ? [g.imp] : [];
  },
  open: (g) => g.loud && impPhase(g) === 'clue',
  prompt(g, who) {
    const ph = impPhase(g), name = g.mode === 'remote' ? 'Your' : `${playerName(who)}’s`;
    return { look: `🤫 ${g.mode === 'remote' ? 'Peek at your word' : `${playerName(who)}, peek at your word`}`, clue: g.loud ? '🗣️ Clue time' : `💬 ${name} clue`, vote: `🗳️ ${g.mode === 'remote' ? 'Who’s the imposter?' : `${playerName(who)}, vote!`}`, guess: '🕵️ Caught! One chance to guess the word…' }[ph] || '';
  },
  scores(g) { const s = Object.fromEntries(g.p.map((x) => [x, 0])); if (impPhase(g) === 'done') { if (impCrewWins(g)) g.p.forEach((x) => { if (x !== g.imp) s[x] = 1; }); else s[g.imp] = 2; } return s; },
  status(g) { return impPhase(g) === 'done' ? { over: true, winner: impCrewWins(g) ? 'crew' : g.imp } : { over: false }; },
  endText(g) { return impCrewWins(g) ? `🎉 Caught ${playerName(g.imp)}! The crew wins` : impCaught(g) ? `😈 ${playerName(g.imp)} was caught but guessed the word!` : `😈 ${playerName(g.imp)} was the imposter and got away!`; },
  act(g, who, v) {
    const ph = impPhase(g), [k, ...rest] = String(v).split(':'), val = rest.join(':');
    if (ph === 'look' && k === 'seen') { g.seen = { ...g.seen, [who]: true }; return; }
    if (ph === 'clue' && g.loud && k === 'talked') { g.talked = true; return; }
    if (ph === 'clue' && k === 'clue') {
      const c = val.trim().replace(/\s+/g, ' ').slice(0, 24);
      if (!c || c.toLowerCase() === g.word.toLowerCase()) return false;
      g.clues = { ...g.clues, [who]: [...(g.clues[who] || []), c] }; return;
    }
    if (ph === 'vote' && k === 'vote' && g.p.includes(val) && val !== who) { g.votes = { ...g.votes, [who]: val }; return; }
    if (ph === 'guess' && k === 'guess' && who === g.imp && IMP_WORDS[g.cat].includes(val)) { g.guess = val; return; }
    return false;
  },
  view(g, who, st) {
    const ph = impPhase(g), me = g.mode === 'remote' ? actor() : who;
    const clueList = () => (g.loud ? '' : `<div class="imp-clues">${g.order.map((x) => `<div class="imp-cl"><span>${esc(playerEmoji(x))} ${esc(playerName(x))}</span>${(g.clues[x] || []).map((c) => `<b>${esc(c)}</b>`).join('') || '<i class="muted">…</i>'}</div>`).join('')}</div>`);
    if (st.over) {
      const t = impTally(g);
      return `<div class="imp-card reveal"><div class="small muted">The secret word was</div><div class="imp-word">${esc(g.word)}</div><div class="small">${esc(playerEmoji(g.imp))} ${esc(playerName(g.imp))} was the imposter${g.guess ? ` · guessed “${esc(g.guess)}”` : ''}</div></div>
        ${clueList()}<div class="imp-votes">${g.p.map((x) => `<span>${esc(playerEmoji(x))} ${t[x] || 0} vote${t[x] === 1 ? '' : 's'}</span>`).join('')}</div>`;
    }
    const card = (x) => (x === g.imp ? `<div class="imp-card imp"><div class="imp-word">🕵️ You’re the imposter!</div><div class="small">Category: <b>${esc(g.cat)}</b> · blend in, and figure out the word</div></div>`
      : `<div class="imp-card"><div class="small muted">${esc(g.cat)} · the secret word is</div><div class="imp-word">${esc(g.word)}</div><div class="small muted">Don’t say it! Give clues only your team would get.</div></div>`);
    if (ph === 'look') {
      if (who) return `${card(who)}<div class="btn-row"><button class="btn" data-action="mp-act" data-id="${g.id}" data-v="seen">Got it 👍</button></div>`;
      return `${me && g.p.includes(me) ? card(me) : ''}<p class="small muted" style="text-align:center">Waiting for everyone to peek…</p>`;
    }
    const mine = me && g.p.includes(me) && g.mode === 'remote' ? `<details class="imp-peek"><summary>👀 My word</summary>${card(me)}</details>` : '';
    if (ph === 'clue' && g.loud) {
      return `<div class="card imp-loud">🗣️ <b>Clue time!</b> Go around twice and each say <b>one word</b> about the secret word, starting with ${esc(playerEmoji(g.order[0]))} ${esc(playerName(g.order[0]))}:<div class="imp-order">${g.order.map((x) => `<span>${esc(playerEmoji(x))} ${esc(playerName(x))}</span>`).join('<i>→</i>')}</div>The imposter has to fake it! 🤫</div>
        <div class="btn-row"><button class="btn" data-action="mp-act" data-id="${g.id}" data-v="talked">Done — time to vote 🗳️</button></div>`;
    }
    if (ph === 'clue') {
      return `${mine}${clueList()}${who ? `<form class="imp-form" data-submit="imp-clue" data-id="${g.id}"><input name="clue" maxlength="24" autocomplete="off" placeholder="One-word clue" enterkeyhint="send"><button class="btn">Send</button></form>` : `<p class="small muted" style="text-align:center">${esc(playerName(impNextClue(g)))} is thinking of a clue…</p>`}`;
    }
    if (ph === 'vote') {
      const head = '';
      if (who) return `${head}${g.mode === 'remote' ? mine : ''}${clueList()}<p style="text-align:center;margin:8px 0"><b>Who’s the imposter?</b></p><div class="imp-vote">${g.p.filter((x) => x !== who).map((x) => `<button class="mp-pickb" data-action="mp-act" data-id="${g.id}" data-v="vote:${x}"><span>${esc(playerEmoji(x))}</span>${esc(playerName(x))}</button>`).join('')}</div>`;
      return `${head}${mine}${clueList()}<p class="small muted" style="text-align:center">Votes are in from ${Object.keys(g.votes).length} of ${g.p.length}…</p>`;
    }
    // guess
    if (who) return `<div class="imp-card imp"><div class="imp-word">You’ve been caught! 😱</div><div class="small">Guess the word to win anyway (${esc(g.cat)}):</div></div><div class="imp-vote">${shuffle(IMP_WORDS[g.cat].filter((w) => w !== g.word)).slice(0, 5).concat(g.word).sort().map((w) => `<button class="mp-pickb" data-action="mp-act" data-id="${g.id}" data-v="guess:${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
    return `<div class="imp-card"><div class="imp-word">${esc(playerEmoji(g.imp))} ${esc(playerName(g.imp))} got caught!</div><div class="small muted">They get one guess at the word…</div></div>`;
  },
};

/* =========================================================
   Forehead Charades (one phone, the whole room)
   ========================================================= */
const CH_DECKS = {
  '🐾 Animals': 'Monkey,Elephant,Penguin,Kangaroo,Snake,Chicken,Frog,Dog,Cat,Horse,Bunny,Duck,Lion,Bear,Shark,Crab,Owl,Giraffe,Pig,Cow,Turtle,Bat,Octopus,Dinosaur,Squirrel,Flamingo',
  '🎭 Act it out': 'Brushing teeth,Riding a bike,Swimming,Sleeping,Dancing,Fishing,Driving,Juggling,Skating,Sneezing,Eating spaghetti,Taking a selfie,Climbing a ladder,Playing guitar,Mowing the lawn,Walking a dog,Baking a cake,Building a snowman,Bowling,Surfing,Washing dishes,Blowing bubbles,Flying a kite,Painting,Yawning,Typing',
  '🍕 Food': 'Pizza,Ice cream,Spaghetti,Banana,Popcorn,Tacos,Pancakes,Hot dog,Corn on the cob,Cereal,Soup,Watermelon,Lemon,Cotton candy,Burger,Donut,Pretzel,Sandwich,Cookies,Corn dog,Chips,Sushi,Smoothie,Lollipop,Bacon,Cupcake',
  '👷 Jobs': 'Doctor,Teacher,Firefighter,Chef,Pilot,Astronaut,Farmer,Police officer,Dentist,Lifeguard,Mail carrier,Magician,Builder,Hairdresser,Waiter,Photographer,Scientist,Singer,Clown,Bus driver,Plumber,Vet,Coach,Librarian,Barber,Painter',
  '⚽ Sports': 'Soccer,Basketball,Hockey,Baseball,Football,Golf,Tennis,Bowling,Karate,Gymnastics,Skiing,Boxing,Swimming,Volleyball,Skateboarding,Wrestling,Surfing,Archery,Ping pong,Cycling,Fishing,Running,Jump rope,Rowing,Dodgeball,Ice skating',
  '🏠 Around the house': 'Toothbrush,Vacuum,Fridge,Couch,Shower,Bed,Microwave,TV remote,Lamp,Doorbell,Washing machine,Toaster,Pillow,Mirror,Stairs,Alarm clock,Blanket,Fan,Broom,Mailbox,Trash can,Oven,Sink,Window,Backpack,Umbrella',
  '〽️ Detroit': 'Red Wings,Tigers,Lions,Pistons,Coney dog,Square pizza,Belle Isle,RiverWalk,Car factory,Detroit Zoo,Ice skating downtown,Thanksgiving parade,Fireworks,The Fox Theatre,Ambassador Bridge,Cider mill,Snow day,Lake Michigan,Mackinac Bridge,Fudge,Hockey game,Tailgate,Auto show,Motown music,Greenfield Village,Pumpkin patch',
};
const CH_SECS = 60;
const chDeck = (k) => CH_DECKS[k].split(',');
Object.assign(TITLES, { charades: 'Forehead Charades' });
views.charades = () => {
  const R = ui.ch;
  if (!R || R.phase === 'setup') {
    const me = actor(), who = ui.chWho || me || state.members[0]?.id;
    const best = state.scores.filter((s) => s.game === 'charades').sort((a, b) => b.score - a.score).slice(0, 3);
    return `<p class="small muted" style="margin:0 0 10px">Hold the phone on your forehead facing the room. Everyone acts out the word — <b>tilt down</b> when you get it ✅, <b>tilt up</b> to pass ⏭. (Or tap the right / left side.) ${CH_SECS} seconds!</p>
      <div class="section-title">Who’s guessing?</div><div class="mp-who">${state.members.map((m) => `<button class="mp-pickb${who === m.id ? ' on' : ''}" data-action="ch-who" data-id="${m.id}"><span>${esc(m.emoji)}</span>${esc(m.name)}</button>`).join('')}</div>
      <div class="section-title">Pick a deck</div><div class="ch-decks">${Object.keys(CH_DECKS).map((k) => `<button class="ch-deck" data-action="ch-start" data-k="${esc(k)}"><span>${k.split(' ')[0]}</span>${esc(k.split(' ').slice(1).join(' '))}</button>`).join('')}</div>
      ${best.length ? `<div class="section-title">Best rounds</div><div class="card flush">${best.map((s) => `<div class="row"><div class="avatar">${esc(playerEmoji(s.who))}</div><div class="grow"><div class="title">${esc(playerName(s.who))}</div><div class="sub">${esc(s.deck || '')}</div></div><b>${s.score}</b></div>`).join('')}</div>` : ''}`;
  }
  if (R.phase === 'ready') {
    return `<div class="ch-full ch-ready" data-action="ch-go"><div class="ch-rot${ui.chFlip ? ' flip' : ''}"><div class="ch-hint">Put the phone on your forehead</div><div class="ch-word">${R.count ? R.count : 'Tap to start'}</div><div class="ch-hint">${esc(R.deck)}</div></div></div>
      <div class="btn-row ch-below"><button class="btn secondary" data-action="ch-flip">🔄 Flip the text</button><button class="btn secondary" data-action="ch-quit">Cancel</button></div>`;
  }
  if (R.phase === 'play') {
    const left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000)), flash = R.flash && Date.now() - R.flash.t < 700 ? R.flash.k : '';
    return `<div class="ch-full ch-play${flash ? ' ' + flash : ''}"><button class="ch-tap left" data-action="ch-mark" data-k="pass" aria-label="Pass"></button><button class="ch-tap right" data-action="ch-mark" data-k="got" aria-label="Got it"></button>
      <div class="ch-rot${ui.chFlip ? ' flip' : ''}"><div class="ch-time">${left}</div><div class="ch-word">${flash === 'got' ? 'Correct! ✅' : flash === 'pass' ? 'Pass ⏭' : esc(R.words[R.i])}</div><div class="ch-hint">✅ ${R.got.length}</div></div></div>`;
  }
  // done
  return `<div class="card ch-result"><div class="ch-score">${R.got.length}</div><div class="muted">${esc(playerEmoji(R.who))} ${esc(playerName(R.who))} · ${esc(R.deck)}</div>${R.gem ? gameGemNote(R.gem, R.who) : ''}</div>
    <div class="card flush">${R.log.map(([w, k]) => `<div class="row"><div class="grow">${esc(w)}</div><span>${k === 'got' ? '✅' : '⏭'}</span></div>`).join('')}</div>
    <div class="btn-row"><button class="btn" data-action="ch-again">🔁 Next player</button><button class="btn secondary" data-action="ch-quit">Done</button></div>`;
};
// Tilt: how much the screen faces up (+1) or down (−1); about 0 when it's upright on your forehead
let chTilt = null, chArmed = true, chTick = 0;
function chOrient(e) {
  const R = ui.ch;
  if (!R || R.phase !== 'play' || e.beta == null || e.gamma == null) return;
  const v = Math.cos(e.beta * Math.PI / 180) * Math.cos(e.gamma * Math.PI / 180);
  if (Math.abs(v) < .3) { chArmed = true; return; }
  if (!chArmed || Date.now() - (R.flash?.t || 0) < 900) return;
  if (v < -.55) { chArmed = false; chMark('got'); } else if (v > .55) { chArmed = false; chMark('pass'); }
}
function chMark(k) {
  const R = ui.ch; if (!R || R.phase !== 'play') return;
  const w = R.words[R.i]; R.log.push([w, k]); if (k === 'got') R.got.push(w);
  R.i = (R.i + 1) % R.words.length; R.flash = { k, t: Date.now() };
  try { navigator.vibrate?.(k === 'got' ? 60 : [30, 40, 30]); } catch { /* no vibration */ }
  gBuzz(); render();
  setTimeout(() => { if (ui.ch === R && R.phase === 'play') render(); }, 720);
}
function chEnd() {
  const R = ui.ch; if (!R || R.phase !== 'play') return;
  R.phase = 'done'; clearInterval(chTick); window.removeEventListener('deviceorientation', chOrient);
  state.scores.push({ id: uid(), game: 'charades', who: R.who, score: R.got.length, deck: R.deck, at: Date.now() });
  state.scores = state.scores.slice(-300);
  if (R.got.length >= 5) R.gem = gameGem(R.who, 'Forehead Charades: 5+ words 🤳');
  logAct('🤳', `got ${R.got.length} in Forehead Charades (${R.deck})`, 'games');
  save(); render(); if (R.got.length >= 8) setTimeout(confetti, 200);
}
Object.assign(actions, {
  'ch-who': (el) => { ui.chWho = el.dataset.id; render(); },
  'ch-start': async (el) => {
    // iPhone asks for motion permission on a tap
    try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission(); } catch { /* falls back to taps */ }
    const k = el.dataset.k;
    ui.ch = { phase: 'ready', deck: k, words: shuffle(chDeck(k)), i: 0, got: [], log: [], who: ui.chWho || actor() || state.members[0]?.id };
    render();
  },
  'ch-go': () => {
    const R = ui.ch; if (!R || R.phase !== 'ready' || R.count) return;
    R.count = 3; render();
    const t = setInterval(() => {
      if (ui.ch !== R) { clearInterval(t); return; }
      R.count--;
      if (R.count > 0) { gBuzz(); render(); return; }
      clearInterval(t);
      Object.assign(R, { phase: 'play', end: Date.now() + CH_SECS * 1000 }); chArmed = true;
      window.addEventListener('deviceorientation', chOrient);
      clearInterval(chTick); chTick = setInterval(() => { if (ui.ch !== R) { clearInterval(chTick); return; } if (Date.now() >= R.end) chEnd(); else if (currentRoute().name === 'charades') { const el = document.querySelector('.ch-time'); if (el) el.textContent = Math.ceil((R.end - Date.now()) / 1000); } }, 250);
      render();
    }, 800);
  },
  'ch-mark': (el) => chMark(el.dataset.k),
  'ch-flip': () => { ui.chFlip = !ui.chFlip; render(); },
  'ch-again': () => { const R = ui.ch; const i = state.members.findIndex((m) => m.id === R.who); ui.chWho = state.members[(i + 1) % state.members.length]?.id; ui.ch = null; render(); },
  'ch-quit': () => { clearInterval(chTick); window.removeEventListener('deviceorientation', chOrient); ui.ch = null; render(); },
  'qz-pick': (el) => {
    const g = findIn(state.games, el.dataset.id), who = g && mpActor(g), key = g.id + ':' + el.dataset.i;
    if (!who) return;
    const ms = Date.now() - (ui.qzAt?.[key] || Date.now());
    mpDo(g, who, `a:${el.dataset.i}:${el.dataset.k}:${ms}`);
  },
  'qz-next': (el) => { (ui.qzSeen ||= {})[el.dataset.id] = Number(el.dataset.i); render(); },
  'qz-skip': (el) => {
    const g = findIn(state.games, el.dataset.id), i = Number(el.dataset.i);
    if (!g || qzCur(g) !== i) return;
    // anyone who didn't answer gets "too slow" for this question
    for (const x of g.p) if (!(g.ans[x] && i in g.ans[x])) g.ans = { ...g.ans, [x]: { ...(g.ans[x] || {}), [i]: [-1, QZ_MS] } };
    g.lastAt = Date.now(); mpFinish(g); save(); render(); mpBotSoon(g);
  },
  'qz-tv': (el) => { ui.mpTv = ui.mpTv === el.dataset.id ? null : el.dataset.id; render(); },
});
// Clue box
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit="imp-clue"]');
  if (!form) return;
  e.preventDefault(); e.stopPropagation();
  const g = findIn(state.games, form.dataset.id), who = g && mpActor(g), c = form.elements.clue.value.trim();
  if (!who || !c) return;
  if (c.toLowerCase() === g.word.toLowerCase()) { toast('That’s the secret word! 🙊'); return; }
  mpDo(g, who, 'clue:' + c);
}, true);
// The quiz timer: when it runs out on your phone, you're "too slow" for that question
const _afterRenderParty = afterRender;
afterRender = function () {
  _afterRenderParty();
  const { name, param } = currentRoute();
  if (name === 'charades') document.body.classList.toggle('ch-on', !!ui.ch && ['ready', 'play'].includes(ui.ch.phase));
  else { document.body.classList.remove('ch-on'); if (ui.ch && ui.ch.phase !== 'done') { clearInterval(chTick); window.removeEventListener('deviceorientation', chOrient); ui.ch = null; } }
  if (name !== 'mp') return;
  const t = document.querySelector('[data-qz]');
  if (!t) return;
  const key = t.dataset.qz, at = ui.qzAt?.[key] || Date.now(), [gid, qi] = key.split(':');
  clearTimeout(ui.qzT);
  ui.qzT = setTimeout(() => {
    const g = state.games.find((x) => x.id === gid), who = g && mpActor(g);
    if (g && who && qzCur(g) === Number(qi) && currentRoute().param === gid) mpDo(g, who, `a:${qi}:-1:${QZ_MS}`);
  }, Math.max(0, at + QZ_MS - Date.now()));
};
// TV view toggle for a player's own screen + new games in the Game Center and on Play
const _quizView = GX.quiz.view;
GX.quiz.view = function (g, who, st) { return _quizView.call(this, g, who, st) + (st.over ? '' : `<div class="btn-row"><button class="btn secondary qz-tvbtn" data-action="qz-tv" data-id="${g.id}">📺 Use this screen as the TV</button></div>`); };
ARCADE.push('quiz', 'imposter');
const _arcadeTilesParty = arcadeTiles, _arcadeLaunchParty = arcadeLaunch;
arcadeTiles = function () { return _arcadeTilesParty() + `<button class="game-tile" data-action="go" data-to="charades" style="--g1:#f59e0b;--g2:#ef4444"><span class="gt-e">🤳</span><b>Forehead Charades</b><small>Tilt the phone, act it out</small></button>`; };
arcadeLaunch = function () { return [..._arcadeLaunchParty(), { to: 'charades', e: '🤳', label: 'Charades', sub: 'Act it out', color: '#f59e0b' }]; };
// Imposter played around one phone: say the clues out loud
const _mpStartParty = actions['mp-start'];
actions['mp-start'] = (el) => {
  if (el.dataset.t === 'imposter' && el.dataset.mode === 'local') {
    const s = [...(ui.mpSel || [])];
    if (s.length + 1 < 3) { toast('Who’s the Imposter? needs at least 3 players'); return; }
    closeSheet(); ui.mpSel = null;
    const players = [actor() || state.members[0]?.id, ...s];
    setTimeout(() => {
      const g = { id: uid(), type: 'imposter', p: players, mode: 'local', host: actor(), at: Date.now(), ...GX.imposter.init(players, { loud: true }) };
      state.games.push(g); save(); go('mp/' + g.id);
    });
    return;
  }
  _mpStartParty(el);
};
KID_ROUTES.push('charades');
for (const a of ['ch-who', 'ch-start', 'ch-go', 'ch-mark', 'ch-flip', 'ch-again', 'ch-quit', 'qz-pick', 'qz-next', 'qz-skip', 'qz-tv']) KID_ACTIONS.add(a);
if (typeof PG_SKIP !== 'undefined') PG_SKIP.add('charades');
if (typeof HUB_OF !== 'undefined') HUB_OF.charades = 'play';
