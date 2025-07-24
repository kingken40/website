import sys
import timeit
import random
from ToughLuckResults import results, hardResults
from flask import jsonify  # Import jsonify for returning JSON responses

def start(moves, mode, path_list, current_position, move, points, missed, chances, dupp, attempts_for_current_position):
    if mode in ['endless', 'easy']:
        max_chances = 3
        points_per_correct_move = 2
    elif mode in ['level1', 'medium']:
        max_chances = 3
        points_per_correct_move = 3
    elif mode in ['level2', 'hard']:
        max_chances = 1
        points_per_correct_move = 5
    else:
        max_chances = 3
        points_per_correct_move = 2

    if not path_list or len(path_list) != moves:
        if dupp == 1:
            path_list = [random.randint(0, 9) for _ in range(moves)]
        else:
            path_list = random.sample(range(0, 10), moves)

    correct_value = path_list[current_position - 1]
    message = ""
    move_to_next = False
    game_over = False
    win = False

    # Ensure points never go below 0
    points = max(points, 0)
    chances = max(chances, 0)
    attempts_for_current_position = max(attempts_for_current_position, 0)

    if move == correct_value:
        points += points_per_correct_move
        message = "Good Move!"
        move_to_next = True
        attempts_for_current_position = 0
        current_position += 1
        if current_position > moves:
            win = True
    else:
        missed += 1
        attempts_for_current_position += 1
        
        # Handle different game modes
        if mode in ['endless', 'easy']:
            # Endless mode: never end the game, just continue
            chances -= 1  # Still track for consistency but don't use for game ending
            message = "Wrong! Try again."
        elif mode in ['level1', 'medium', 'level2', 'hard']:
            chances -= 1
            if attempts_for_current_position >= max_chances:
                message = "Game Over"
                game_over = True
                chances = 0
                attempts_for_current_position = max_chances
            else:
                # Game continues - show appropriate message
                remaining = max_chances - attempts_for_current_position
                if mode in ['level1', 'medium']:
                    if remaining == 1:
                        message = "Wrong! Last chance."
                    else:
                        message = f"Wrong! Try again. Attempts left: {remaining}"
                elif mode in ['level2', 'hard']:
                    message = "Wrong! Try again. Attempts left: {remaining}"

    # Endless mode: never end the game, always allow more attempts
    # No autofill needed - just let them keep trying

    return {
        'Points': points,
        'CurrentPosition': current_position,
        'Message': message,
        'Win': win,
        'GameOver': game_over,
        'MoveToNext': move_to_next,
        'pathList': path_list,
        'Missed': missed,
        'Chances': chances,
        'AttemptsForCurrentPosition': attempts_for_current_position
    }

def get_results(path_list, user_moves, points, missed, moves, dif, time_elapsed):
    # Calculate total available points
    if dif in ['e', 'E']:
        points_per_correct_move = 2
    elif dif in ['m', 'M']:
        points_per_correct_move = 3
    elif dif in ['h', 'H']:
        points_per_correct_move = 5
    else:
        points_per_correct_move = 2

    total_available_points = len(path_list) * points_per_correct_move

    # Dynamic result message and color
    if points == 0:
        result_message = "Tough Luck..."
        result_color = "red"
    elif points == total_available_points:
        result_message = "Perfect Game!"
        result_color = "green"
    else:
        result_message = "Good Try!"
        result_color = "orange"

    return {
        "PathList": path_list,
        "PathListLength": len(path_list),
        "UserMoves": user_moves,
        "TotalPoints": points,
        "MissedMoves": missed,
        "TotalMoves": moves,
        "TotalAvailablePoints": total_available_points,
        "TimeElapsed": time_elapsed,
        "ResultMessage": result_message,
        "ResultColor": result_color
    }
