import sys
import timeit
import random
from ToughLuckResults import results, hardResults
from flask import jsonify  # Import jsonify for returning JSON responses

def generate_path(moves, allow_duplicates):
    """Generate a list of moves for the game."""
    if allow_duplicates:
        return [random.randint(0, 9) for _ in range(moves)]
    else:
        return random.sample(range(0, 10), moves)

def start(moves, endless_mode=False, dupp=1):
    # Set initial chances and points based on difficulty
    if dif in ['e', 'E']:
        chances = 3
        points_per_correct_move = 2
    elif dif in ['m', 'M']:
        chances = 2
        points_per_correct_move = 3
    elif dif in ['h', 'H']:
        chances = 1
        points_per_correct_move = 5

    # Generate the path for the game
    path_list = generate_path(moves, dupp == 1)

    # User list, number of points, and number of missed spots
    L = []
    points = 0
    missed = 0
    print("Lets Begin! Good Luck!")

    # Game Timer start
    timer = timeit.default_timer()

    # GAME
    for i in path_list:
        easycnt = 0
        mediumcnt = 0
        
        # Display Path to console
        print("\nPath: ", path_list)

        # SHOWING TIME ELAPSED AFTER EVERY MOVE
        stop = timeit.default_timer()
        execute = stop - timer
        gametime = round(execute, 2)

        minutes, seconds = divmod(gametime, 60)
        minutes = int(minutes)
        seconds = int(seconds)

        print("Points: ", points)
        print("Time Elapsed: {}:{}".format(minutes, seconds))
        print("Current Position: ", path_list.index(i) + 1, "of", len(path_list))
        print("Which way???")

        new_inp = int(input())
        L.append(new_inp)

        # POINTS AWARDED
        if new_inp == i:
            points += points_per_correct_move  # Adjust points based on your scoring system
            print("Good Move!")
            current_position = path_list.index(i) + 1  # Update current position
            return jsonify({
                'Points': points,
                'CurrentPosition': current_position,
                'Message': "Good Move!",
                'Win': current_position >= moves  # Check if the game is won
            })

        # If Endless Mode is enabled, always move to the next position
        if endless_mode:
            continue

        # If move isn't correct
        while new_inp != i:
            missed += 1  # Increment missed moves for every incorrect attempt
            print(f"Missed Moves: {missed}")  # Display missed moves after each incorrect attempt
            chances -= 1  # Decrement chances
            points -= 1  # Subtract points for wrong moves
            if chances < 0:
                print("No chances left. Game over.")
                break  # End the game if no chances are left
            if dupp == 1:  # Easy
                easycnt += 1
                if easycnt == 1:
                    print("Wrong Way! Try again.")
                    new_inp = int(input())
                    L.append(new_inp)
                    if new_inp == i:
                        print("Good Move!")
                        current_position = path_list.index(i) + 1
                        return jsonify({
                            'Points': points,
                            'CurrentPosition': current_position,
                            'Message': "Good Move!",
                            'Win': current_position >= moves
                        })
                elif easycnt == 2:
                    print("Wrong Way Again! Last try on this spot.")
                    new_inp = int(input())
                    L.append(new_inp)
                    if new_inp == i:
                        print("Good Move!")
                        current_position = path_list.index(i) + 1
                        return jsonify({
                            'Points': points,
                            'CurrentPosition': current_position,
                            'Message': "Good Move!",
                            'Win': current_position >= moves
                        })
                elif easycnt == 3:
                    print("Too many tries. Correct number is: ", i)
                    break

            elif dupp == 2:  # Medium
                mediumcnt += 1
                if mediumcnt == 1:
                    print("Wrong Way! Last chance on this spot")
                    new_inp = int(input())
                    L.append(new_inp)
                    if new_inp == i:
                        print("Good Move!")
                        current_position = path_list.index(i) + 1
                        return jsonify({
                            'Points': points,
                            'CurrentPosition': current_position,
                            'Message': "Good Move!",
                            'Win': current_position >= moves
                        })
                elif mediumcnt == 2:
                    print("Too many tries. Correct number is: ", i)
                    break

            elif dupp == 3:  # Hard
                print("Wrong Way! You have no more chances.")
                hardResults(dif, path_list, missed, L, points, execute)
                return jsonify({'Points': points, 'CurrentPosition': current_position, 'Message': "Game Over", 'Win': False})

    # FINISHED! DISPLAYING GAME RESULTS
    stop = timeit.default_timer()
    execute = stop - timer
    print()
    results("Endless", path_list, missed, L, points, execute)
