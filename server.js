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
  {
    text: "Bij wie klop je aan als er een creatieve oplossing bedacht moet worden?",
    emoji: "💡",
  },
  {
    text: "Ik heb een moeilijke stakeholder. Bij wie vraag ik advies?",
    emoji: "🤝",
  },
  {
    text: "Wie motiveert jou het meest als de sprint zwaar is?",
    emoji: "🔥",
  },
  {
    text: "Bij wie kun je terecht als je technisch vastzit?",
    emoji: "🛠️",
  },
  {
    text: "Wie zorgt ervoor dat de sfeer goed blijft in het team?",
    emoji: "😄",
  },
  {
    text: "Bij wie vraag je feedback als je iets wilt verbeteren?",
    emoji: "💬",
  },
  {
    text: "Wie neemt het voortouw als er snel een beslissing gemaakt moet worden?",
    emoji: "⚡",
  },
  {
    text: "Bij wie ga je als je een goed idee wilt uitwerken?",
    emoji: "🚀",
  },
];

let gameState = {
  currentQuestion: 0,
  phase: 'waiting', // 'waiting' | 'voting' | 'revealed' | 'finished'
  votes: {},
  votedIds: new Set(),
};

function getPublicState() {
  return {
    currentQuestion: gameState.currentQuestion,
    question: QUESTIONS[gameState.currentQuestion],
    phase: gameState.phase,
    votes: gameState.votes,
    totalVotes: Object.values(gameState.votes).reduce((a, b) => a + b, 0),
    totalQuestions: QUESTIONS.length,
    teamMembers: TEAM_MEMBERS,
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
