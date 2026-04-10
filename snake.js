import {
  GRID_SIZE,
  TICK_MS,
  createInitialState,
  stepGame,
} from "./snake-core.js";
import {
  getAuthErrorMessage,
  isFirebaseEnabled,
  isSecureAuthContext,
  loadUserProfile,
  loginWithEmail,
  logoutCurrentUser,
  registerWithEmail,
  saveHighScore,
  watchAuthState,
} from "./firebase-service.js";

const board = document.querySelector("#board");
const score = document.querySelector("#score");
const bestScore = document.querySelector("#best-score");
const status = document.querySelector("#status");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const controlButtons = Array.from(document.querySelectorAll("[data-direction]"));
const authForm = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");
const confirmPasswordInput = document.querySelector("#confirm-password-input");
const authState = document.querySelector("#auth-state");
const authMessage = document.querySelector("#auth-message");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");
const passwordVisibilityButton = document.querySelector("#password-visibility-button");
const confirmPasswordVisibilityButton = document.querySelector(
  "#confirm-password-visibility-button",
);

const cells = [];
let gameState = createInitialState();
let pendingDirection = null;
let currentUser = null;
let lifetimeBest = null;

function buildBoard() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    fragment.appendChild(cell);
    cells.push(cell);
  }

  board.appendChild(fragment);
}

function getCellIndex(x, y) {
  return y * GRID_SIZE + x;
}

function render() {
  for (const cell of cells) {
    cell.className = "cell";
  }

  for (const [index, segment] of gameState.snake.entries()) {
    const cell = cells[getCellIndex(segment.x, segment.y)];
    if (!cell) {
      continue;
    }

    cell.classList.add("snake");
    if (index === 0) {
      cell.classList.add("head");
    }
  }

  if (gameState.food) {
    const foodCell = cells[getCellIndex(gameState.food.x, gameState.food.y)];
    if (foodCell) {
      foodCell.classList.add("food");
    }
  }

  score.textContent = String(gameState.score);
  bestScore.textContent = lifetimeBest == null ? "-" : String(lifetimeBest);
  pauseButton.textContent = gameState.status === "paused" ? "Resume" : "Pause";

  if (gameState.status === "ready") {
    status.textContent = "Press an arrow key, WASD, or a touch button to start.";
    return;
  }

  if (gameState.status === "running") {
    status.textContent = "Eat food, avoid the walls, and don't hit yourself.";
    return;
  }

  if (gameState.status === "paused") {
    status.textContent = "Paused. Press Space or Resume to keep going.";
    return;
  }

  if (gameState.status === "won") {
    status.textContent = "You filled the board. Restart to play again.";
    return;
  }

  status.textContent = "Game over. Press Restart to try again.";
}

function resetGame() {
  gameState = createInitialState();
  pendingDirection = null;
  render();
}

function queueDirection(direction) {
  pendingDirection = direction;

  if (gameState.status === "ready" || gameState.status === "paused") {
    gameState = {
      ...gameState,
      status: "running",
    };
  }
}

function togglePause() {
  if (
    gameState.status === "ready" ||
    gameState.status === "gameover" ||
    gameState.status === "won"
  ) {
    return;
  }

  gameState = {
    ...gameState,
    status: gameState.status === "paused" ? "running" : "paused",
  };
  render();
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

function togglePasswordVisibility(input, button, showLabel, hideLabel) {
  const showingPassword = input.type === "text";
  input.type = showingPassword ? "password" : "text";
  const nextLabel = showingPassword ? showLabel : hideLabel;
  button.setAttribute("aria-label", nextLabel);
  button.setAttribute("title", nextLabel);
}

function handleKeydown(event) {
  if (isTypingTarget(event.target)) {
    return;
  }

  const key = event.key.toLowerCase();
  const directionByKey = {
    arrowup: "UP",
    w: "UP",
    arrowdown: "DOWN",
    s: "DOWN",
    arrowleft: "LEFT",
    a: "LEFT",
    arrowright: "RIGHT",
    d: "RIGHT",
  };

  if (key === "enter" && (gameState.status === "gameover" || gameState.status === "won")) {
    event.preventDefault();
    resetGame();
    return;
  }

  if (key === " ") {
    event.preventDefault();
    togglePause();
    return;
  }

  const direction = directionByKey[key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  queueDirection(direction);
}

function gameLoop() {
  if (gameState.status === "running") {
    gameState = stepGame(gameState, pendingDirection);
    pendingDirection = null;
    render();
    void syncHighScore();
  }

  window.setTimeout(gameLoop, TICK_MS);
}

async function syncHighScore() {
  if (!currentUser || gameState.score <= 0) {
    return;
  }

  const savedBest = await saveHighScore(currentUser, gameState.score);
  if (savedBest != null && savedBest !== lifetimeBest) {
    lifetimeBest = savedBest;
    render();
  }
}

function setAuthMessage(message) {
  authMessage.textContent = message;
}

function updateAuthUi() {
  const configured = isFirebaseEnabled();
  const secureAuth = isSecureAuthContext();
  const authAvailable = configured && secureAuth;

  emailInput.disabled = !authAvailable || currentUser !== null;
  passwordInput.disabled = !authAvailable || currentUser !== null;
  confirmPasswordInput.disabled = !authAvailable || currentUser !== null;
  loginButton.disabled = !authAvailable || currentUser !== null;
  signupButton.disabled = !authAvailable || currentUser !== null;
  logoutButton.hidden = currentUser === null;
  passwordVisibilityButton.disabled = !authAvailable || currentUser !== null;
  confirmPasswordVisibilityButton.disabled = !authAvailable || currentUser !== null;

  if (!configured) {
    authState.textContent = "Firebase not set";
    setAuthMessage("Add your Firebase project values in firebase-config.js to enable sign in.");
    bestScore.textContent = "-";
    return;
  }

  if (!secureAuth) {
    authState.textContent = "Secure host required";
    setAuthMessage("Password sign-in is disabled on this page because it is not running on HTTPS or localhost. Open the HTTPS deployed URL or run on localhost to use Firebase Auth safely.");
    bestScore.textContent = "-";
    return;
  }

  if (!currentUser) {
    authState.textContent = "Signed out";
    setAuthMessage("Sign in to save your lifetime highest score.");
    lifetimeBest = null;
    render();
    return;
  }

  authState.textContent = currentUser.email ?? "Signed in";
  setAuthMessage("Your best score is saved automatically.");
}

async function hydrateUserProfile(user) {
  if (!user) {
    currentUser = null;
    lifetimeBest = null;
    updateAuthUi();
    render();
    return;
  }

  currentUser = user;
  const profile = await loadUserProfile(user.uid);
  lifetimeBest = profile?.highestScore ?? 0;
  updateAuthUi();
  render();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setAuthMessage("Enter both email and password.");
    return;
  }

  try {
    await loginWithEmail(email, password);
    passwordInput.value = "";
    confirmPasswordInput.value = "";
    setAuthMessage("Signed in successfully.");
  } catch (error) {
    setAuthMessage(getAuthErrorMessage(error));
  }
}

async function handleSignup() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!email || !password) {
    setAuthMessage("Enter both email and password.");
    return;
  }

  if (!confirmPassword) {
    setAuthMessage("Please confirm your password.");
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage("Password and confirm password must match.");
    return;
  }

  try {
    await registerWithEmail(email, password);
    passwordInput.value = "";
    confirmPasswordInput.value = "";
    setAuthMessage("Account created.");
  } catch (error) {
    setAuthMessage(getAuthErrorMessage(error));
  }
}

async function handleLogout() {
  try {
    await logoutCurrentUser();
    emailInput.value = "";
    passwordInput.value = "";
    confirmPasswordInput.value = "";
    setAuthMessage("Signed out.");
  } catch (error) {
    setAuthMessage(getAuthErrorMessage(error));
  }
}

buildBoard();
render();
gameLoop();
updateAuthUi();
watchAuthState((user) => {
  void hydrateUserProfile(user);
});

document.addEventListener("keydown", handleKeydown);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", resetGame);
authForm.addEventListener("submit", handleAuthSubmit);
signupButton.addEventListener("click", handleSignup);
logoutButton.addEventListener("click", handleLogout);
passwordVisibilityButton.addEventListener("click", () => {
  togglePasswordVisibility(
    passwordInput,
    passwordVisibilityButton,
    "Show password",
    "Hide password",
  );
});
confirmPasswordVisibilityButton.addEventListener("click", () => {
  togglePasswordVisibility(
    confirmPasswordInput,
    confirmPasswordVisibilityButton,
    "Show confirm password",
    "Hide confirm password",
  );
});

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    queueDirection(button.dataset.direction);
  });
}
