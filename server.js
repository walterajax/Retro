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

const TEAM_MEMBERS = ['Myrthe', 'Melanie', 'Joëlle', 'Maarten', 'Walter', 'Lara'];

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
    teamMembers: TEAM_MEMBERS,
    allResults,
  };
}

io.on('connection', (socket) => {
  socket.emit('state', getPublicState());

  socket.on('vote', ({ voterId, memberName }) => {
    if (gameState.phase !== 'voting') return;
    if (gameState.votedIds.has(voterId)) return;
    if (!TEAM_MEMBERS.includes(memberName)) return;

    gameState.votedIds.add(voterId);
    gameState.votes[memberName] = (gameState.votes[memberName] || 0) + 1;
    io.emit('state', getPublicState());
  });

  socket.on('host-start', () => {
    allResults = [];
    gameState.currentQuestion = 0;
    gameState.phase = 'voting';
    gameState.votes = {};
    gameState.votedIds = new Set();
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
    } else {
      gameState.phase = 'finished';
    }
    io.emit('state', getPublicState());
  });

  socket.on('host-restart', () => {
    allResults = [];
    gameState.currentQuestion = 0;
    gameState.phase = 'waiting';
    gameState.votes = {};
    gameState.votedIds = new Set();
    io.emit('state', getPublicState());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🛒 AH Retro Quiz draait op http://localhost:${PORT}`);
  console.log(`📺 Host scherm: http://localhost:${PORT}/host.html`);
  console.log(`📱 Stemmen:     http://localhost:${PORT}/vote.html\n`);
});
