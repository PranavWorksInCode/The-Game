const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');

const CELL_SIZE = 20;
const GRID_COLS = 40;
const GRID_ROWS = 40;

// World scale: 1 cell = 2x2 units in 3D.
function cellToWorld(col, row) {
    return {
        x: (col - GRID_COLS/2) * 2 + 1, // center of cell
        z: (row - GRID_ROWS/2) * 2 + 1
    };
}

let mapGrid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
let entities = [];
let playerStart = { col: 20, row: 20 };

let currentTool = 'draw';
let currentColor = '#888888';
let currentHeight = 1;

// UI Setup
document.getElementById('block-height').addEventListener('input', (e) => {
    currentHeight = parseInt(e.target.value);
    document.getElementById('height-val').innerText = 'Height: ' + currentHeight;
});
document.getElementById('block-color').addEventListener('input', (e) => {
    currentColor = e.target.value;
});
document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = 'index.html';
});

const tools = ['draw', 'erase', 'player', 'mover', 'tank'];
tools.forEach(t => {
    document.getElementById('tool-' + t).addEventListener('click', () => {
        currentTool = t;
        tools.forEach(t2 => document.getElementById('tool-' + t2).classList.remove('active-tool'));
        document.getElementById('tool-' + t).classList.add('active-tool');
        document.getElementById('block-settings').style.display = (t === 'draw') ? 'block' : 'none';
    });
});

let isDrawing = false;

canvas.addEventListener('mousedown', (e) => { isDrawing = true; handleTool(e); });
canvas.addEventListener('mousemove', (e) => { if (isDrawing) handleTool(e); });
window.addEventListener('mouseup', () => { isDrawing = false; });

function handleTool(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    if (currentTool === 'draw') {
        mapGrid[row][col] = { height: currentHeight, color: currentColor };
    } else if (currentTool === 'erase') {
        mapGrid[row][col] = null;
        entities = entities.filter(ent => ent.col !== col || ent.row !== row);
    } else if (currentTool === 'player') {
        playerStart = { col, row };
    } else if (currentTool === 'mover' || currentTool === 'tank') {
        if (!entities.find(ent => ent.col === col && ent.row === row)) {
            entities.push({ type: currentTool, col, row });
        }
    }
    drawGrid();
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw cells
    for(let r=0; r<GRID_ROWS; r++) {
        for(let c=0; c<GRID_COLS; c++) {
            let cell = mapGrid[r][c];
            if (cell) {
                ctx.fillStyle = cell.color;
                ctx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(cell.height, c*CELL_SIZE + CELL_SIZE/2, r*CELL_SIZE + CELL_SIZE/1.5);
            }
            ctx.strokeStyle = '#333';
            ctx.strokeRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }
    
    // Draw entities
    entities.forEach(ent => {
        ctx.fillStyle = ent.type === 'mover' ? '#00ffff' : '#ff00ff';
        ctx.beginPath();
        ctx.arc(ent.col*CELL_SIZE + CELL_SIZE/2, ent.row*CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2.5, 0, Math.PI*2);
        ctx.fill();
    });
    
    // Draw player
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(playerStart.col*CELL_SIZE + CELL_SIZE/2, playerStart.row*CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2.5, 0, Math.PI*2);
    ctx.fill();
}

document.getElementById('btn-clear').addEventListener('click', () => {
    mapGrid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    entities = [];
    drawGrid();
});

document.getElementById('btn-save-play').addEventListener('click', () => {
    let mapData = { blocks: [] };
    let gameEnemies = [];
    
    // Compile blocks
    for(let r=0; r<GRID_ROWS; r++) {
        for(let c=0; c<GRID_COLS; c++) {
            let cell = mapGrid[r][c];
            if (cell) {
                let wPos = cellToWorld(c, r);
                let colorNum = parseInt(cell.color.replace('#', '0x'));
                mapData.blocks.push({ x: wPos.x, y: 0, z: wPos.z, w: 2, h: cell.height, d: 2, color: colorNum });
            }
        }
    }
    
    // Outer bounds
    mapData.blocks.push({ x: 0, y: 0, z: -41, w: 82, h: 5, d: 2, color: 0x555555 });
    mapData.blocks.push({ x: 0, y: 0, z: 41, w: 82, h: 5, d: 2, color: 0x555555 });
    mapData.blocks.push({ x: -41, y: 0, z: 0, w: 2, h: 5, d: 82, color: 0x555555 });
    mapData.blocks.push({ x: 41, y: 0, z: 0, w: 2, h: 5, d: 82, color: 0x555555 });
    
    // Compile enemies
    let idCounter = 1;
    entities.forEach(ent => {
        let wPos = cellToWorld(ent.col, ent.row);
        if (ent.type === 'mover') {
            gameEnemies.push({ id: idCounter++, x: wPos.x, y: 0, z: wPos.z, hp: 150, maxHp: 150, type: 'mover', speed: 4.0, nextShoot: 0 });
        } else if (ent.type === 'tank') {
            gameEnemies.push({ id: idCounter++, x: wPos.x, y: 0, z: wPos.z, hp: 2000, maxHp: 2000, type: 'tank', speed: 0.0, nextShoot: 0 });
        }
    });
    
    let pStartWorld = cellToWorld(playerStart.col, playerStart.row);
    
    let finalSave = {
        mapData: mapData,
        enemies: gameEnemies,
        playerStart: { x: pStartWorld.x, z: pStartWorld.z }
    };
    
    localStorage.setItem('customMap', JSON.stringify(finalSave));
    window.location.href = 'index.html';
});

// Load existing if available
const existing = localStorage.getItem('customMap');
if (existing) {
    // Basic restoration of player start and entities (reversing the export)
    // We don't restore the full painted grid for now, just start empty if they reload the page.
    // For a robust editor, we'd reverse-map world coordinates to grid.
}

drawGrid();
