import sys
import ToughLuckStart as TLS

# FINISHED! DISPLAYING GAME RESULTS
def results(dif, path_list, missed, L, points, execute):
    if dif == 'e' or dif == 'E':
        dif = "Easy"
    elif dif == 'm' or dif == 'M':
        dif = "Medium"
    elif dif == 'h' or dif == 'H':
        dif = "Hard"
        hardResults(dif, path_list, missed, L, points, execute)
    print()
    print("FINISHED!\n---------------Game Results---------------")
    print("Difficulty: ", dif)
    print("Time Elapsed: ", round(execute, 2)," seconds.")
    print("Correct Path: ", path_list)
    print("Correct Path Length: ", len(path_list))
    print("Your Path: ", L)
    print("Your Path Length: ", len(L))
    print("Number of Missed Spots: ",missed)

    # CALCULATING POINTS BASED ON DIFFICULTY
    if dif == "Easy":
        print("Total Available Points: ", (len(path_list)*2))
    elif dif == "Medium":
        print("Total Available Points: ", (len(path_list)*3))
        
    # If no points were earned, display 0 not a negative number
    if points <= 0:
        print("Total Points Earned: ",0,"\nTough Luck.\n")
    else:
        print("Total Points Earned: ",points)

    # GAME WON!!!
    if path_list == L:
        print("\n A Perfect Path!! Lucky You!!!\n")
    replay()


def hardResults(dif, path_list, missed, L, points, execute):
    print("FINISHED!\n---------------Game Results---------------")
    print("Difficulty: ", dif)
    print("Time Elapsed: ", round(execute, 2)," seconds.")
    print("Correct Path: ", path_list)
    print("Correct Path Length: ", len(path_list))
    print("Your Move List: ", L)
    print("Your Path Length: ", len(L))
    print("Number of Missed Spots: ",missed)
    print("Total Available Points: ", (len(path_list)*5))
    # If no points were earned, display 0 not a negative number
    if points <= 0:
        print("Total Points Earned: ",0)
        sys.exit("Tough Luck.\n")
    elif points > 0 and path_list != L:
        print("Total Points Earned: ",points)
        print("Almost made it.")
    else:
        print("Total Points Earned: ",points)
        print("A Perfect Path! Lucky You!!!")
    replay()

def replay():
    print("\nWould you like to play again? Enter 'y' for Yes or 'n' for No.")
    replayInpt = input()
    replaycnt = 0
    if replayInpt.lower() == 'y':
        TLS.gameConfig()
    elif replayInpt.lower() == 'n':
        sys.exit("Exitting Game.")
    while replayInpt.lower() != 'y' and replayInpt.lower() != 'n':
        replaycnt+=1
        if replaycnt != 3:
            print("Please Enter the Correct Letter! Enter 'y' for Yes or 'n' for No.")
            replayInpt = input()
            print(replayInpt)
        else: 
            sys.exit("Too many Attempts! Goodbye!!!!")
    
        