import {
  GRID_SIZE,
  TICK_MS,
  createInitialState,
  stepGame,
} from "./snake-core.js";
import {
  createAccountWithEmail,
  getAuthErrorMessage,
  initializeFirebase,
  isFirebaseEnabled,
  isSecureAuthContext,
  loadUserProfile,
  logoutCurrentUser,
  saveHighScore,
  signInWithEmail,
  watchAuthState,
} from "./firebase-service.js";

const board = document.querySelector("#board");
const score = document.querySelector("#score");
const bestScore = document.querySelector("#best-score");
const status = document.querySelector("#status");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const controlButtons = Array.from(document.querySelectorAll("[data-direction]"));
const authState = document.querySelector("#auth-state");
const authMessage = document.querySelector("#auth-message");
const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");
const confirmPasswordInput = document.querySelector("#confirm-password-input");
const confirmPasswordField = document.querySelector("#confirm-password-field");
const createAccountButton = document.querySelector("#create-account-button");
const signInButton = document.querySelector("#sign-in-button");
const logoutButton = document.querySelector("#logout-button");
const authModeSignIn = document.querySelector("#auth-mode-sign-in");
const authModeCreate = document.querySelector("#auth-mode-create");
const authModeTabs = document.querySelector("#auth-mode-tabs");

const cells = [];
let gameState = createInitialState();
let pendingDirection = null;
let currentUser = null;
let lifetimeBest = null;
/** @type {"signin" | "create"} */
let authMode = "signin";

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

function isTypingActive() {
  return isTypingTarget(document.activeElement);
}

function handleKeydown(event) {
  if (isTypingTarget(event.target) || isTypingActive()) {
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

function setAuthMode(mode) {
  authMode = mode;
  const isCreate = mode === "create";

  authModeSignIn.setAttribute("aria-selected", String(!isCreate));
  authModeCreate.setAttribute("aria-selected", String(isCreate));
  authModeSignIn.classList.toggle("is-active", !isCreate);
  authModeCreate.classList.toggle("is-active", isCreate);

  confirmPasswordField.hidden = !isCreate;
  confirmPasswordInput.disabled = !isCreate;
  if (!isCreate) {
    confirmPasswordInput.value = "";
  }

  passwordInput.autocomplete = isCreate ? "new-password" : "current-password";

  signInButton.hidden = isCreate;
  createAccountButton.hidden = !isCreate;
}

function updateAuthUi() {
  const configured = isFirebaseEnabled();
  const secureAuth = isSecureAuthContext();
  const authAvailable = configured && secureAuth;
  const formLocked = !authAvailable || currentUser !== null;

  emailInput.disabled = formLocked;
  passwordInput.disabled = formLocked;
  confirmPasswordInput.disabled = formLocked || authMode === "signin";
  createAccountButton.disabled = formLocked;
  signInButton.disabled = formLocked;
  logoutButton.hidden = currentUser === null;
  authModeTabs.hidden = currentUser !== null;

  if (!configured) {
    authState.textContent = "Firebase not set";
    setAuthMessage("Firebase config is missing. Add the Vercel environment variables or create firebase-config.local.json for local testing.");
    bestScore.textContent = "-";
    return;
  }

  if (!secureAuth) {
    authState.textContent = "Secure host required";
    setAuthMessage("Sign-in is disabled on this page because it is not running on HTTPS or localhost. Open the HTTPS deployed URL or run on localhost to use Firebase Auth safely.");
    bestScore.textContent = "-";
    return;
  }

  if (!currentUser) {
    authState.textContent = "Signed out";
    setAuthMessage("Create an account or sign in to save your lifetime highest score.");
    setAuthMode(authMode);
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

function readCredentials(requireConfirmPassword = false) {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!email || !password) {
    setAuthMessage("Enter both email and password.");
    return null;
  }

  if (requireConfirmPassword) {
    if (!confirmPassword) {
      setAuthMessage("Confirm your password to create the account.");
      return null;
    }

    if (password !== confirmPassword) {
      setAuthMessage("Password and confirm password do not match.");
      return null;
    }
  }

  return { email, password };
}

function clearCredentials() {
  passwordInput.value = "";
  confirmPasswordInput.value = "";
}

async function handleCreateAccount() {
  const credentials = readCredentials(true);
  if (!credentials) {
    return;
  }

  try {
    await createAccountWithEmail(credentials.email, credentials.password);
    clearCredentials();
    setAuthMessage("Account created and signed in successfully.");
  } catch (error) {
    setAuthMessage(getAuthErrorMessage(error));
  }
}

async function handleSignIn() {
  const credentials = readCredentials(false);
  if (!credentials) {
    return;
  }

  try {
    await signInWithEmail(credentials.email, credentials.password);
    clearCredentials();
    setAuthMessage("Signed in successfully.");
  } catch (error) {
    setAuthMessage(getAuthErrorMessage(error));
  }
}

async function handleLogout() {
  try {
    await logoutCurrentUser();
    emailInput.value = "";
    clearCredentials();
    setAuthMessage("Signed out.");
  } catch (error) {
    setAuthMessage(getAuthErrorMessage(error));
  }
}

buildBoard();
render();
gameLoop();

document.addEventListener("keydown", handleKeydown);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", resetGame);
createAccountButton.addEventListener("click", handleCreateAccount);
signInButton.addEventListener("click", handleSignIn);
logoutButton.addEventListener("click", handleLogout);

authModeSignIn.addEventListener("click", () => {
  setAuthMode("signin");
  updateAuthUi();
});

authModeCreate.addEventListener("click", () => {
  setAuthMode("create");
  updateAuthUi();
});

for (const input of [emailInput, passwordInput, confirmPasswordInput]) {
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });
}

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    queueDirection(button.dataset.direction);
  });
}

void startAuth();

async function startAuth() {
  await initializeFirebase();
  watchAuthState((user) => {
    void hydrateUserProfile(user);
  });
}
