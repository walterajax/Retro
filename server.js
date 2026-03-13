const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let registeredVoters = {}; // { voterId: name }

function getMemberList() {
  const seen = new Set();
  const result = [];
  for (const name of Object.values(registeredVoters)) {
    if (!seen.has(name)) { seen.add(name); result.push(name); }
  }
  return result;
}

const QUESTIONS = [
  { text: "Wie heeft het beste gevoel voor tone of voice?", emoji: "✍️", label: "Tone of voice" },
  { text: "Bij wie klop je aan als je een creatief idee wilt aanscherpen?", emoji: "💡", label: "Creatieve sparring" },
  { text: "Wie prikkelt jou het meest om out-of-the-box te denken?", emoji: "🧩", label: "Out-of-the-box denken" },
  { text: "Wie denkt het meest strategisch over employer branding?", emoji: "🎯", label: "EB-strategie" },
  { text: "Wie weet het beste hoe je een campagne van A tot Z uitrolt?", emoji: "📣", label: "Campagnemanagement" },
  { text: "Wie weet precies wat er wel en niet werkt op Instagram?", emoji: "📸", label: "Instagram" },
  { text: "Bij wie klop je aan voor advies over social media strategie?", emoji: "📱", label: "Social media strategie" },
  { text: "Wie heeft het scherpste oog voor wat ons onderscheidt als werkgever?", emoji: "🏷️", label: "Werkgeversmerk" },
  { text: "Wie weet het beste hoe je draagvlak creëert voor een nieuw idee?", emoji: "🤝", label: "Draagvlak creëren" },
  { text: "Ik heb een lastige hiring manager. Bij wie vraag ik advies?", emoji: "💼", label: "Stakeholder management" },
  { text: "Bij wie klop je aan als je een dashboard of rapportage wilt begrijpen?", emoji: "📊", label: "Data & rapportages" },
  { text: "Wie weet precies welke KPI's er écht toe doen?", emoji: "📈", label: "KPI's & doelen" },
  { text: "Wie heeft het sterkste gevoel voor wat er visueel goed uitziet?", emoji: "🎨", label: "Visueel gevoel" },
  { text: "Wie weet precies hoe je een boodschap visueel krachtig maakt?", emoji: "🖼️", label: "Visuele communicatie" },
  { text: "Wie weet als geen ander hoe je een droog onderwerp interessant maakt in een presentatie?", emoji: "🗣️", label: "Presentatietalent" },
  { text: "Wie brengt altijd energie mee, ook op een maandagochtend?", emoji: "✨", label: "Energie" },
  { text: "Wie motiveert jou het meest tijdens een zware sprint?", emoji: "🔥", label: "Motivatie" },
  { text: "Wie geeft feedback op een manier waar je echt iets mee kunt?", emoji: "💬", label: "Feedback geven" },
  { text: "Wie is het beste in prioriteiten stellen als de agenda overloopt?", emoji: "⚡", label: "Prioriteiten stellen" },
  { text: "Wie deelt het meest proactief nieuwe kennis of interessante artikelen?", emoji: "📚", label: "Kennis delen" },
  { text: "Wie zou jij als mentor willen kiezen binnen het team?", emoji: "🎓", label: "Mentorschap" },
  { text: "Wie stelt altijd de juiste vragen om een opdracht scherp te krijgen?", emoji: "🔍", label: "Scherpte & focus" },
  { text: "Wie is degene bij wie je altijd eerlijk kunt zijn?", emoji: "🛡️", label: "Vertrouwen" },
  { text: "Als er een nieuwe collega start, wie zorgt dan dat hij of zij zich meteen thuis voelt?", emoji: "🏠", label: "Onboarding & welkom" },
  { text: "Als dit team een reclamespot zou maken voor zichzelf, wie schrijft dan de tagline?", emoji: "🌟", label: "Storytelling" },
  { text: "Wie verdient een schouderklopje dat ze misschien nog niet genoeg hebben gekregen?", emoji: "🫶", label: "Waardering" },
];

let allResults = [];

let gameState = {
  currentQuestion: 0,
  phase: 'waiting',
  votes: {},
  votedIds: new Set(),
  comments: [],
  moodVotes: {},
  retroInputs: [],
};

function saveCurrentQuestionResult() {
  const votes = gameState.votes;
  const maxVotes = Math.max(...Object.values(votes), 0);
  if (maxVotes === 0) return;
  const winners = Object.keys(votes).filter(k => votes[k] === maxVotes);
  allResults.push({
    question: QUESTIONS[gameState.currentQuestion],
    winners,
    votes: { ...votes },
  });
}

function getPublicState() {
  return {
    currentQuestion: gameState.currentQuestion,
    question: QUESTIONS[gameState.currentQuestion],
    phase: gameState.phase,
    votes: gameState.votes,
    totalVotes: Object.values(gameState.votes).reduce((a, b) => a + b, 0),
    totalQuestions: QUESTIONS.length,
    teamMembers: getMemberList(),
    votedCount: gameState.votedIds.size,
    totalVoters: getMemberList().length,
    allResults,
    comments: gameState.comments,
    moodCount: Object.keys(gameState.moodVotes).length,
    moodAvg: (() => {
      const vals = Object.values(gameState.moodVotes);
      return vals.length > 0 ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length * 10) / 10 : null;
    })(),
    moodDist: [1,2,3,4,5].map(r => Object.values(gameState.moodVotes).filter(v => v === r).length),
    retroInputs: gameState.retroInputs,
  };
}

io.on('connection', (socket) => {
  socket.emit('state', getPublicState());

  socket.on('register', ({ voterId, name }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    registeredVoters[voterId] = trimmed;
    io.emit('state', getPublicState());
  });

  socket.on('vote', ({ voterId, distribution }) => {
    if (gameState.phase !== 'voting') return;
    if (gameState.votedIds.has(voterId)) return;

    const myName = registeredVoters[voterId];
    const members = getMemberList();
    let total = 0;

    for (const [name, points] of Object.entries(distribution)) {
      if (name === myName) return;           // geen punten op jezelf
      if (!members.includes(name)) return;   // onbekend lid
      if (typeof points !== 'number' || points < 0 || !Number.isInteger(points)) return;
      total += points;
    }
    if (total === 0) return;

    gameState.votedIds.add(voterId);
    for (const [name, points] of Object.entries(distribution)) {
      if (points > 0) {
        gameState.votes[name] = (gameState.votes[name] || 0) + points;
      }
    }
    if (members.length > 0 && gameState.votedIds.size >= members.length) {
      io.emit('all-voted');
    }
    io.emit('state', getPublicState());
  });

  socket.on('comment', ({ text }) => {
    if (gameState.phase !== 'voting') return;
    const trimmed = (text || '').trim().slice(0, 200);
    if (!trimmed) return;
    gameState.comments.push(trimmed);
    io.emit('state', getPublicState());
  });

  socket.on('react', ({ emoji }) => {
    const allowed = ['👏', '🔥', '😂', '🎉', '❤️'];
    if (!allowed.includes(emoji)) return;
    io.emit('reaction', { emoji });
  });

  socket.on('host-start', () => {
    allResults = [];
    gameState.currentQuestion = 0;
    gameState.phase = 'mood';
    gameState.moodVotes = {};
    gameState.votes = {};
    gameState.votedIds = new Set();
    gameState.comments = [];
    gameState.retroInputs = [];
    io.emit('state', getPublicState());
  });

  socket.on('mood-vote', ({ voterId, rating }) => {
    if (gameState.phase !== 'mood') return;
    if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) return;
    gameState.moodVotes[voterId] = rating;
    io.emit('state', getPublicState());
  });

  socket.on('host-start-retro', () => {
    if (gameState.phase !== 'mood') return;
    gameState.phase = 'retro';
    io.emit('state', getPublicState());
  });

  socket.on('retro-input', ({ type, text }) => {
    if (gameState.phase !== 'retro') return;
    if (type !== 'good' && type !== 'better') return;
    const trimmed = (text || '').trim().slice(0, 200);
    if (!trimmed) return;
    gameState.retroInputs.push({ type, text: trimmed });
    io.emit('state', getPublicState());
  });

  socket.on('host-start-review', () => {
    if (gameState.phase !== 'retro') return;
    gameState.phase = 'retro-review';
    io.emit('state', getPublicState());
  });

  socket.on('host-start-quiz', () => {
    if (gameState.phase !== 'retro-review') return;
    gameState.phase = 'voting';
    io.emit('state', getPublicState());
  });

  socket.on('host-reveal', () => {
    if (gameState.phase !== 'voting') return;
    gameState.phase = 'revealed';
    io.emit('state', getPublicState());
  });

  socket.on('host-next', () => {
    if (gameState.phase !== 'revealed') return;
    saveCurrentQuestionResult();
    if (gameState.currentQuestion < QUESTIONS.length - 1) {
      gameState.currentQuestion++;
      gameState.phase = 'voting';
      gameState.votes = {};
      gameState.votedIds = new Set();
      gameState.comments = [];
    } else {
      gameState.phase = 'finished';
    }
    io.emit('state', getPublicState());
  });

  socket.on('host-restart', () => {
    allResults = [];
    registeredVoters = {};
    gameState.currentQuestion = 0;
    gameState.phase = 'waiting';
    gameState.votes = {};
    gameState.votedIds = new Set();
    gameState.comments = [];
    gameState.moodVotes = {};
    gameState.retroInputs = [];
    io.emit('state', getPublicState());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🛒 AH Retro Quiz draait op http://localhost:${PORT}`);
  console.log(`📺 Host scherm: http://localhost:${PORT}/host.html`);
  console.log(`📱 Stemmen:     http://localhost:${PORT}/vote.html\n`);
});
