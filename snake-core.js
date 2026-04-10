export const GRID_SIZE = 16;
export const TICK_MS = 150;

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITES = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

const INITIAL_SNAKE = [
  { x: 4, y: 8 },
  { x: 3, y: 8 },
  { x: 2, y: 8 },
];

export function createInitialState(randomFn = Math.random) {
  const snake = INITIAL_SNAKE.map((segment) => ({ ...segment }));

  return {
    snake,
    direction: "RIGHT",
    food: placeFood(snake, randomFn),
    score: 0,
    status: "running",
  };
}

export function isOppositeDirection(nextDirection, currentDirection) {
  return OPPOSITES[nextDirection] === currentDirection;
}

export function getNextDirection(currentDirection, requestedDirection) {
  if (!requestedDirection || !DIRECTIONS[requestedDirection]) {
    return currentDirection;
  }

  if (isOppositeDirection(requestedDirection, currentDirection)) {
    return currentDirection;
  }

  return requestedDirection;
}

export function placeFood(snake, randomFn = Math.random) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const openCells = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        openCells.push({ x, y });
      }
    }
  }

  if (openCells.length === 0) {
    return null;
  }

  const index = Math.floor(randomFn() * openCells.length);
  return openCells[index];
}

export function stepGame(state, requestedDirection, randomFn = Math.random) {
  if (state.status !== "running") {
    return state;
  }

  const direction = getNextDirection(state.direction, requestedDirection);
  const head = state.snake[0];
  const delta = DIRECTIONS[direction];
  const nextHead = {
    x: head.x + delta.x,
    y: head.y + delta.y,
  };

  const hitsWall =
    nextHead.x < 0 ||
    nextHead.x >= GRID_SIZE ||
    nextHead.y < 0 ||
    nextHead.y >= GRID_SIZE;

  if (hitsWall) {
    return {
      ...state,
      direction,
      status: "gameover",
    };
  }

  const willGrow =
    state.food &&
    nextHead.x === state.food.x &&
    nextHead.y === state.food.y;

  const bodyToCheck = willGrow ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some(
    (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
  );

  if (hitsSelf) {
    return {
      ...state,
      direction,
      status: "gameover",
    };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!willGrow) {
    nextSnake.pop();
  }

  const nextFood = willGrow ? placeFood(nextSnake, randomFn) : state.food;
  const nextStatus = willGrow && nextFood === null ? "won" : "running";

  return {
    snake: nextSnake,
    direction,
    food: nextFood,
    score: state.score + (willGrow ? 1 : 0),
    status: nextStatus,
  };
}
