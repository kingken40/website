// DOM Elements
const factForm = document.getElementById('factForm');
const numberInput = document.getElementById('numberInput');
const output = document.getElementById('output');
const factList = document.getElementById('factList');

// Predefined list of random facts
const facts = [
  "The number 1 is the first natural number.",
  "The number 2 is the only even prime number.",
  "The number 3 is the number of dimensions we live in.",
  "The number 4 is the number of seasons in a year.",
  "The number 5 is the number of fingers on one hand.",
  "The number 6 is the smallest perfect number.",
  "The number 7 is considered a lucky number in many cultures.",
  "The number 8 is the atomic number of oxygen.",
  "The number 9 is the highest single-digit number.",
  "The number 10 is the base of the decimal system."
];

// Array to store previous facts
let previousFacts = [];

// Function to get a random fact based on the number
function getFact(number) {
  if (number >= 1 && number <= 10) {
    return facts[number - 1]; // Return the fact corresponding to the number
  } else {
    return "Please enter a number between 1 and 10.";
  }
}

// Function to display a fact
function displayFact(fact, number) {
  output.textContent = fact;
  previousFacts.unshift({ number, fact }); // Add to the beginning of the array
  updateFactList();
}

// Function to update the list of previous facts
function updateFactList() {
  factList.innerHTML = ''; // Clear the list
  previousFacts.forEach((item, index) => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `<strong>${item.number}:</strong> ${item.fact}`;
    if (index === 0) {
      listItem.classList.add('latest'); // Highlight the latest fact
    }
    factList.appendChild(listItem);
  });
}

// Event listener for form submission
factForm.addEventListener('submit', (event) => {
  event.preventDefault(); // Prevent form from submitting
  const number = numberInput.value.trim();

  if (number) {
    const fact = getFact(number); // Get the fact
    displayFact(fact, number);
    numberInput.value = ''; // Clear the input field
  } else {
    output.textContent = 'Please enter a number.';
  }
});