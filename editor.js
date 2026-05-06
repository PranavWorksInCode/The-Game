const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');

// Editor State (Flattened)
let objects = [];
let playerStart = { 
    type: 'player', x: 0, z: 5, 
    hp: 100, speed: 8.0, jumpVelocity: 14.0, 
    weapons: ['Pistol'], powers: [] 
};
let selectedObject = null;
let currentTool = 'select'; // select, block, erase, player, mover, tank

// UI Elements
const outlinerList = document.getElementById('outliner-list');
const propertiesPanel = document.getElementById('properties-panel');

// Constants
const CELL_SIZE = 20;

// Utility for unique IDs
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Convert Screen coordinates to World coordinates
function screenToWorld(cx, cy) {
    let hw = canvas.width / 2;
    let hh = canvas.height / 2;
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

// Outliner & Selection
function updateOutliner() {
    outlinerList.innerHTML = '';
    
    let pdiv = document.createElement('div');
    pdiv.className = 'outliner-item' + (selectedObject === playerStart ? ' selected' : '');
    pdiv.innerText = `Player Spawn`;
    pdiv.style.color = '#0f0';
    pdiv.addEventListener('click', () => selectObject(playerStart));
    outlinerList.appendChild(pdiv);
    
    objects.forEach(obj => {
        let div = document.createElement('div');
        div.className = 'outliner-item' + (selectedObject === obj ? ' selected' : '');
        let displayName = obj.name || obj.type;
        div.innerText = `${displayName} [${obj.id}]`;
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
    document.getElementById('prop-title').innerText = (obj.name || obj.type).toUpperCase();
    
    // Transform & Name
    document.getElementById('prop-name-group').style.display = obj.type === 'player' ? 'none' : 'block';
    document.getElementById('prop-transform').style.display = obj.type === 'player' ? 'none' : 'block';
    document.getElementById('btn-delete-obj').style.display = obj.type === 'player' ? 'none' : 'block';
    if (obj.type !== 'player') {
        document.getElementById('prop-name').value = obj.name || '';
        document.getElementById('prop-x').value = obj.x;
        document.getElementById('prop-z').value = obj.z;
        document.getElementById('prop-w').value = obj.w || 2;
        document.getElementById('prop-d').value = obj.d || 2;
        document.getElementById('prop-h').value = obj.h || 5;
    }
    
    // Type specific
    document.getElementById('prop-block').style.display = 'none';
    document.getElementById('prop-enemy').style.display = 'none';
    document.getElementById('prop-player').style.display = 'none';
    
    if (obj.type === 'block') {
        document.getElementById('prop-block').style.display = 'block';
        document.getElementById('prop-color').value = obj.color;
        document.getElementById('prop-breakable').checked = obj.breakable;
        document.getElementById('prop-hp').value = obj.hp;
        document.getElementById('lbl-hp').style.display = obj.breakable ? 'block' : 'none';
    } else if (obj.type === 'mover' || obj.type === 'tank') {
        document.getElementById('prop-enemy').style.display = 'block';
        document.getElementById('prop-enemy-hp').value = obj.hp;
        document.getElementById('prop-enemy-dmg').value = obj.damage;
        document.getElementById('prop-enemy-speed').value = obj.speed;
        
        document.getElementById('prop-enemy-ai').value = obj.aiType || 'basic_chaser';
        document.getElementById('prop-enemy-script').value = obj.customAIScript || '';
        document.getElementById('prop-enemy-script-group').style.display = (obj.aiType === 'custom') ? 'block' : 'none';
    } else if (obj.type === 'player') {
        document.getElementById('prop-player').style.display = 'block';
        document.getElementById('prop-player-hp').value = obj.hp;
        document.getElementById('prop-player-speed').value = obj.speed;
        document.getElementById('prop-player-jump').value = obj.jumpVelocity;
        
        document.querySelectorAll('.prop-wpn').forEach(cb => {
            cb.checked = obj.weapons.includes(cb.value);
        });
        document.querySelectorAll('.prop-pwr').forEach(cb => {
            cb.checked = obj.powers.includes(cb.value);
        });
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

document.getElementById('prop-name').addEventListener('input', (e) => {
    if (!selectedObject || selectedObject.type === 'player') return;
    selectedObject.name = e.target.value;
    document.getElementById('prop-title').innerText = (selectedObject.name || selectedObject.type).toUpperCase();
    updateOutliner();
});

bindInput('prop-x', 'x', true);
bindInput('prop-z', 'z', true);
bindInput('prop-w', 'w', true);
bindInput('prop-d', 'd', true);
bindInput('prop-h', 'h', true);

bindInput('prop-color', 'color');
bindInput('prop-hp', 'hp', true);

document.getElementById('prop-breakable').addEventListener('input', (e) => {
    if (!selectedObject) return;
    selectedObject.breakable = e.target.checked;
    document.getElementById('lbl-hp').style.display = selectedObject.breakable ? 'block' : 'none';
    drawCanvas();
});

bindInput('prop-enemy-hp', 'hp', true);
bindInput('prop-enemy-dmg', 'damage', true);
bindInput('prop-enemy-speed', 'speed', true);
bindInput('prop-enemy-ai', 'aiType');
bindInput('prop-enemy-script', 'customAIScript');

document.getElementById('prop-enemy-ai').addEventListener('change', (e) => {
    document.getElementById('prop-enemy-script-group').style.display = (e.target.value === 'custom') ? 'block' : 'none';
});

bindInput('prop-player-hp', 'hp', true);
bindInput('prop-player-speed', 'speed', true);
bindInput('prop-player-jump', 'jumpVelocity', true);

document.querySelectorAll('.prop-wpn').forEach(cb => {
    cb.addEventListener('change', (e) => {
        if (!selectedObject || selectedObject.type !== 'player') return;
        if (e.target.checked) {
            if (!selectedObject.weapons.includes(e.target.value)) {
                selectedObject.weapons.push(e.target.value);
            }
        } else {
            selectedObject.weapons = selectedObject.weapons.filter(w => w !== e.target.value);
        }
    });
});

document.querySelectorAll('.prop-pwr').forEach(cb => {
    cb.addEventListener('change', (e) => {
        if (!selectedObject || selectedObject.type !== 'player') return;
        if (e.target.checked) {
            if (!selectedObject.powers.includes(e.target.value)) {
                selectedObject.powers.push(e.target.value);
            }
        } else {
            selectedObject.powers = selectedObject.powers.filter(w => w !== e.target.value);
        }
    });
});

document.getElementById('btn-delete-obj').addEventListener('click', () => {
    if (!selectedObject) return;
    objects = objects.filter(o => o !== selectedObject);
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
        let clicked = null;
        let isPlayer = false;
        
        if (Math.abs(wPos.x - playerStart.x) <= 1 && Math.abs(wPos.z - playerStart.z) <= 1) {
            isPlayer = true;
        } else {
            for(let i = objects.length - 1; i >= 0; i--) {
                let o = objects[i];
                if (wPos.x >= o.x - o.w/2 && wPos.x <= o.x + o.w/2 &&
                    wPos.z >= o.z - o.d/2 && wPos.z <= o.z + o.d/2) {
                    clicked = o;
                    break;
                }
            }
        }
        
        if (isPlayer) {
            selectObject(playerStart);
            dragStart = { type: 'player' };
        } else {
            selectObject(clicked);
            if (clicked) {
                dragStart = { type: 'object', obj: clicked };
            }
        }
    } else if (currentTool === 'block') {
        let obj = {
            id: generateId(),
            type: 'block',
            x: wPos.x, z: wPos.z, w: 2, d: 2, h: 5, // Doom style walls are tall
            color: '#888888',
            breakable: false,
            hp: 100,
            textureBase64: null
        };
        objects.push(obj);
        selectObject(obj);
    } else if (currentTool === 'player') {
        playerStart.x = wPos.x;
        playerStart.z = wPos.z;
        selectObject(playerStart);
        drawCanvas();
    } else if (currentTool === 'mover' || currentTool === 'tank') {
        let obj = {
            id: generateId(),
            type: currentTool,
            x: wPos.x, z: wPos.z, w: 2, d: 2, h: 2,
            hp: currentTool==='tank'?2000:150,
            damage: 10,
            speed: currentTool==='tank'?0:4,
            aiType: 'basic_chaser',
            customAIScript: '',
            modelBase64: null
        };
        objects.push(obj);
        selectObject(obj);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    
    if (currentTool === 'select' && dragStart) {
        const rect = canvas.getBoundingClientRect();
        let wPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        wPos.x = Math.round(wPos.x / 2) * 2;
        wPos.z = Math.round(wPos.z / 2) * 2;
        
        if (dragStart.type === 'player') {
            playerStart.x = wPos.x;
            playerStart.z = wPos.z;
        } else if (dragStart.type === 'object') {
            dragStart.obj.x = wPos.x;
            dragStart.obj.z = wPos.z;
            
            if (selectedObject === dragStart.obj) {
                document.getElementById('prop-x').value = wPos.x;
                document.getElementById('prop-z').value = wPos.z;
            }
        }
        drawCanvas();
    }
});

canvas.addEventListener('mouseup', (e) => {
    isMouseDown = false;
    dragStart = null;
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
    
    // Draw Objects
    objects.forEach(o => {
        let sc = worldToScreen(o.x, o.z);
        let sw = (o.w / 2) * CELL_SIZE;
        let sd = (o.d / 2) * CELL_SIZE;
        
        ctx.fillStyle = o.color || (o.type==='mover'?'#0ff':'#f0f');
        ctx.strokeStyle = (selectedObject === o) ? '#fff' : '#000';
        ctx.lineWidth = (selectedObject === o) ? 3 : 1;
        
        if (o.type === 'block') {
            ctx.fillRect(sc.cx - sw, sc.cy - sd, sw*2, sd*2);
            ctx.strokeRect(sc.cx - sw, sc.cy - sd, sw*2, sd*2);
        } else {
            ctx.beginPath();
            ctx.arc(sc.cx, sc.cy, CELL_SIZE/2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        }
    });
    
    // Draw drag preview removed as blocks are single-click now
    
    // Draw Player
    let psc = worldToScreen(playerStart.x, playerStart.z);
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(psc.cx, psc.cy, CELL_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
}

// Save & Load
function saveMapData() {
    let finalSave = {
        objects: objects,
        playerStart: playerStart
    };
    try {
        localStorage.setItem('customMapV3', JSON.stringify(finalSave));
        return true;
    } catch(e) {
        alert("Failed to save map! If you uploaded very large 3D models, they might exceed localStorage quota.");
        return false;
    }
}

document.getElementById('btn-save').addEventListener('click', () => {
    if(saveMapData()) {
        let btn = document.getElementById('btn-save');
        let oldText = btn.innerText;
        btn.innerText = "Saved!";
        setTimeout(() => btn.innerText = oldText, 1500);
    }
});

document.getElementById('btn-save-play').addEventListener('click', () => {
    if(saveMapData()) {
        window.location.href = 'index.html';
    }
});

document.getElementById('btn-clear').addEventListener('click', () => {
    objects = [];
    selectObject(null);
    updateOutliner();
    drawCanvas();
});

document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Load existing
const existing = localStorage.getItem('customMapV3');
if (existing) {
    try {
        let parsed = JSON.parse(existing);
        objects = parsed.objects || [];
        if (parsed.playerStart) {
            playerStart = { ...playerStart, ...parsed.playerStart };
            playerStart.type = 'player'; // Ensure type is present for older saves
            if (!playerStart.weapons) playerStart.weapons = ['Pistol'];
            if (!playerStart.powers) playerStart.powers = [];
            if (!playerStart.hp) playerStart.hp = 100;
            if (!playerStart.speed) playerStart.speed = 8.0;
            if (!playerStart.jumpVelocity) playerStart.jumpVelocity = 14.0;
        }
    } catch(e) {}
}

updateOutliner();
drawCanvas();
