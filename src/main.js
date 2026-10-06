import './styles.css';
import { applyArt } from './ui/art.js';
import { newGame, startTurn } from './engine/core.js';
import { render, run } from './ui/render.js';
import { bindInput } from './ui/input.js';

bindInput();
applyArt();
newGame();
render();
run(startTurn);
