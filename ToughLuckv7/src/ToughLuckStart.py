import sys
import timeit
import random
#from ToughLuckGameplay import start
import ToughLuckGameplay as TLGP


# Setting up game options
def gameConfig():
    # INTRODUCTION TO GAME
    print("\nWelcome to the Game Tough-Luck!")
    print("\nYou have to make the correct number of moves to have a perfect game! If you're lucky, you'll get all the moves correct!")

    # HOW TO PLAY
    print("\nHow to Play:\n1. Select the number of moves you want there to be. (minimum of 1, maximum of 10)\n2. Select the difficulty level. (e = Easy, m = Medium, h = Hard)\n3. Select whether or not you would like there to be duplicates in your path or not. (The same number may be in your path more than once!)\n4. Only use integers 0-9 when completing your path!\n5. Press Ctrl + C to quit the game anytime (No results will be displayed).\n\nAlright, lets begin!\n")

    # 1. CHOOSE NUMBER OF MOVES 
    print("How many moves would you like there to be?")
    moves = int(input())
    movescnt = 0

    # IF MOVES INPUT < 1
    while moves < 1:
        movescnt +=1
        if movescnt == 1:
            print("There must be at least 1 move, no more than 10.")
        if movescnt == 2:
            print("1 more chance! There must be at least 1 move!")
        if movescnt == 3:
            sys.exit("Exitting game.")
        moves = int(input())

    # IF INPUT > 10
    while moves > 10:
        movescnt +=1
        if movescnt == 1:
            print("There must be at least 1 move, no more than 10.")
        if movescnt == 2:
            print("1 more chance! There must be no more than 10 moves!")
        if movescnt == 3:
            sys.exit("Exitting game.")
        moves = int(input())

    # 2. CHOOSING DIFFICULTY
    print("What level of difficulty would you like?: (Type 'e' for Easy, 'm' for Medium, or 'h' for Hard)")
    print("\n- The Easy difficuly will give you to 3 chances to make the correct move before autofilling what it really is and continuing. 2pts per correct spot.")
    print("- The Medium difficuly will give you to 2 chances to make the correct move before autofilling what it really is and continuing. 3pts per correct spot.")
    print("- The Hard difficulty will quit the game if you make 1 wrong move. 5pts per correct spot.\n")
    print("Each wrong move in Easy and Medium mode will subtract points.\n")
    dif = input()
    difcnt = 0
    while dif != "e" and dif != "E" and dif != "m" and dif != "M" and dif != "h" and dif != "H":
        difcnt+=1
        if difcnt != 3:
            print("Please Enter the Correct Letter!")
            dif = input()
        else: 
            sys.exit("Too many Attempts! Goodbye!!!!")

    if moves > 1:        
        # 3. WANT DUPLICATE NUMBERS?
        print("Would you like for the possibility of duplicates? Press 1 for Yes or 2 for No.")
        dupp = int(input())
        duppcnt = 0
        while dupp != 1 and dupp != 2:
                duppcnt+=1
                if duppcnt != 3:
                    print("Please Enter the correct number. (1 = Yes, 2 = No)")
                    dupp=int(input())
                else:
                    sys.exit("Too many attempts. GoodBye!")
    elif moves == 1:
        dupp = 2

    # READY?
    print("Ready to Begin? (Press 1 to start, Press 2 to exit)")
    user = int(input())
    startcnt = 0

    # BEGIN GAME
    if user == 1:
        TLGP.start(moves,dif,dupp)

    # EXIT
    elif user == 2:
        sys.exit("Goodbye!")

    # IF INVALID INPUT
    elif user != 1 and user != 2:
        while user != 1 and user != 2:
            startcnt+=1
            if startcnt != 3:
                print("Please Enter the correct number to begin. (1 = Start   2 = Exit)")
                user=int(input())
            else:
                sys.exit("Too many attempts. GoodBye!")
