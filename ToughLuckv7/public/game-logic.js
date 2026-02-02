// ToughLuck Game Logic - JavaScript Version
// Converted from Python backend to client-side JavaScript

class ToughLuckGame {
    constructor() {
        this.pathList = [];
        this.currentPosition = 1;
        this.points = 0;
        this.missed = 0;
        this.chances = 3;
        this.attemptsForCurrentPosition = 0;
        this.mode = 'easy';
        this.totalMoves = 5;
        this.allowDuplicates = true;
        this.maxChances = 3;
        this.pointsPerCorrectMove = 2;
    }

    initialize(moves, mode, allowDuplicates) {
        this.totalMoves = moves;
        this.mode = mode;
        this.allowDuplicates = allowDuplicates;
        this.currentPosition = 1;
        this.points = 0;
        this.missed = 0;
        this.attemptsForCurrentPosition = 0;

        // Set mode-specific values
        if (mode === 'endless' || mode === 'easy') {
            this.maxChances = 3;
            this.pointsPerCorrectMove = 2;
            this.chances = 3;
        } else if (mode === 'level1' || mode === 'medium') {
            this.maxChances = 3;
            this.pointsPerCorrectMove = 3;
            this.chances = 3;
        } else if (mode === 'level2' || mode === 'hard') {
            this.maxChances = 1;
            this.pointsPerCorrectMove = 5;
            this.chances = 1;
        }

        // Generate path list
        if (allowDuplicates) {
            this.pathList = Array.from({ length: moves }, () => Math.floor(Math.random() * 10));
        } else {
            this.pathList = this.shuffleArray([...Array(10).keys()]).slice(0, moves);
        }

        console.log("=== DEBUG: ANSWER KEY ===");
        console.log("Path:", this.pathList.join(" → "));
        console.log("========================");
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    processMove(move) {
        const correctValue = this.pathList[this.currentPosition - 1];
        let message = "";
        let moveToNext = false;
        let gameOver = false;
        let win = false;

        // Ensure values never go below 0
        this.points = Math.max(this.points, 0);
        this.chances = Math.max(this.chances, 0);
        this.attemptsForCurrentPosition = Math.max(this.attemptsForCurrentPosition, 0);

        if (move === correctValue) {
            this.points += this.pointsPerCorrectMove;
            message = "Good Move!";
            moveToNext = true;
            this.attemptsForCurrentPosition = 0;
            this.currentPosition++;
            
            if (this.currentPosition > this.totalMoves) {
                win = true;
            }
        } else {
            this.missed++;
            this.attemptsForCurrentPosition++;

            // Handle different game modes
            if (this.mode === 'endless' || this.mode === 'easy') {
                this.chances--;
                message = "Wrong! Try again.";
            } else if (this.mode === 'level1' || this.mode === 'medium' || this.mode === 'level2' || this.mode === 'hard') {
                this.chances--;
                
                if (this.attemptsForCurrentPosition >= this.maxChances) {
                    message = "Game Over";
                    gameOver = true;
                    this.chances = 0;
                    this.attemptsForCurrentPosition = this.maxChances;
                } else {
                    const remaining = this.maxChances - this.attemptsForCurrentPosition;
                    if (this.mode === 'level1' || this.mode === 'medium') {
                        if (remaining === 1) {
                            message = "Wrong! Last chance.";
                        } else {
                            message = `Wrong! Try again. Attempts left: ${remaining}`;
                        }
                    } else if (this.mode === 'level2' || this.mode === 'hard') {
                        message = `Wrong! Try again. Attempts left: ${remaining}`;
                    }
                }
            }
        }

        return {
            Points: this.points,
            CurrentPosition: this.currentPosition,
            Message: message,
            Win: win,
            GameOver: gameOver,
            MoveToNext: moveToNext,
            pathList: this.pathList,
            MissedPlayerMoves: this.missed,
            Chances: this.chances,
            AttemptsForCurrentPosition: this.attemptsForCurrentPosition
        };
    }

    getResults(userMoves, timeElapsed) {
        const totalAvailablePoints = this.pathList.length * this.pointsPerCorrectMove;

        let resultMessage = "";
        let resultColor = "";

        if (this.points === 0) {
            resultMessage = "Tough Luck...";
            resultColor = "red";
        } else if (this.points === totalAvailablePoints) {
            resultMessage = "Perfect Game!";
            resultColor = "green";
        } else {
            resultMessage = "Good Try!";
            resultColor = "orange";
        }

        return {
            PathList: this.pathList,
            PathListLength: this.pathList.length,
            UserMoves: userMoves,
            TotalPoints: this.points,
            MissedPlayerMoves: this.missed,
            TotalMoves: userMoves.length,
            TotalAvailablePoints: totalAvailablePoints,
            TimeElapsed: timeElapsed,
            ResultMessage: resultMessage,
            ResultColor: resultColor
        };
    }
}

// Export for use in HTML files
if (typeof window !== 'undefined') {
    window.ToughLuckGame = ToughLuckGame;
}
