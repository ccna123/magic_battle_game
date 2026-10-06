import './styles.css';
import { applyArt } from './ui/art.js';
import { newGame } from './engine/core.js';
import { openDeckPick } from './ui/deckpick.js';
import { render } from './ui/render.js';
import { bindInput } from './ui/input.js';

bindInput();
applyArt();
newGame();       // bàn đấu xem trước phía sau màn chọn bộ bài
render();
openDeckPick();
