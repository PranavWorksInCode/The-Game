const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');

// Editor State
let floors = [
    { y: 0, objects: [] } // Floor 0
];
let currentFloorIndex = 0;
let playerStart = { x: 0, y: 0, z: 5, floorIndex: 0 };
let selectedObject = null;
let currentTool = 'select'; // select, block, ramp, erase, player, mover, tank

// UI Elements
const floorSelect = document.getElementById('floor-select');
const floorYInput = document.getElementById('floor-y-input');
const lblFloor = document.getElementById('lbl-floor');
const lblFloorY = document.getElementById('lbl-floor-y');
const outlinerList = document.getElementById('outliner-list');
const propertiesPanel = document.getElementById('properties-panel');

// Constants
const GRID_SIZE = 40;
const CELL_SIZE = 20;

// Utility for unique IDs
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Convert Screen coordinates to World coordinates
function screenToWorld(cx, cy) {
    let hw = canvas.width / 2;
    let hh = canvas.height / 2;
    // cx, cy are in pixels. Center of canvas is 0,0 in world.
    // 1 cell = 20 pixels = 2 world units.
    let x = ((cx - hw) / CELL_SIZE) * 2;
    let z = ((cy - hh) / CELL_SIZE) * 2;
    return { x, z };
}

function worldToScreen(x, z) {
    let hw = canvas.width / 2;
    let hh = canvas.height / 2;
    let cx = (x / 2) * CELL_SIZE + hw;
    let cy = (z / 2) * CELL_SIZE + hh;
    return { cx, cy };
}

// Floor Management
function updateFloorUI() {
    floorSelect.innerHTML = '';
    floors.forEach((f, i) => {
        let opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Floor ${i} (Y: ${f.y})`;
        if (i === currentFloorIndex) opt.selected = true;
        floorSelect.appendChild(opt);
    });
    lblFloor.innerText = currentFloorIndex;
    lblFloorY.innerText = floors[currentFloorIndex].y;
    floorYInput.value = floors[currentFloorIndex].y;
    updateOutliner();
    drawCanvas();
}

document.getElementById('btn-add-floor').addEventListener('click', () => {
    let highestY = floors.reduce((max, f) => Math.max(max, f.y), -999);
    floors.push({ y: highestY + 5, objects: [] });
    currentFloorIndex = floors.length - 1;
    updateFloorUI();
});

document.getElementById('btn-add-floor-below').addEventListener('click', () => {
    let lowestY = floors.reduce((min, f) => Math.min(min, f.y), 999);
    floors.push({ y: lowestY - 5, objects: [] });
    currentFloorIndex = floors.length - 1;
    updateFloorUI();
});

floorSelect.addEventListener('change', (e) => {
    currentFloorIndex = parseInt(e.target.value);
    selectObject(null);
    updateFloorUI();
});

floorYInput.addEventListener('change', (e) => {
    floors[currentFloorIndex].y = parseFloat(e.target.value);
    updateFloorUI();
});

// Outliner & Selection
function updateOutliner() {
    outlinerList.innerHTML = '';
    let floor = floors[currentFloorIndex];
    floor.objects.forEach(obj => {
        let div = document.createElement('div');
        div.className = 'outliner-item' + (selectedObject === obj ? ' selected' : '');
        div.innerText = `${obj.type} [${obj.id}]`;
        div.addEventListener('click', () => selectObject(obj));
        outlinerList.appendChild(div);
    });
}

function selectObject(obj) {
    selectedObject = obj;
    updateOutliner();
    
    if (!obj) {
        propertiesPanel.style.display = 'none';
        drawCanvas();
        return;
    }
    
    propertiesPanel.style.display = 'block';
    document.getElementById('prop-title').innerText = obj.type.toUpperCase();
    
    // Transform
    document.getElementById('prop-x').value = obj.x;
    document.getElementById('prop-z').value = obj.z;
    document.getElementById('prop-w').value = obj.w || 2;
    document.getElementById('prop-d').value = obj.d || 2;
    document.getElementById('prop-h').value = obj.h || 1;
    
    // Type specific
    document.getElementById('prop-block').style.display = 'none';
    document.getElementById('prop-ramp').style.display = 'none';
    document.getElementById('prop-enemy').style.display = 'none';
    
    if (obj.type === 'block') {
        document.getElementById('prop-block').style.display = 'block';
        document.getElementById('prop-color').value = obj.color;
        document.getElementById('prop-breakable').checked = obj.breakable;
        document.getElementById('prop-hp').value = obj.hp;
    } else if (obj.type === 'ramp') {
        document.getElementById('prop-ramp').style.display = 'block';
        document.getElementById('prop-ramp-color').value = obj.color;
        document.getElementById('prop-ramp-dir').value = obj.dir;
    } else if (obj.type === 'mover' || obj.type === 'tank') {
        document.getElementById('prop-enemy').style.display = 'block';
        document.getElementById('prop-enemy-hp').value = obj.hp;
        document.getElementById('prop-enemy-dmg').value = obj.damage;
        document.getElementById('prop-enemy-speed').value = obj.speed;
    }
    
    drawCanvas();
}

// Property Binding
function bindInput(id, field, isNum = false) {
    document.getElementById(id).addEventListener('input', (e) => {
        if (!selectedObject) return;
        let val = e.target.value;
        if (e.target.type === 'checkbox') val = e.target.checked;
        else if (isNum) val = parseFloat(val);
        selectedObject[field] = val;
        drawCanvas();
    });
}

bindInput('prop-x', 'x', true);
bindInput('prop-z', 'z', true);
bindInput('prop-w', 'w', true);
bindInput('prop-d', 'd', true);
bindInput('prop-h', 'h', true);

bindInput('prop-color', 'color');
bindInput('prop-breakable', 'breakable');
bindInput('prop-hp', 'hp', true);

bindInput('prop-ramp-color', 'color');
bindInput('prop-ramp-dir', 'dir');

bindInput('prop-enemy-hp', 'hp', true);
bindInput('prop-enemy-dmg', 'damage', true);
bindInput('prop-enemy-speed', 'speed', true);

document.getElementById('btn-delete-obj').addEventListener('click', () => {
    if (!selectedObject) return;
    let floor = floors[currentFloorIndex];
    floor.objects = floor.objects.filter(o => o !== selectedObject);
    selectObject(null);
});

// File Uploads to Base64
function handleFileUpload(inputId, propName) {
    document.getElementById(inputId).addEventListener('change', (e) => {
        if (!selectedObject || !e.target.files.length) return;
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = (evt) => {
            selectedObject[propName] = evt.target.result;
            console.log("Loaded file into " + propName);
        };
        reader.readAsDataURL(file);
    });
}
handleFileUpload('prop-texture-file', 'textureBase64');
handleFileUpload('prop-model-file', 'modelBase64');

document.getElementById('btn-clear-texture').addEventListener('click', () => {
    if(selectedObject) selectedObject.textureBase64 = null;
});
document.getElementById('btn-clear-model').addEventListener('click', () => {
    if(selectedObject) selectedObject.modelBase64 = null;
});


// Tools
const toolBtns = document.querySelectorAll('.tool-btn');
toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        toolBtns.forEach(b => b.classList.remove('active-btn'));
        e.target.classList.add('active-btn');
        currentTool = e.target.id.replace('tool-', '');
    });
});

let isMouseDown = false;
let dragStart = null;

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    
    let wPos = screenToWorld(cx, cy);
    // Snap to nearest 2 grid
    wPos.x = Math.round(wPos.x / 2) * 2;
    wPos.z = Math.round(wPos.z / 2) * 2;
    
    if (currentTool === 'select') {
        // Find clicked object
        let floor = floors[currentFloorIndex];
        let clicked = null;
        for(let i = floor.objects.length - 1; i >= 0; i--) {
            let o = floor.objects[i];
            if (wPos.x >= o.x - o.w/2 && wPos.x <= o.x + o.w/2 &&
                wPos.z >= o.z - o.d/2 && wPos.z <= o.z + o.d/2) {
                clicked = o;
                break;
            }
        }
        selectObject(clicked);
    } else if (currentTool === 'block' || currentTool === 'ramp') {
        dragStart = wPos;
    } else if (currentTool === 'player') {
        playerStart = { x: wPos.x, y: floors[currentFloorIndex].y, z: wPos.z, floorIndex: currentFloorIndex };
        drawCanvas();
    } else if (currentTool === 'mover' || currentTool === 'tank') {
        let obj = {
            id: generateId(),
            type: currentTool,
            x: wPos.x, z: wPos.z, w: 2, d: 2, h: 2,
            hp: currentTool==='tank'?2000:150,
            damage: 10,
            speed: currentTool==='tank'?0:4,
            modelBase64: null
        };
        floors[currentFloorIndex].objects.push(obj);
        selectObject(obj);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    if (currentTool === 'block' || currentTool === 'ramp') {
        // Show drag preview via drawCanvas
        const rect = canvas.getBoundingClientRect();
        let wPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        wPos.x = Math.round(wPos.x / 2) * 2;
        wPos.z = Math.round(wPos.z / 2) * 2;
        drawCanvas(wPos); // Pass current drag pos
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isMouseDown && (currentTool === 'block' || currentTool === 'ramp') && dragStart) {
        const rect = canvas.getBoundingClientRect();
        let wPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        wPos.x = Math.round(wPos.x / 2) * 2;
        wPos.z = Math.round(wPos.z / 2) * 2;
        
        let minX = Math.min(dragStart.x, wPos.x);
        let maxX = Math.max(dragStart.x, wPos.x);
        let minZ = Math.min(dragStart.z, wPos.z);
        let maxZ = Math.max(dragStart.z, wPos.z);
        
        let w = (maxX - minX) + 2;
        let d = (maxZ - minZ) + 2;
        let x = minX + (maxX - minX)/2;
        let z = minZ + (maxZ - minZ)/2;
        
        let obj = {
            id: generateId(),
            type: currentTool,
            x, z, w, d, h: 2,
            color: '#888888'
        };
        
        if (currentTool === 'block') {
            obj.breakable = false;
            obj.hp = 100;
            obj.textureBase64 = null;
        } else if (currentTool === 'ramp') {
            obj.dir = 'N'; // default slope up towards North (-Z)
        }
        
        floors[currentFloorIndex].objects.push(obj);
        selectObject(obj);
    }
    isMouseDown = false;
    dragStart = null;
    drawCanvas();
});


function drawCanvas(dragPos = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for(let i=0; i<=canvas.width; i+=CELL_SIZE) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    
    let floor = floors[currentFloorIndex];
    
    // Draw Objects
    floor.objects.forEach(o => {
        let sc = worldToScreen(o.x, o.z);
        let sw = (o.w / 2) * CELL_SIZE;
        let sd = (o.d / 2) * CELL_SIZE;
        
        ctx.fillStyle = o.color || (o.type==='mover'?'#0ff':'#f0f');
        ctx.strokeStyle = (selectedObject === o) ? '#fff' : '#000';
        ctx.lineWidth = (selectedObject === o) ? 3 : 1;
        
        if (o.type === 'block' || o.type === 'ramp') {
            ctx.fillRect(sc.cx - sw, sc.cy - sd, sw*2, sd*2);
            ctx.strokeRect(sc.cx - sw, sc.cy - sd, sw*2, sd*2);
            
            if (o.type === 'ramp') {
                ctx.fillStyle = '#000';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(o.dir, sc.cx, sc.cy + 6);
            }
        } else {
            ctx.beginPath();
            ctx.arc(sc.cx, sc.cy, CELL_SIZE/2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        }
    });
    
    // Draw drag preview
    if (dragStart && dragPos) {
        let minX = Math.min(dragStart.x, dragPos.x);
        let maxX = Math.max(dragStart.x, dragPos.x);
        let minZ = Math.min(dragStart.z, dragPos.z);
        let maxZ = Math.max(dragStart.z, dragPos.z);
        let w = (maxX - minX) + 2;
        let d = (maxZ - minZ) + 2;
        let x = minX + (maxX - minX)/2;
        let z = minZ + (maxZ - minZ)/2;
        
        let sc = worldToScreen(x, z);
        let sw = (w / 2) * CELL_SIZE;
        let sd = (d / 2) * CELL_SIZE;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(sc.cx - sw, sc.cy - sd, sw*2, sd*2);
    }
    
    // Draw Player
    if (playerStart.floorIndex === currentFloorIndex) {
        let psc = worldToScreen(playerStart.x, playerStart.z);
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(psc.cx, psc.cy, CELL_SIZE/2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

// Save & Load
document.getElementById('btn-save-play').addEventListener('click', () => {
    let finalSave = {
        floors: floors,
        playerStart: playerStart
    };
    try {
        localStorage.setItem('customMapV2', JSON.stringify(finalSave));
        window.location.href = 'index.html';
    } catch(e) {
        alert("Failed to save map! If you uploaded very large 3D models, they might exceed localStorage quota.");
    }
});

document.getElementById('btn-clear').addEventListener('click', () => {
    floors = [{ y: 0, objects: [] }];
    currentFloorIndex = 0;
    selectObject(null);
    updateFloorUI();
});

document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Load existing
const existing = localStorage.getItem('customMapV2');
if (existing) {
    try {
        let parsed = JSON.parse(existing);
        floors = parsed.floors || [{ y: 0, objects: [] }];
        playerStart = parsed.playerStart || { x: 0, y: 0, z: 5, floorIndex: 0 };
    } catch(e) {}
}

updateFloorUI();
