import {
  GRID_SIZE,
  TICK_MS,
  createInitialState,
  stepGame,
} from "./snake-core.js";

const board = document.querySelector("#board");
const score = document.querySelector("#score");
const status = document.querySelector("#status");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const controlButtons = Array.from(document.querySelectorAll("[data-direction]"));

const cells = [];
let gameState = createInitialState();
let pendingDirection = null;

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

function handleKeydown(event) {
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
  }

  window.setTimeout(gameLoop, TICK_MS);
}

buildBoard();
render();
gameLoop();

document.addEventListener("keydown", handleKeydown);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", resetGame);

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    queueDirection(button.dataset.direction);
  });
}
