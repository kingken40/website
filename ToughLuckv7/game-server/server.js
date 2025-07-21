const express = require('express');
const cors = require('cors'); // Import the cors package

const app = express();
const PORT = 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.static('public')); // Serve static files from the 'public' directory

// Route for root path - serve the main game page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/templates/UserGUI.html'));
});

// Routes for all game pages
app.get('/UserGUI.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/templates/UserGUI.html'));
});

app.get('/UserStart.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/templates/UserStart.html'));
});

app.get('/UserGameplay.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/templates/UserGameplay.html'));
});

app.get('/UserResults.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/templates/UserResults.html'));
});

// Game state variables - should be stored per session in a real app
let gameStates = {}; // Store game states by session ID (simplified version)

// Function to generate a random path
function generatePath(length, allowDuplicates) {
    const path = [];
    const availableNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    for (let i = 0; i < length; i++) {
        if (allowDuplicates || availableNumbers.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableNumbers.length);
            const selectedNumber = availableNumbers[randomIndex];
            path.push(selectedNumber);
            
            // If duplicates not allowed, remove the selected number
            if (!allowDuplicates) {
                availableNumbers.splice(randomIndex, 1);
            }
        } else {
            // If no duplicates allowed and we've run out of numbers, break
            break;
        }
    }
    
    return path;
}

// Function to get points per correct move based on difficulty
function getPointsForDifficulty(difficulty) {
    switch (difficulty) {
        case 'easy': return 2;
        case 'medium': return 3;
        case 'hard': return 5;
        default: return 2;
    }
}

// Function to get max attempts based on difficulty
function getMaxAttempts(difficulty) {
    switch (difficulty) {
        case 'easy': return 3;
        case 'medium': return 2;
        case 'hard': return 1;
        default: return 3;
    }
}

// Endpoint to handle game moves
app.post('/start', (req, res) => {
    const { move, difficulty, totalMoves, allowDuplicates, currentPosition, attemptsForCurrentPosition, gameStarted } = req.body;
    
    // Use a simple session ID (in a real app, you'd use proper session management)
    const sessionId = 'default'; // For this simple implementation
    
    // Initialize game state if not exists or if it's a new game
    if (!gameStates[sessionId] || !gameStarted) {
        gameStates[sessionId] = {
            pathList: generatePath(totalMoves, allowDuplicates),
            difficulty: difficulty,
            totalMoves: totalMoves,
            score: 0,
            maxAttempts: getMaxAttempts(difficulty),
            pointsPerCorrect: getPointsForDifficulty(difficulty),
            gameStarted: true
        };
        
        console.log('New game started. Path:', gameStates[sessionId].pathList);
    }
    
    const gameState = gameStates[sessionId];
    const correctMove = gameState.pathList[currentPosition - 1];
    
    console.log(`Position ${currentPosition}: User guessed ${move}, correct answer is ${correctMove}`);
    
    // Check if the player's move is correct
    if (parseInt(move) === correctMove) {
        // Correct move - award full points
        gameState.score += gameState.pointsPerCorrect;
        
        console.log(`Correct! Score increased to ${gameState.score}`);
        
        return res.json({
            Points: gameState.score,
            Message: 'Correct! Moving to next position.',
            MoveToNext: true,
            Win: currentPosition >= totalMoves,
            pathList: gameState.pathList
        });
    } else {
        // Wrong move - deduct 1 point
        gameState.score = Math.max(0, gameState.score - 1);
        
        console.log(`Wrong! Score decreased to ${gameState.score}. Attempts: ${attemptsForCurrentPosition}/${gameState.maxAttempts}`);
        
        if (attemptsForCurrentPosition >= gameState.maxAttempts) {
            // No more attempts
            if (difficulty === 'easy') {
                // Easy mode: automatically move to next position
                return res.json({
                    Points: gameState.score,
                    Message: `Out of attempts! The correct answer was ${correctMove}. Moving to next position.`,
                    MoveToNext: true,
                    Win: currentPosition >= totalMoves,
                    pathList: gameState.pathList
                });
            } else {
                // Medium/Hard mode: game over
                return res.json({
                    Points: gameState.score,
                    Message: `Game Over! The correct answer was ${correctMove}.`,
                    MoveToNext: false,
                    GameOver: true,
                    Win: false,
                    pathList: gameState.pathList
                });
            }
        } else {
            // Still have attempts left
            const attemptsLeft = gameState.maxAttempts - attemptsForCurrentPosition;
            return res.json({
                Points: gameState.score,
                Message: `Wrong! You have ${attemptsLeft} attempt(s) left.`,
                MoveToNext: false,
                Win: false,
                pathList: gameState.pathList
            });
        }
    }
});

// Endpoint to reset game (optional)
app.post('/reset', (req, res) => {
    const sessionId = 'default';
    delete gameStates[sessionId];
    res.json({ Message: 'Game reset successfully' });
});

// Endpoint to get current game state (optional, for debugging)
app.get('/gamestate', (req, res) => {
    const sessionId = 'default';
    res.json(gameStates[sessionId] || { Message: 'No active game' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});