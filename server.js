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
  { text: "Bij wie klop je aan als er een creatieve oplossing bedacht moet worden?", emoji: "💡", label: "Creatieve oplossingen" },
  { text: "Ik heb een moeilijke stakeholder. Bij wie vraag ik advies?", emoji: "🤝", label: "Stakeholder management" },
  { text: "Wie motiveert jou het meest als de sprint zwaar is?", emoji: "🔥", label: "Teammotivatie" },
  { text: "Bij wie kun je terecht als je technisch vastzit?", emoji: "🛠️", label: "Technische hulp" },
  { text: "Wie zorgt ervoor dat de sfeer goed blijft in het team?", emoji: "😄", label: "Teamspirit" },
  { text: "Bij wie vraag je feedback als je iets wilt verbeteren?", emoji: "💬", label: "Feedback geven" },
  { text: "Wie neemt het voortouw als er snel een beslissing gemaakt moet worden?", emoji: "⚡", label: "Besluitvaardigheid" },
  { text: "Bij wie ga je als je een goed idee wilt uitwerken?", emoji: "🚀", label: "Ideeën uitwerken" },
  { text: "Wie is de beste luisteraar als je even wil ventileren?", emoji: "👂", label: "Luisteren & empathie" },
  { text: "Bij wie ga je als je iets nieuws wilt leren?", emoji: "📚", label: "Kennis delen" },
  { text: "Wie houdt het overzicht als alles tegelijkertijd speelt?", emoji: "🗺️", label: "Overzicht bewaren" },
  { text: "Bij wie kun je terecht als je een lastig dilemma hebt?", emoji: "🫂", label: "Klankbord" },
  { text: "Wie zorgt ervoor dat afspraken worden nagekomen?", emoji: "✅", label: "Betrouwbaarheid" },
  { text: "Bij wie ga je als je vastloopt op een vervelende bug?", emoji: "🐛", label: "Debugging" },
  { text: "Wie is de beste brug tussen techniek en de business?", emoji: "🌉", label: "Techniek & business" },
  { text: "Bij wie ga je als je wil brainstormen over een aanpak?", emoji: "🧠", label: "Brainstormen" },
  { text: "Wie brengt altijd energie mee naar een vergadering?", emoji: "✨", label: "Energie & positiviteit" },
  { text: "Bij wie ga je als je niet weet waar je moet beginnen?", emoji: "🧭", label: "Richting geven" },
  { text: "Wie is jouw meest betrouwbare sparringpartner?", emoji: "🛡️", label: "Sparringpartner" },
  { text: "Wie zou jij als mentor willen kiezen binnen het team?", emoji: "🎓", label: "Mentorschap" },
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
