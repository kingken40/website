// template_8nxpc86
    /* EmailJS: */
// Gmail: service_7yvjrri
// Outlook: service_xu9sslv
// OfsXcLYxLzWkk-hFj


let isModalOpen = false;
let contrastToggle = false;
const scaleFactor = 1/20;

const mailBtn = document.querySelector(".mail__btn");
const modalExitBtn = document.querySelector(".modal__exit");
const modalOverlay = document.querySelector(".modal__overlay");

mailBtn.addEventListener("click", () => {
  document.body.classList.add("modal--open");
});

modalExitBtn.addEventListener("click", () => {
  document.body.classList.remove("modal--open");
});

modalOverlay.addEventListener("click", () => {
  document.body.classList.remove("modal--open");
});

function moveBackground(event) {
  const shapes = document.querySelectorAll(".shape");
  const x = event.clientX/20;
  const y = event.clientY/20;
  for (let i = 0; i < shapes.length; ++i) {
    const isOdd = i % 2 !== 0;
    const boolInt = isOdd ? -1 : 1;
    shapes[i].style.transform = `translate(${x * boolInt}px, ${y * boolInt}px)`;
  }
}
function toggleContrast() {
  contrastToggle = !contrastToggle;
  if (contrastToggle) {
    document.body.classList.add("dark-theme");
  } else {
    document.body.classList.remove("dark-theme");
  }
}
function contact(event) {
  event.preventDefault();
  const loading = document.querySelector(".modal__overlay--loading");
  const success = document.querySelector(".modal__overlay--success");
  loading.classList.add("modal__overlay--visible");
  emailjs
    .sendForm(
      //'service_7yvjrri', 
      'service_xu9sslv',
      'template_8nxpc86', 
      event.target,
      'OfsXcLYxLzWkk-hFj'
  ).then((/*response*/) => {
    loading.classList.remove("modal__overlay--visible");
    success.classList.add("modal__overlay--visible");
  }).catch((error) => {
    loading.classList.remove("modal__overlay--visible");
    // console.error("EmailJS error:", error);
    alert(
      "The email service is temporarily unavailable. Please contact me." + (error.text || JSON.stringify(error))
    );
  })
}

function toggleModal() {
  if (isModalOpen) {
    isModalOpen = false;
    document.body.classList.remove("modal--open");
    return;
  }

  isModalOpen = true;
  document.body.classList.add("modal--open");
}
