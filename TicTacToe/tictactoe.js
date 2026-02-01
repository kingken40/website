let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let playerSymbol = '';
let aiSymbol = '';
let gameActive = false;
let difficulty = 'hard';
let scores = {
    player: 0,
    ai: 0,
    draw: 0
};

const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

const cells = document.querySelectorAll('.cell');
const statusDisplay = document.getElementById('status');
const playerScoreDisplay = document.getElementById('playerScore');
const aiScoreDisplay = document.getElementById('aiScore');
const drawScoreDisplay = document.getElementById('drawScore');

cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
});

function chooseSide(side) {
    playerSymbol = side;
    aiSymbol = side === 'X' ? 'O' : 'X';
    currentPlayer = 'X';
    gameActive = true;
    
    document.getElementById('sideSelection').style.display = 'none';
    document.getElementById('difficultySelection').style.display = 'block';
    
    updateStatus();
    
    if (aiSymbol === 'X') {
        setTimeout(aiMove, 500);
    }
}

function changeDifficulty() {
    difficulty = document.getElementById('difficulty').value;
    if (gameActive && board.every(cell => cell === '')) {
        resetGame();
    }
}

function handleCellClick(event) {
    const clickedCell = event.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

    if (board[clickedCellIndex] !== '' || !gameActive || currentPlayer !== playerSymbol) {
        return;
    }

    board[clickedCellIndex] = playerSymbol;
    updateCell(clickedCell, playerSymbol);
    
    if (checkWin(playerSymbol)) {
        endGame('win');
        return;
    }
    
    if (checkDraw()) {
        endGame('draw');
        return;
    }
    
    currentPlayer = aiSymbol;
    updateStatus();
    
    setTimeout(aiMove, 300);
}

function aiMove() {
    if (!gameActive) return;
    
    let move;
    
    if (difficulty === 'easy') {
        move = getRandomMove();
    } else if (difficulty === 'medium') {
        move = Math.random() < 0.5 ? getBestMove() : getRandomMove();
    } else {
        move = getBestMove();
    }
    
    board[move] = aiSymbol;
    const cell = document.querySelector(`[data-index="${move}"]`);
    updateCell(cell, aiSymbol);
    
    if (checkWin(aiSymbol)) {
        endGame('lose');
        return;
    }
    
    if (checkDraw()) {
        endGame('draw');
        return;
    }
    
    currentPlayer = playerSymbol;
    updateStatus();
}

function getRandomMove() {
    const availableMoves = board.reduce((acc, cell, index) => {
        if (cell === '') acc.push(index);
        return acc;
    }, []);
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

function getBestMove() {
    let bestScore = -Infinity;
    let bestMove = 0;
    
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = aiSymbol;
            let score = minimax(board, 0, false);
            board[i] = '';
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    
    return bestMove;
}

function minimax(board, depth, isMaximizing) {
    if (checkWin(aiSymbol)) {
        return 10 - depth;
    }
    if (checkWin(playerSymbol)) {
        return depth - 10;
    }
    if (checkDraw()) {
        return 0;
    }
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = aiSymbol;
                let score = minimax(board, depth + 1, false);
                board[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = playerSymbol;
                let score = minimax(board, depth + 1, true);
                board[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function checkWin(player) {
    return winningConditions.some(condition => {
        return condition.every(index => board[index] === player);
    });
}

function checkDraw() {
    return board.every(cell => cell !== '');
}

function updateCell(cell, symbol) {
    cell.textContent = symbol;
    cell.classList.add('taken');
    cell.classList.add(symbol.toLowerCase());
}

function updateStatus() {
    if (!gameActive) {
        statusDisplay.textContent = 'Choose your side to start';
    } else if (currentPlayer === playerSymbol) {
        statusDisplay.textContent = 'Your turn';
    } else {
        statusDisplay.textContent = 'AI is thinking...';
    }
}

function endGame(result) {
    gameActive = false;
    
    if (result === 'win') {
        statusDisplay.textContent = '🎉 You Won!';
        scores.player++;
        playerScoreDisplay.textContent = scores.player;
        highlightWinningCells(playerSymbol);
    } else if (result === 'lose') {
        statusDisplay.textContent = '❌ AI Won!';
        scores.ai++;
        aiScoreDisplay.textContent = scores.ai;
        highlightWinningCells(aiSymbol);
    } else {
        statusDisplay.textContent = '🤝 Draw!';
        scores.draw++;
        drawScoreDisplay.textContent = scores.draw;
    }
}

function highlightWinningCells(player) {
    winningConditions.forEach(condition => {
        if (condition.every(index => board[index] === player)) {
            condition.forEach(index => {
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.add('winner');
            });
        }
    });
}

function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = false;
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('taken', 'x', 'o', 'winner');
    });
    
    document.getElementById('sideSelection').style.display = 'flex';
    document.getElementById('difficultySelection').style.display = 'none';
    
    updateStatus();
}

function resetScores() {
    scores.player = 0;
    scores.ai = 0;
    scores.draw = 0;
    playerScoreDisplay.textContent = 0;
    aiScoreDisplay.textContent = 0;
    drawScoreDisplay.textContent = 0;
    resetGame();
}

function goBack() {
    window.location.href = '../Games.html';
}

updateStatus();
