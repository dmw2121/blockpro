/* ==========================================================================
   BLOCK MASTER PRO - CORE GAME ENGINE
   ========================================================================== */

// 1. SHAPE LIBRARY (2x2, 3x3, I4, I3, I2, 5-L, 4-L, 4-Z)
const SHAPES = [
    // 2x2 square
    { matrix: [[1, 1], [1, 1]], name: "Square 2x2" },
    
    // 3x3 square
    { matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], name: "Square 3x3" },
    
    // 4-block line (Horizontal & Vertical)
    { matrix: [[1, 1, 1, 1]], name: "I4 Horizontal" },
    { matrix: [[1], [1], [1], [1]], name: "I4 Vertical" },
    
    // 3-block line (Horizontal & Vertical)
    { matrix: [[1, 1, 1]], name: "I3 Horizontal" },
    { matrix: [[1], [1], [1]], name: "I3 Vertical" },
    
    // 2-block line (Horizontal & Vertical)
    { matrix: [[1, 1]], name: "I2 Horizontal" },
    { matrix: [[1], [1]], name: "I2 Vertical" },
    
    // 5-block L (Giant L, all 4 directions)
    { matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], name: "Giant L 1" },
    { matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], name: "Giant L 2" },
    { matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], name: "Giant L 3" },
    { matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], name: "Giant L 4" },
    
    // 4-block L (Standard L, all 4 directions)
    { matrix: [[1, 0], [1, 0], [1, 1]], name: "L-Block 1" },
    { matrix: [[1, 1, 1], [1, 0, 0]], name: "L-Block 2" },
    { matrix: [[1, 1], [0, 1], [0, 1]], name: "L-Block 3" },
    { matrix: [[0, 0, 1], [1, 1, 1]], name: "L-Block 4" },
    
    // 4-block J (Standard J/Mirrored L, all 4 directions)
    { matrix: [[0, 1], [0, 1], [1, 1]], name: "J-Block 1" },
    { matrix: [[1, 0, 0], [1, 1, 1]], name: "J-Block 2" },
    { matrix: [[1, 1], [1, 0], [1, 0]], name: "J-Block 3" },
    { matrix: [[1, 1, 1], [0, 0, 1]], name: "J-Block 4" },
    
    // 4-block Z (all directions)
    { matrix: [[1, 1, 0], [0, 1, 1]], name: "Z-Block 1" },
    { matrix: [[0, 1], [1, 1], [1, 0]], name: "Z-Block 2" },
    
    // 4-block S (mirrored Z, all directions)
    { matrix: [[0, 1, 1], [1, 1, 0]], name: "S-Block 1" },
    { matrix: [[1, 0], [1, 1], [0, 1]], name: "S-Block 2" }
];

// GAME STATE
let board = Array(8).fill(null).map(() => Array(8).fill(0));
let score = 0;
let highScore = 0;
let linesCleared = 0;
let themeIndex = 0;
let comboCount = 0;
let movesSinceLastClear = 0;
let sfxEnabled = true;
let musicEnabled = false;
let premiumUnlocked = false;
let dockShapes = [null, null, null];
let historyStack = []; // Max 5 items
let draggingState = null;

// PARTICLE ENGINE (DORMANT CANVAS ENGINE)
const canvas = document.getElementById("effects-canvas");
const ctx = canvas.getContext("2d");
let particles = [];
let isAnimationRunning = false;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

// SCORE ANIMATION STATE
let displayedScore = 0;
let scoreAnimFrame = null;

// AUDIO ENGINE (Web Audio API — zero dependencies)
const AudioEngine = (() => {
    let ctx_a = null;
    function init() {
        if (!ctx_a) ctx_a = new (window.AudioContext || window.webkitAudioContext)();
    }
    function tone(freq, type, gain, dur, startTime) {
        // Create nodes
        const filter = ctx_a.createBiquadFilter();
        const gainNode = ctx_a.createGain();
        
        filter.type = 'lowpass';
        // Pluck sweep: filter starts high and sweeps down rapidly to freq * 1.5
        filter.frequency.setValueAtTime(freq * 5, startTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + Math.min(0.08, dur * 0.5));
        filter.Q.setValueAtTime(4, startTime); // Subtle resonance peak

        // Two detuned oscillators for rich chorus-like thickness
        const osc1 = ctx_a.createOscillator();
        const osc2 = ctx_a.createOscillator();
        
        osc1.type = type;
        osc2.type = type;
        
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq, startTime);
        
        // Detune by +/- 6 cents
        osc1.detune.setValueAtTime(-6, startTime);
        osc2.detune.setValueAtTime(6, startTime);
        
        // Connections
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx_a.destination);
        
        // ADSR Gain Envelope
        const attack = 0.005; // 5ms click transient
        const decay = Math.min(0.03, dur * 0.3);
        const sustainVal = gain * 0.5;
        const release = Math.min(0.06, dur * 0.4);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(gain, startTime + attack);
        gainNode.gain.exponentialRampToValueAtTime(sustainVal, startTime + attack + decay);
        gainNode.gain.setValueAtTime(sustainVal, startTime + Math.max(attack + decay, dur - release));
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        
        // Start and stop
        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + dur + 0.02);
        osc2.stop(startTime + dur + 0.02);
    }
    return {
        // Soft woody block landing click ("Woody Knock")
        place() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                // Woody woodblock tock sound using pitch-sweep triangle
                const osc = ctx_a.createOscillator();
                const gainNode = ctx_a.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(320, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
                gainNode.gain.setValueAtTime(0.2, t);
                gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                osc.connect(gainNode);
                gainNode.connect(ctx_a.destination);
                osc.start(t);
                osc.stop(t + 0.06);

                // High click transient
                const click = ctx_a.createOscillator();
                const clickGain = ctx_a.createGain();
                click.type = 'sine';
                click.frequency.setValueAtTime(2400, t);
                clickGain.gain.setValueAtTime(0.08, t);
                clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.005);
                click.connect(clickGain);
                clickGain.connect(ctx_a.destination);
                click.start(t);
                click.stop(t + 0.01);
            } catch(e) {}
        },
        // Satisfying cascading glass bubble pop on line clear (1-2 lines)
        clear() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                // High-pitched crystal glass bubble pop sound
                const freqs = [1600, 2000, 2400, 2800];
                freqs.forEach((f, i) => {
                    const osc = ctx_a.createOscillator();
                    const gainNode = ctx_a.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, t + i * 0.02);
                    gainNode.gain.setValueAtTime(0.12, t + i * 0.02);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, t + i * 0.02 + 0.08);
                    osc.connect(gainNode);
                    gainNode.connect(ctx_a.destination);
                    osc.start(t + i * 0.02);
                    osc.stop(t + i * 0.02 + 0.1);
                });
            } catch(e) {}
        },
        // Melodic arpeggiated chime progression on 3 lines clear
        combo() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                // Arpeggiated chime progression
                [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
                    tone(f, 'sine', 0.2, 0.3, t + i * 0.06);
                    tone(f * 1.5, 'sine', 0.06, 0.2, t + i * 0.06 + 0.01);
                });
            } catch(e) {}
        },
        // Epic ascending pentatonic chime sweep on 4 lines clear (Ultra)
        ultra() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                // Ascending melodic kalimba sweep
                [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50].forEach((f, i) => {
                    tone(f, 'sine', 0.22, 0.4, t + i * 0.05);
                    tone(f * 2, 'sine', 0.08, 0.25, t + i * 0.05 + 0.015);
                });
            } catch(e) {}
        },
        // Progressive combo sound scaling with pentatonic scale
        comboProgressive(comboIndex) {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                // Pentatonic scale frequencies
                const scale = [
                    261.63, 293.66, 329.63, 392.00, 440.00, // C4, D4, E4, G4, A4
                    523.25, 587.33, 659.25, 783.99, 880.00, // C5, D5, E5, G5, A5
                    1046.50, 1174.66, 1318.51, 1567.98, 1760.00, // C6, D6, E6, G6, A6
                    2093.00
                ];
                // Resolve note index based on combo count (first combo starts at index 0)
                const noteIdx = Math.min(comboIndex - 2, scale.length - 1);
                const freq = scale[noteIdx];
                
                // Play melodic kalimba chime: fundamental + overtones
                tone(freq, 'sine', 0.25, 0.45, t);
                tone(freq * 1.5, 'sine', 0.1, 0.35, t + 0.01); // 5th harmonic
                tone(freq * 2.0, 'sine', 0.08, 0.25, t + 0.02); // octave harmonic
            } catch(e) {}
        },
        // Sad descending game over
        gameOver() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                [440, 370, 311, 262].forEach((f, i) => tone(f, 'sawtooth', 0.18, 0.25, t + i * 0.18));
            } catch(e) {}
        },
        initContext() {
            try {
                init();
                if (ctx_a && ctx_a.state === 'suspended') {
                    ctx_a.resume();
                }
            } catch(e) {}
        },
        getContext() {
            return ctx_a;
        }
    };
})();

// HTML ELEMENTS
const boardEl = document.getElementById("game-board");
const currentScoreEl = document.getElementById("current-score");
const highScoreEl = document.getElementById("high-score");
const linesClearedEl = document.getElementById("lines-cleared");
const undoBtn = document.getElementById("undo-btn");
const restartBtn = document.getElementById("restart-btn");

// INITIALIZE BOARD GRID DOM
function initBoardDOM() {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.dataset.row = r;
            cell.dataset.col = c;
            boardEl.appendChild(cell);
        }
    }
}

// RENDER BOARD MATRIX TO DOM
function renderBoard() {
    const cells = boardEl.querySelectorAll(".grid-cell");
    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        const val = board[r][c];
        
        cell.className = "grid-cell"; // reset class
        cell.style.backgroundColor = "";
        
        if (val > 0) {
            cell.classList.add("filled", `block-color-${val}`);
            cell.style.backgroundColor = `var(--theme-color-${val})`;
        }
    });
}

// 3. DIRTY START ALGORITHM (Custom puzzle layout to allow full clear with 2x2 shape)
function fillBoardDirty() {
    // Reset board array
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    
    // Fill the puzzle layout (Rows 0-5 Cols 6-7, and Rows 6-7 Cols 0-5)
    // Rows 0-5, Cols 6-7
    for (let r = 0; r <= 5; r++) {
        board[r][6] = 3;
        board[r][7] = 3;
    }
    // Rows 6-7, Cols 0-5
    for (let c = 0; c <= 5; c++) {
        board[6][c] = 3;
        board[7][c] = 3;
    }
}

// DOCK SHAPE GENERATOR
function generateNewDockShapes() {
    // Check if this is the very first turn of a new game (zero score)
    const isFirstTurn = score === 0;
    if (isFirstTurn) {
        const fixedShapes = [
            { matrix: [[1, 1], [1, 1]], name: "Square 2x2", colorIndex: 3 },                  // Yellow 2x2
            { matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], name: "Square 3x3", colorIndex: 3 },  // Yellow 3x3
            { matrix: [[1, 1, 1, 1]], name: "I4 Horizontal", colorIndex: 3 }                  // Yellow 4-line
        ];
        for (let i = 0; i < 3; i++) {
            dockShapes[i] = fixedShapes[i];
        }
        renderDock(); // Render immediately to make the starting blocks visible!
        return;
    }

    for (let i = 0; i < 3; i++) {
        const randomShapeIdx = Math.floor(Math.random() * SHAPES.length);
        const shapeDef = SHAPES[randomShapeIdx];
        const randomColor = 1 + Math.floor(Math.random() * 4);
        
        dockShapes[i] = {
            matrix: shapeDef.matrix,
            name: shapeDef.name,
            colorIndex: randomColor
        };
    }
    
    // Ensure at least one shape is placeable if possible
    const anyPlaceable = dockShapes.some(shape => canPlaceShape(shape.matrix));
    if (!anyPlaceable) {
        const placeableShapes = SHAPES.filter(shape => canPlaceShape(shape.matrix));
        if (placeableShapes.length > 0) {
            // Replace the first slot with a placeable shape
            const randIdx = Math.floor(Math.random() * placeableShapes.length);
            const shapeDef = placeableShapes[randIdx];
            const randomColor = 1 + Math.floor(Math.random() * 4);
            dockShapes[0] = {
                matrix: shapeDef.matrix,
                name: shapeDef.name,
                colorIndex: randomColor
            };
        }
    }
    
    renderDock();
}

// RENDER DOCK SHAPES TO SLOTS
function renderDock() {
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`slot-${i}`);
        slot.innerHTML = "";
        
        const shape = dockShapes[i];
        if (!shape) {
            slot.classList.add("empty");
            continue;
        }
        
        slot.classList.remove("empty");
        
        const shapeEl = document.createElement("div");
        shapeEl.className = "dock-shape";
        
        const rows = shape.matrix.length;
        const cols = shape.matrix[0].length;
        shapeEl.style.gridTemplateRows = `repeat(${rows}, var(--dock-cell-size))`;
        shapeEl.style.gridTemplateColumns = `repeat(${cols}, var(--dock-cell-size))`;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement("div");
                cell.className = "dock-shape-cell";
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                if (shape.matrix[r][c] === 1) {
                    cell.classList.add("filled", `block-color-${shape.colorIndex}`);
                    cell.style.backgroundColor = `var(--theme-color-${shape.colorIndex})`;
                } else {
                    cell.style.visibility = "hidden";
                }
                shapeEl.appendChild(cell);
            }
        }
        slot.appendChild(shapeEl);
    }
}

// THEME SYSTEM (8 Premium Themes: 4 Light [0-3], 4 Dark [4-7])
function applyTheme(index) {
    themeIndex = index;
    document.body.className = "";
    document.body.classList.add(`theme-${themeIndex}`);
    updateThemePickerActive();
}

function nextTheme() {
    let nextIdx = (themeIndex + 1) % 8;
    applyTheme(nextIdx);
}

// 4. UNDO HISTORY MECHANISM (Max 5 steps)
function saveToHistory() {
    const state = {
        board: JSON.parse(JSON.stringify(board)),
        score: score,
        linesCleared: linesCleared,
        dockShapes: JSON.parse(JSON.stringify(dockShapes)),
        themeIndex: themeIndex,
        comboCount: comboCount,
        movesSinceLastClear: movesSinceLastClear
    };
    
    historyStack.push(state);
    if (historyStack.length > 5) {
        historyStack.shift();
    }
    updateUndoUI();
}

function updateUndoUI() {
    const badge = document.getElementById("undo-badge");
    badge.textContent = `${historyStack.length}/5`;
    if (historyStack.length === 0) {
        undoBtn.classList.add("disabled");
        undoBtn.style.opacity = "0.5";
        undoBtn.style.pointerEvents = "none";
    } else {
        undoBtn.classList.remove("disabled");
        undoBtn.style.opacity = "1";
        undoBtn.style.pointerEvents = "auto";
    }
}

function performUndo() {
    if (historyStack.length === 0) return;
    
    const prevState = historyStack.pop();
    board = prevState.board;
    score = prevState.score;
    linesCleared = prevState.linesCleared;
    dockShapes = JSON.parse(JSON.stringify(prevState.dockShapes));
    themeIndex = prevState.themeIndex;
    comboCount = prevState.comboCount;
    movesSinceLastClear = prevState.movesSinceLastClear;
    
    applyTheme(themeIndex);
    renderBoard();
    renderDock();
    updateUI();
    updateUndoUI();
    
    // Hide game over overlay if visible
    document.getElementById("game-over-overlay").classList.add("hidden");
}

// UPDATE CORE STATS ON SCREEN
// SCORE TICK-UP ANIMATION
function animateScoreTo(target) {
    if (scoreAnimFrame) cancelAnimationFrame(scoreAnimFrame);
    const start = displayedScore;
    const diff = target - start;
    if (diff === 0) return;
    const duration = Math.min(600, 80 + Math.abs(diff) * 0.3); // ms, capped at 600ms
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        displayedScore = Math.round(start + diff * eased);
        currentScoreEl.textContent = displayedScore;
        if (progress < 1) {
            scoreAnimFrame = requestAnimationFrame(step);
        } else {
            displayedScore = target;
            currentScoreEl.textContent = target;
        }
    }
    scoreAnimFrame = requestAnimationFrame(step);
}

function updateUI() {
    animateScoreTo(score);
    highScoreEl.textContent = highScore;
    linesClearedEl.textContent = linesCleared;
}

// 8. DORMANT CANVAS ENGINE (Particles on Line Clear & Placement)
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}

function spawnExplosion(row, col, color, count = 1, sizeMultiplier = 1.0, restrictType = "none") {
    const rect = canvas.getBoundingClientRect();
    const cellW = rect.width / 8;
    const cellH = rect.height / 8;
    
    const startX = col * cellW + cellW / 2;
    const startY = row * cellH + cellH / 2;
    
    let minY = 0, maxY = rect.height, minX = 0, maxX = rect.width;
    if (restrictType === "row") {
        minY = row * cellH;
        maxY = (row + 1) * cellH;
    } else if (restrictType === "col") {
        minX = col * cellW;
        maxX = (col + 1) * cellW;
    } else if (restrictType === "cell") {
        minY = row * cellH;
        maxY = (row + 1) * cellH;
        minX = col * cellW;
        maxX = (col + 1) * cellW;
    }
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.5 + Math.random() * 4.5) * sizeMultiplier;
        particles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (2.5 + Math.random() * 4.5) * sizeMultiplier,
            color: color,
            alpha: 1,
            decay: 0.018 + Math.random() * 0.018,
            gravity: restrictType === "row" || restrictType === "cell" ? 0.01 : 0.09, // lower gravity for horizontal/cell channels
            trail: sizeMultiplier > 1.5, // large particles get trail effect
            minX, maxX, minY, maxY,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.15
        });
    }

    if (!isAnimationRunning) {
        isAnimationRunning = true;
        requestAnimationFrame(updateParticles);
    }
}

// MEGA FIREWORKS for 3x / 4x simultaneous line clears
function spawnMegaFireworks(linesCount) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const colors = ['#FFD700','#FF4444','#00F0FF','#00FF88','#FF69B4','#FFA500','#A855F7','#FFFFFF'];
    const bursts = linesCount >= 4 ? 6 : 4;
    const particlesPerBurst = linesCount >= 4 ? 30 : 20;
    const sizeMult = linesCount >= 4 ? 2.5 : 1.8;
    
    for (let b = 0; b < bursts; b++) {
        const bx = cx + (Math.random() - 0.5) * rect.width * 0.7;
        const by = cy + (Math.random() - 0.5) * rect.height * 0.6;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        setTimeout(() => {
            for (let i = 0; i < particlesPerBurst; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = (2 + Math.random() * 6) * sizeMult;
                particles.push({
                    x: bx, y: by,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: (3 + Math.random() * 5) * sizeMult,
                    color: color,
                    alpha: 1,
                    decay: 0.012 + Math.random() * 0.012,
                    gravity: 0.07,
                    trail: true
                });
            }
            if (!isAnimationRunning) {
                isAnimationRunning = true;
                requestAnimationFrame(updateParticles);
            }
        }, b * 120);
    }
}

function updateParticles() {
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity; // Gravity pull downwards
        p.alpha -= p.decay;
        if (p.rotation !== undefined) {
            p.rotation += p.rotationSpeed;
        }
        
        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        // Keep explosion inside line/cell boundaries with elastic bouncing
        if (p.minX !== undefined && p.x - p.size < p.minX) {
            p.x = p.minX + p.size;
            p.vx = -p.vx * 0.5;
        } else if (p.maxX !== undefined && p.x + p.size > p.maxX) {
            p.x = p.maxX - p.size;
            p.vx = -p.vx * 0.5;
        }
        
        if (p.minY !== undefined && p.y - p.size < p.minY) {
            p.y = p.minY + p.size;
            p.vy = -p.vy * 0.5;
        } else if (p.maxY !== undefined && p.y + p.size > p.maxY) {
            p.y = p.maxY - p.size;
            p.vy = -p.vy * 0.5;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        if (p.trail) {
            // Glowing star shape for mega bursts
            ctx.shadowBlur = p.size * 3;
            ctx.shadowColor = p.color;
        }
        
        // Translate to particle center and rotate
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) {
            ctx.rotate(p.rotation);
        }
        
        // Draw square/block debris particle
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
        
        // Add a subtle 3D highlight edge to each block debris particle
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 0.3); // Top highlight edge
        ctx.fillRect(-p.size, -p.size, p.size * 0.3, p.size * 2); // Left highlight edge
        
        ctx.restore();
    }

    // Stop execution context loop if no particles left (Dormant Engine state)
    if (particles.length > 0) {
        requestAnimationFrame(updateParticles);
    } else {
        isAnimationRunning = false;
        ctx.clearRect(0, 0, width, height);
        console.log("[CANVAS] Particles clean. Entering Dormant State (0% CPU)");
    }
}

// GAME OVER CHECKING
function canPlaceShape(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    
    for (let br = 0; br <= 8 - rows; br++) {
        for (let bc = 0; bc <= 8 - cols; bc++) {
            let fits = true;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (matrix[r][c] === 1) {
                        if (board[br + r][bc + c] !== 0) {
                            fits = false;
                            break;
                        }
                    }
                }
                if (!fits) break;
            }
            if (fits) return true;
        }
    }
    return false;
}

function checkGameOver() {
    let canPlaceAny = false;
    
    for (let i = 0; i < 3; i++) {
        const shape = dockShapes[i];
        if (shape) {
            if (canPlaceShape(shape.matrix)) {
                canPlaceAny = true;
                break;
            }
        }
    }
    
    if (!canPlaceAny && dockShapes.some(s => s !== null)) {
        const isNewRecord = score > highScore;
        if (isNewRecord) {
            highScore = score;
            localStorage.setItem('blockmaster_highscore', String(highScore));
        }
        
        AudioEngine.gameOver();
        
        // Trigger the sad crumble dispersal and fade effects on the board
        const boardGrid = document.getElementById('game-board');
        if (boardGrid) {
            boardGrid.classList.add('game-over-fade');
        }
        const shapesDock = document.getElementById('shapes-dock');
        if (shapesDock) {
            shapesDock.classList.add('game-over-fade');
        }
        const headerEl = document.querySelector('.game-header');
        if (headerEl) {
            headerEl.classList.add('game-over-fade');
        }
        
        // Apply disperse classes with random parameters to all filled cells
        const filledCells = boardEl.querySelectorAll('.grid-cell.filled');
        filledCells.forEach(cell => {
            const randX = (Math.random() - 0.5) * 180; // drift left/right
            const randY = 300 + Math.random() * 250;   // fall down (gravity)
            const randR = (Math.random() - 0.5) * 450; // spin random degrees
            const delay = Math.random() * 0.4;         // staggered fall delay
            
            cell.style.setProperty('--disperse-x', `${randX}px`);
            cell.style.setProperty('--disperse-y', `${randY}px`);
            cell.style.setProperty('--disperse-r', `${randR}deg`);
            cell.style.animationDelay = `${delay}s`;
            cell.classList.add('disperse');
        });
        
        // Pick a random philosophical motivation quote
        const MOTIVATIONAL_QUOTES = [
            "\"Yenilgi, daha zekice başlama fırsatından başka bir şey değildir.\" — Henry Ford",
            "\"Düşmek hata değildir; düşüp kalmak hatadır.\" — Aristoteles",
            "\"Engeller, gözünüzü hedeften ayırdığınızda gördüğünüz korkunç şeylerdir.\" — Henry Ford",
            "\"Hayat bisiklete binmek gibidir, dengeyi korumak için hareket etmeye devam etmelisin.\" — Albert Einstein",
            "\"En büyük zaferimiz hiç düşmemek değil, her düştüğümüzde ayağa kalkmaktır.\" — Konfüçyüs",
            "\"Zorluklar, yetenekleri ortaya çıkarır.\" — Horatius",
            "\"Hiçbir şey bitmiş değildir, ta ki sen vazgeçene kadar.\" — Anonim",
            "\"Yara, ışığın içeri girdiği yerdir.\" — Mevlana",
            "\"Gideceği limanı bilmeyene hiçbir rüzgardan fayda gelmez.\" — Seneca",
            "\"Bugün yapacağın her hamle, yarının temelidir.\" — Zen Felsefesi",
            "\"Karanlığı lanetlemektense bir mum yakın.\" — Konfüçyüs",
            "\"Bir kez daha dene. Bir kez daha yenil. Daha iyi yenil.\" — Samuel Beckett",
            "\"Başarı, hevesini kaybetmeden başarısızlıktan başarısızlığa koşmaktır.\" — Winston Churchill",
            "\"Gelecek, bugünden hazırlananlara aittir.\" — Malcolm X"
        ];
        const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        const motivationEl = document.getElementById('go-motivation');
        if (motivationEl) {
            motivationEl.textContent = randomQuote;
        }
        
        // Fill game over screen
        document.getElementById('game-over-score').textContent = score;
        document.getElementById('game-over-high').textContent = highScore;
        document.getElementById('go-lines').textContent = linesCleared;
        
        const newRecordEl = document.getElementById('go-new-record');
        if (isNewRecord) {
            newRecordEl.classList.remove('hidden');
            document.getElementById('go-emoji').textContent = '🏆';
            document.getElementById('go-subtitle').textContent = 'Yeni Rekor!';
            // launch confetti for new record
            startConfetti();
        } else {
            newRecordEl.classList.add('hidden');
            document.getElementById('go-emoji').textContent = '🥺';
            document.getElementById('go-subtitle').textContent = 'Daha fazla hamle kalmadı...';
            stopConfetti();
        }
        
        // Stagger showing the game-over dialog after dispersion finishes (3.6s delay)
        setTimeout(() => {
            document.getElementById('game-over-overlay').classList.remove('hidden');
        }, 3600);
    }
}


// FLOATING SCORE POPUPS (spawns gold points text that floats up and fades out)
function spawnFloatingText(text, row, col) {
    const boardContainer = document.querySelector(".board-container");
    const cellEl = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!boardContainer || !cellEl) return;
    
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    
    // Position exactly at the center of the cell relative to board-container
    const left = cellRect.left - boardRect.left + cellRect.width / 2;
    const top = cellRect.top - boardRect.top + cellRect.height / 2;
    
    const floatingEl = document.createElement("div");
    
    // Check if it's a multiplier/combo indicator (ends with 'x')
    if (text.endsWith("x")) {
        floatingEl.className = "floating-score floating-multiplier";
    } else {
        floatingEl.className = "floating-score";
    }
    
    floatingEl.textContent = text;
    floatingEl.style.left = `${left}px`;
    floatingEl.style.top = `${top}px`;
    floatingEl.style.transform = "translate(-50%, -50%)";
    
    boardContainer.appendChild(floatingEl);
    
    // Remove element after animation finishes
    setTimeout(() => {
        floatingEl.remove();
    }, 850);
}

// ROW AND COLUMN CLEARING LOGIC (With combo calculations)
function checkLinesAndClear() {
    let completedRows = [];
    let completedCols = [];
    
    // Check rows
    for (let r = 0; r < 8; r++) {
        let full = true;
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === 0) {
                full = false;
                break;
            }
        }
        if (full) completedRows.push(r);
    }
    
    // Check columns
    for (let c = 0; c < 8; c++) {
        let full = true;
        for (let r = 0; r < 8; r++) {
            if (board[r][c] === 0) {
                full = false;
                break;
            }
        }
        if (full) completedCols.push(c);
    }
    
    const linesCount = completedRows.length + completedCols.length;
    if (linesCount > 0) {
        // Trigger board screen shake for satisfying impact feedback
        boardEl.classList.remove("shake-board");
        boardEl.offsetHeight; // force reflow
        boardEl.classList.add("shake-board");
        setTimeout(() => {
            boardEl.classList.remove("shake-board");
        }, 150);

        // Increment consecutive combo multiplier (capped at 50x)
        comboCount++;
        if (comboCount > 50) {
            comboCount = 50;
        }
        movesSinceLastClear = 0;
        
        // Collect coordinates of cells being cleared
        const cellsToClear = new Set();
        completedRows.forEach(r => {
            for (let c = 0; c < 8; c++) cellsToClear.add(`${r},${c}`);
        });
        completedCols.forEach(c => {
            for (let r = 0; r < 8; r++) cellsToClear.add(`${r},${c}`);
        });
        
        // Spawn particle explosions for each clearing cell
        const isMegaClear = linesCount >= 3;
        cellsToClear.forEach(key => {
            const [r, c] = key.split(",").map(Number);
            const val = board[r][c];
            if (val > 0) {
                const colorStr = getComputedStyle(document.body).getPropertyValue(`--theme-color-${val}`).trim() || "#ffffff";
                const count = isMegaClear ? 2 : 1;
                const sizeMult = linesCount >= 4 ? 2.0 : linesCount >= 3 ? 1.5 : 1.0;
                
                // Restrict explosion bounds within the clearing rows/columns
                let restrictType = "none";
                const inRow = completedRows.includes(r);
                const inCol = completedCols.includes(c);
                if (inRow && inCol) {
                    restrictType = "cell"; // Intersection cell boundary
                } else if (inRow) {
                    restrictType = "row";  // Horizontal row boundary
                } else if (inCol) {
                    restrictType = "col";  // Vertical column boundary
                }
                
                spawnExplosion(r, c, colorStr, count, sizeMult, restrictType);
            }
        });
        

        
        // Clear cells in matrix array
        completedRows.forEach(r => {
            for (let c = 0; c < 8; c++) board[r][c] = 0;
        });
        completedCols.forEach(c => {
            for (let r = 0; r < 8; r++) board[r][c] = 0;
        });
        
        // Base Score formula scaled down by 10 (10 katları değil 1 li olacak)
        let scoreGain = linesCount * 10 * linesCount;
        if (linesCount >= 4) {
            scoreGain = Math.round(scoreGain * 4);
        } else if (linesCount >= 3) {
            scoreGain = Math.round(scoreGain * 3);
        }
        
        // Apply consecutive combo multiplier if active
        if (comboCount >= 2) {
            scoreGain = scoreGain * comboCount;
            AudioEngine.comboProgressive(comboCount);
            triggerPunchyComboAnimation(comboCount);
        } else {
            // Normal audio signals
            if (linesCount >= 4) {
                AudioEngine.ultra();
            } else if (linesCount >= 3) {
                AudioEngine.combo();
            } else {
                AudioEngine.clear();
            }
        }
        
        score += scoreGain;

        // Spawn flying score popup for lines cleared
        let midR = 3;
        let midC = 3;
        if (completedRows.length > 0) midR = completedRows[Math.floor(completedRows.length / 2)];
        if (completedCols.length > 0) midC = completedCols[Math.floor(completedCols.length / 2)];
        spawnFloatingText(`+${scoreGain}`, midR, midC);
        
        // Spawn 2x, 3x, 4x popups on top of the cleared row/col if multiple lines cleared
        if (linesCount >= 2) {
            setTimeout(() => {
                spawnFloatingText(`${linesCount}x`, midR, midC);
            }, 180);
        }
        
        // Show combo badge on the score display
        showComboBadge(linesCount, scoreGain, comboCount);
        
        const oldLines = linesCleared;
        linesCleared += linesCount;
        
        // Check theme transition threshold (Every 20 cleared lines)
        const oldThreshold = Math.floor(oldLines / 20);
        const newThreshold = Math.floor(linesCleared / 20);
        if (newThreshold > oldThreshold) {
            nextTheme();
            triggerThemeBanner(themeIndex);
        }
        
        // Delayed board visual updates for explosion animations to render first
        setTimeout(() => {
            renderBoard();
            updateUI();
        }, 80);
    } else {
        // No line cleared this turn
        movesSinceLastClear++;
        if (movesSinceLastClear >= 3) {
            comboCount = 0;
        }
        updateUI();
    }
}

// COORDINATE RETRIEVAL HELPER
function getPointerCoords(e) {
    return { x: e.clientX, y: e.clientY };
}

// TARGET CELL ON BOARD RESOLUTION
function getTargetBoardCell(e) {
    const coords = getPointerCoords(e);
    let x = coords.x;
    let y = coords.y;
    
    if (e.pointerType === "touch") {
        y -= 120;
    }
    
    // Get cached board bounds
    const boardRect = (draggingState && draggingState.boardRect) ? draggingState.boardRect : boardEl.getBoundingClientRect();
    
    const left = boardRect.left;
    const top = boardRect.top;
    const width = boardRect.width;
    const height = boardRect.height;
    
    const cellW = width / 8;
    const cellH = height / 8;
    
    const relX = x - left;
    const relY = y - top;
    
    const thresholdX = cellW * 0.75;
    const thresholdY = cellH * 0.75;
    
    if (relX >= -thresholdX && relX < width + thresholdX &&
        relY >= -thresholdY && relY < height + thresholdY) {
        const col = Math.max(0, Math.min(7, Math.floor(relX / cellW)));
        const row = Math.max(0, Math.min(7, Math.floor(relY / cellH)));
        return { hoverR: row, hoverC: col };
    }
    
    return { hoverR: -1, hoverC: -1 };
}

// VALIDATE PLACEMENT ON BOARD
function checkPlacementValidity(shape, grabR, grabC, hoverR, hoverC) {
    const rows = shape.matrix.length;
    const cols = shape.matrix[0].length;
    
    const targetCells = [];
    let isValid = true;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (shape.matrix[r][c] === 1) {
                const boardR = hoverR + r - grabR;
                const boardC = hoverC + c - grabC;
                
                if (boardR >= 0 && boardR < 8 && boardC >= 0 && boardC < 8) {
                    targetCells.push({ r: boardR, c: boardC });
                    if (board[boardR][boardC] !== 0) {
                        isValid = false; // overlapping existing cell block
                    }
                } else {
                    isValid = false; // boundary overflow
                }
            }
        }
    }
    
    return { isValid, targetCells };
}

// HIGHLIGHT BOARD GRID HOVERS (with ghost block color preview)
function clearBoardHighlights() {
    boardEl.querySelectorAll(".grid-cell").forEach(cell => {
        cell.classList.remove("highlight-valid", "highlight-invalid", "highlight-ghost", "highlight-ghost-line");
        cell.style.removeProperty("--ghost-color");
        cell.style.removeProperty("filter");
    });
    const dragCloneEl = document.getElementById("drag-clone");
    if (dragCloneEl) {
        dragCloneEl.classList.remove("will-clear-lines");
    }
}

function calculateHighlights(e) {
    clearBoardHighlights();
    if (!draggingState) return;
    
    const { hoverR, hoverC } = getTargetBoardCell(e);
    if (hoverR === -1 || hoverC === -1) return;
    
    const { isValid, targetCells } = checkPlacementValidity(
        draggingState.shape,
        draggingState.grabR,
        draggingState.grabC,
        hoverR,
        hoverC
    );
    
    const colorVar = `var(--theme-color-${draggingState.shape.colorIndex})`;
    
    targetCells.forEach(cell => {
        const cellEl = boardEl.querySelector(`[data-row="${cell.r}"][data-col="${cell.c}"]`);
        if (cellEl) {
            if (isValid) {
                // Ghost: show actual block color semi-transparently
                cellEl.classList.add("highlight-ghost");
                cellEl.style.setProperty("--ghost-color", colorVar);
            } else {
                cellEl.classList.add("highlight-invalid");
            }
        }
    });

    // If placement is valid, predict and highlight completed rows/columns completely
    if (isValid && targetCells.length > 0) {
        // Create a simulated board state
        const tempBoard = board.map(row => [...row]);
        const shapeColorIndex = draggingState.shape.colorIndex;
        targetCells.forEach(cell => {
            tempBoard[cell.r][cell.c] = shapeColorIndex;
        });
        
        const completedRows = [];
        const completedCols = [];
        
        // Check rows
        for (let r = 0; r < 8; r++) {
            let full = true;
            for (let c = 0; c < 8; c++) {
                if (tempBoard[r][c] === 0) {
                    full = false;
                    break;
                }
            }
            if (full) completedRows.push(r);
        }
        
        // Check columns
        for (let c = 0; c < 8; c++) {
            let full = true;
            for (let r = 0; r < 8; r++) {
                if (tempBoard[r][c] === 0) {
                    full = false;
                    break;
                }
            }
            if (full) completedCols.push(c);
        }
        
        // Highlight completed lines entirely
        completedRows.forEach(r => {
            for (let c = 0; c < 8; c++) {
                const cellEl = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cellEl) cellEl.classList.add("highlight-ghost-line");
            }
        });
        completedCols.forEach(c => {
            for (let r = 0; r < 8; r++) {
                const cellEl = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cellEl) cellEl.classList.add("highlight-ghost-line");
            }
        });

        // Set drag clone color to gold if this placement clears lines
        const dragCloneEl = document.getElementById("drag-clone");
        if (dragCloneEl) {
            if (completedRows.length > 0 || completedCols.length > 0) {
                dragCloneEl.classList.add("will-clear-lines");
            } else {
                dragCloneEl.classList.remove("will-clear-lines");
            }
        }
    } else {
        const dragCloneEl = document.getElementById("drag-clone");
        if (dragCloneEl) {
            dragCloneEl.classList.remove("will-clear-lines");
        }
    }
}

// ATTEMPT SHAPE DEPOSITION
function attemptPlacement(e) {
    if (!draggingState) return false;
    
    const { hoverR, hoverC } = getTargetBoardCell(e);
    if (hoverR === -1 || hoverC === -1) return false;
    
    const { isValid, targetCells } = checkPlacementValidity(
        draggingState.shape,
        draggingState.grabR,
        draggingState.grabC,
        hoverR,
        hoverC
    );
    
    if (isValid && targetCells.length > 0) {
        // Save state BEFORE placement for precise Undo restoration
        saveToHistory();
        
        const shapeColorIndex = draggingState.shape.colorIndex;
        targetCells.forEach(cell => {
            board[cell.r][cell.c] = shapeColorIndex;
        });
        
        // Play placement sound
        AudioEngine.place();
        
        // 1 score point per block cell placed (10 katları değil 1 li olacak)
        const pointsGained = targetCells.length;
        score += pointsGained;
        
        // Spawn flying score popup for block placement
        const midCell = targetCells[Math.floor(targetCells.length / 2)];
        spawnFloatingText(`+${pointsGained}`, midCell.r, midCell.c);
        
        renderBoard();
        checkLinesAndClear();
        return true;
    }
    
    return false;
}

// POINTER EVENT DRAG SYSTEM
function initDragClone(shape, grabR, grabC) {
    const clone = document.getElementById("drag-clone");
    clone.innerHTML = "";
    
    // Measure actual cell dimensions dynamically
    let cellW = 54;
    let cellH = 54;
    const sampleCell = boardEl.querySelector(".grid-cell");
    if (sampleCell) {
        const rect = sampleCell.getBoundingClientRect();
        cellW = rect.width;
        cellH = rect.height;
    }
    
    const rows = shape.matrix.length;
    const cols = shape.matrix[0].length;
    clone.style.gridTemplateRows = `repeat(${rows}, ${cellH}px)`;
    clone.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement("div");
            cell.className = "drag-clone-cell";
            
            if (shape.matrix[r][c] === 1) {
                cell.classList.add("filled", `block-color-${shape.colorIndex}`);
                cell.style.backgroundColor = `var(--theme-color-${shape.colorIndex})`;
            } else {
                cell.style.visibility = "hidden";
            }
            clone.appendChild(cell);
        }
    }
    clone.classList.remove("hidden");
}

function updateDragClonePosition(e) {
    const clone = document.getElementById("drag-clone");
    const coords = getPointerCoords(e);
    let x = coords.x;
    let y = coords.y;
    
    if (e.pointerType === "touch") {
        y -= 120;  // same offset as getTargetBoardCell so ghost snaps correctly
    }
    
    // Use cached dimensions to prevent layout thrashing
    const cellW = draggingState ? draggingState.cellW : 54;
    const cellH = draggingState ? draggingState.cellH : 54;
    
    const grabR = draggingState ? draggingState.grabR : 0;
    const grabC = draggingState ? draggingState.grabC : 0;
    
    // Align visual clone matching board grid spaces and 0px gaps exactly
    const gapOffset = 0;
    const left = x - (grabC * (cellW + gapOffset) + cellW / 2);
    const top = y - (grabR * (cellH + gapOffset) + cellH / 2);
    
    clone.style.left = `${left}px`;
    clone.style.top = `${top}px`;
}

function hideDragClone() {
    document.getElementById("drag-clone").classList.add("hidden");
}

function onPointerDown(e) {
    const slotIndex = parseInt(this.id.split("-")[1]);
    const shape = dockShapes[slotIndex];
    if (!shape) return;
    
    // Resolve which cell within shape structure was touched
    let grabR = 0;
    let grabC = 0;
    const cellEl = e.target.closest(".dock-shape-cell");
    if (cellEl) {
        grabR = parseInt(cellEl.dataset.row) || 0;
        grabC = parseInt(cellEl.dataset.col) || 0;
    } else {
        grabR = Math.floor(shape.matrix.length / 2);
        grabC = Math.floor(shape.matrix[0].length / 2);
    }
    
    // Get cached board and cell bounds to completely prevent pointermove layout thrashing
    const boardRect = boardEl.getBoundingClientRect();
    let cellW = boardRect.width / 8;
    let cellH = boardRect.height / 8;
    
    draggingState = {
        slotIndex: slotIndex,
        shape: shape,
        grabR: grabR,
        grabC: grabC,
        pointerId: e.pointerId,
        boardRect: boardRect,
        cellW: cellW,
        cellH: cellH
    };
    
    // Hide dock element preview
    const dockShapeEl = this.querySelector(".dock-shape");
    if (dockShapeEl) {
        dockShapeEl.style.opacity = "0";
    }
    
    initDragClone(shape, grabR, grabC);
    updateDragClonePosition(e);
    
    this.setPointerCapture(e.pointerId);
    
    this.addEventListener("pointermove", onPointerMove);
    this.addEventListener("pointerup", onPointerUp);
    this.addEventListener("pointercancel", onPointerCancel);
}

function onPointerMove(e) {
    if (!draggingState || draggingState.pointerId !== e.pointerId) return;
    updateDragClonePosition(e);
    calculateHighlights(e);
}

function onPointerUp(e) {
    if (!draggingState || draggingState.pointerId !== e.pointerId) return;
    
    const slotEl = this;
    slotEl.releasePointerCapture(e.pointerId);
    slotEl.removeEventListener("pointermove", onPointerMove);
    slotEl.removeEventListener("pointerup", onPointerUp);
    slotEl.removeEventListener("pointercancel", onPointerCancel);
    
    const success = attemptPlacement(e);
    
    if (success) {
        dockShapes[draggingState.slotIndex] = null;
        renderDock();
        
        // If dock slots cleared, regenerate next batch of 3
        if (dockShapes.every(s => s === null)) {
            generateNewDockShapes();
        }
        
        checkGameOver();
    } else {
        // Re-show dock preview if placement aborted
        const dockShapeEl = slotEl.querySelector(".dock-shape");
        if (dockShapeEl) {
            dockShapeEl.style.opacity = "1";
        }
    }
    
    hideDragClone();
    clearBoardHighlights();
    draggingState = null;
}

function onPointerCancel(e) {
    if (!draggingState || draggingState.pointerId !== e.pointerId) return;
    
    const slotEl = this;
    slotEl.releasePointerCapture(e.pointerId);
    slotEl.removeEventListener("pointermove", onPointerMove);
    slotEl.removeEventListener("pointerup", onPointerUp);
    slotEl.removeEventListener("pointercancel", onPointerCancel);
    
    const dockShapeEl = slotEl.querySelector(".dock-shape");
    if (dockShapeEl) {
        dockShapeEl.style.opacity = "1";
    }
    
    hideDragClone();
    clearBoardHighlights();
    draggingState = null;
}

// GAME FLOW RESET / START
function startNewGame() {
    score = 0;
    displayedScore = 0;
    linesCleared = 0;
    comboCount = 0;
    movesSinceLastClear = 0;
    historyStack = [];
    stopConfetti();
    
    // Hide game over overlay and clear overlays
    document.getElementById("game-over-overlay").classList.add("hidden");
    
    // Reset game over fade classes
    const boardGrid = document.getElementById('game-board');
    if (boardGrid) {
        boardGrid.classList.remove('game-over-fade');
    }
    const shapesDock = document.getElementById('shapes-dock');
    if (shapesDock) {
        shapesDock.classList.remove('game-over-fade');
    }
    const headerEl = document.querySelector('.game-header');
    if (headerEl) {
        headerEl.classList.remove('game-over-fade');
    }
    
    const comboPop = document.getElementById("combo-pop-overlay");
    if (comboPop) {
        comboPop.classList.add("hidden");
        comboPop.classList.remove("animate");
    }
    const themeBanner = document.getElementById("theme-banner-overlay");
    if (themeBanner) {
        themeBanner.classList.add("hidden");
        themeBanner.classList.remove("animate");
    }
    
    applyTheme(0);
    fillBoardDirty();
    generateNewDockShapes();
    renderBoard();
    updateUI();
    updateUndoUI();

}

// SETUP CORE ENGINE CONNECTIONS
function initGame() {
    // High Score load — parse as integer, fallback 0
    highScore = parseInt(localStorage.getItem('blockmaster_highscore'), 10) || 0;
    
    // Load SFX and Music settings
    sfxEnabled = localStorage.getItem('blockmaster_sfx') !== 'false';
    musicEnabled = false;
    premiumUnlocked = localStorage.getItem('blockmaster_premium') === 'true';
    
    // Update switch elements in DOM
    const sfxTgl = document.getElementById('sfx-toggle');
    if (sfxTgl) sfxTgl.checked = sfxEnabled;
    
    // Show high score on start screen
    const startHighScoreVal = document.getElementById('start-high-score-val');
    if (startHighScoreVal) {
        startHighScoreVal.textContent = highScore;
    }
    
    initBoardDOM();
    resizeCanvas();
    
    // Preview board background
    applyTheme(0);
    fillBoardDirty();
    renderBoard();
    updateUI();
    updateUndoUI();
    
    // Event listeners
    undoBtn.addEventListener('click', performUndo);
    restartBtn.addEventListener('click', startNewGame);
    
    // Settings Button in header
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.remove('hidden');
        });
    }
    
    // Settings Button in start screen
    const startSettingsBtn = document.getElementById('start-settings-btn');
    if (startSettingsBtn) {
        startSettingsBtn.addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.remove('hidden');
        });
    }
    
    // Close Settings Button
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
        });
    }

    // Settings Premium Upgrade Button
    const settingsPremiumBtn = document.getElementById('settings-premium-btn');
    if (settingsPremiumBtn) {
        settingsPremiumBtn.addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
            document.getElementById('premium-overlay').classList.remove('hidden');
        });
    }
    
    // Start Game Button
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            document.getElementById('start-screen-overlay').classList.add('hidden');
            startNewGame();
            AudioEngine.initContext();

        });
    }
    
    // Premium Close Button
    const closePremiumBtn = document.getElementById('close-premium-btn');
    if (closePremiumBtn) {
        closePremiumBtn.addEventListener('click', () => {
            document.getElementById('premium-overlay').classList.add('hidden');
        });
    }
    
    // Premium Buy Button (Opens payment overlay checkout flow)
    const buyPremiumBtn = document.getElementById('buy-premium-btn');
    if (buyPremiumBtn) {
        buyPremiumBtn.addEventListener('click', () => {
            document.getElementById('premium-overlay').classList.add('hidden');
            document.getElementById('payment-overlay').classList.remove('hidden');
        });
    }

    // Payment Form card sync listeners
    const payCardholder = document.getElementById('pay-cardholder');
    const cardNameDisp = document.getElementById('card-name-disp');
    if (payCardholder && cardNameDisp) {
        payCardholder.addEventListener('input', (e) => {
            cardNameDisp.textContent = e.target.value.trim().toUpperCase() || "CAN YILMAZ";
        });
    }

    const payCardnumber = document.getElementById('pay-cardnumber');
    const cardNumDisp = document.getElementById('card-num-disp');
    if (payCardnumber && cardNumDisp) {
        payCardnumber.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            let formatted = val.match(/.{1,4}/g)?.join(' ') || "";
            e.target.value = formatted.substring(0, 19);
            cardNumDisp.textContent = e.target.value || "•••• •••• •••• ••••";
        });
    }

    const payExpiry = document.getElementById('pay-expiry');
    const cardExpDisp = document.getElementById('card-exp-disp');
    if (payExpiry && cardExpDisp) {
        payExpiry.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 2) {
                e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);
            } else {
                e.target.value = val;
            }
            cardExpDisp.textContent = e.target.value || "AA/YY";
        });
    }

    // Cancel Payment Button
    const cancelPaymentBtn = document.getElementById('cancel-payment-btn');
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', () => {
            document.getElementById('payment-overlay').classList.add('hidden');
        });
    }

    // Submit Payment Button (Mock transaction flow)
    const submitPaymentBtn = document.getElementById('submit-payment-btn');
    if (submitPaymentBtn) {
        submitPaymentBtn.addEventListener('click', () => {
            const formGroup = document.getElementById('payment-form');
            const buttonsGroup = document.getElementById('payment-buttons');
            const loaderGroup = document.getElementById('payment-loader');
            
            // Validate basic inputs
            if (!payCardholder.value.trim() || !payCardnumber.value.trim() || !payExpiry.value.trim()) {
                alert("Lütfen kart bilgilerini eksiksiz doldurunuz.");
                return;
            }
            
            // Show processing screen
            formGroup.classList.add('hidden');
            buttonsGroup.classList.add('hidden');
            loaderGroup.classList.remove('hidden');
            
            setTimeout(() => {
                // Unlock premium
                premiumUnlocked = true;
                localStorage.setItem('blockmaster_premium', 'true');
                
                // Hide modal and restore layout states
                document.getElementById('payment-overlay').classList.add('hidden');
                formGroup.classList.remove('hidden');
                buttonsGroup.classList.remove('hidden');
                loaderGroup.classList.add('hidden');
                
                // Refresh locks
                initThemePicker();
                updateSettingsPremiumUI();
                
                // Congratulatory effect
                AudioEngine.ultra();
                startConfetti();
                
                alert("Tebrikler! Ödeme başarıyla tamamlandı. Premium üyelik aktifleştirildi! Tüm temaların kilidi açıldı! \uD83D\uDC51");
            }, 2500);
        });
    }

    

    
    // SFX Toggle listener
    if (sfxTgl) {
        sfxTgl.addEventListener('change', (e) => {
            sfxEnabled = e.target.checked;
            localStorage.setItem('blockmaster_sfx', String(sfxEnabled));
        });
    }
    
    // Reset High Score Button listener
    const resetHighScoreBtn = document.getElementById('reset-high-score-btn');
    if (resetHighScoreBtn) {
        resetHighScoreBtn.addEventListener('click', () => {
            if (confirm("En yüksek skoru sıfırlamak istediğinize emin misiniz?")) {
                highScore = 0;
                localStorage.setItem('blockmaster_highscore', '0');
                updateUI();
                if (startHighScoreVal) startHighScoreVal.textContent = '0';
                alert("En yüksek skor sıfırlandı.");
            }
        });
    }
    
    // Dock slots initialization
    document.querySelectorAll('.dock-slot').forEach(slot => {
        slot.addEventListener('pointerdown', onPointerDown);
    });
    
    // Bottom Theme picker scrollable bar initialization
    updateSettingsPremiumUI();
    initThemePicker();
}

// ==========================================================================
// CONFETTI ENGINE (canvas-based, fires on new high score)
// ==========================================================================
let confettiParticles = [];
let confettiFrame = null;
let confettiCanvas = null;
let confettiCtx = null;

function initConfettiCanvas() {
    confettiCanvas = document.getElementById('confetti-canvas');
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}

function startConfetti() {
    initConfettiCanvas();
    if (!confettiCanvas) return;
    confettiParticles = [];
    const colors = ['#FFD700','#FF4444','#00F0FF','#00FF88','#FF69B4','#FFA500','#A855F7','#fff'];
    for (let i = 0; i < 180; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            w: 6 + Math.random() * 8,
            h: 10 + Math.random() * 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.15,
            vy: 2 + Math.random() * 3.5,
            vx: (Math.random() - 0.5) * 1.5,
            alpha: 1
        });
    }
    if (confettiFrame) cancelAnimationFrame(confettiFrame);
    animateConfetti();
}

function animateConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = 0;
    confettiParticles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.angle += p.spin;
        // fade out near bottom
        if (p.y > confettiCanvas.height * 0.7) p.alpha = Math.max(0, p.alpha - 0.012);
        if (p.alpha <= 0 || p.y > confettiCanvas.height + 20) return;
        alive++;
        confettiCtx.save();
        confettiCtx.globalAlpha = p.alpha;
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.angle);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        confettiCtx.restore();
    });
    if (alive > 0) {
        confettiFrame = requestAnimationFrame(animateConfetti);
    } else {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
}

function stopConfetti() {
    if (confettiFrame) cancelAnimationFrame(confettiFrame);
    confettiFrame = null;
    confettiParticles = [];
    if (confettiCtx && confettiCanvas) {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
}

// Canvas auto resizing
window.addEventListener("resize", resizeCanvas);

// On load trigger
window.addEventListener("DOMContentLoaded", initGame);

// BOTTOM THEME PICKER FUNCTIONS
const THEME_SCORE_REQUIREMENTS = {
    2: 100000,   // Buz: 100K
    3: 200000,   // Çöl: 200K
    4: 300000,   // Sualtı: 300K
    5: 400000,   // Volkan: 400K
    6: 500000,   // Uzay: 500K
    7: 1000000   // Zindan: 1M
};

function isThemeUnlocked(index) {
    if (index === 0 || index === 1) return true;
    if (premiumUnlocked) return true;
    
    const requiredScore = THEME_SCORE_REQUIREMENTS[index];
    if (requiredScore && highScore >= requiredScore) return true;
    
    return false;
}

function initThemePicker() {
    const picker = document.getElementById("theme-scroll-picker");
    if (!picker) return;
    picker.innerHTML = "";
    
    const themeIcons = ["\uD83C\uDF3F", "\uD83C\uDFDB\uFE0F", "\u2744\uFE0F", "\uD83C\uDFDC\uFE0F", "\uD83D\uDC19", "\uD83C\uDF0B", "\uD83C\uDF0C", "\u26D3\uFE0F"];
    const themeLabels = ["Orman", "Gökyüzü", "Buz", "Çöl", "Sualtı", "Volkan", "Uzay", "Zindan"];
    
    for (let i = 0; i < 8; i++) {
        const btn = document.createElement("button");
        btn.dataset.themeIndex = i;
        btn.title = themeLabels[i];
        
        const unlocked = isThemeUnlocked(i);
        btn.className = `theme-btn theme-icon-btn${unlocked ? "" : " locked"}`;
        btn.innerHTML = `<span class="theme-icon-only">${themeIcons[i]}</span>`;
        
        btn.addEventListener("click", () => {
            if (!isThemeUnlocked(i)) {
                // Determine theme unlock text dynamically
                const reqScore = THEME_SCORE_REQUIREMENTS[i];
                const scoreStr = reqScore;
                
                const scoreTextSpan = document.getElementById('premium-needed-score');
                if (scoreTextSpan) {
                    scoreTextSpan.textContent = scoreStr;
                }
                
                // Open premium upgrade modal
                document.getElementById('premium-overlay').classList.remove('hidden');
                return;
            }
            saveToHistory();
            applyTheme(i);
        });
        
        picker.appendChild(btn);
    }
    updateThemePickerActive();
}

function updateThemePickerActive() {
    const buttons = document.querySelectorAll(".theme-btn");
    buttons.forEach(btn => {
        const idx = parseInt(btn.dataset.themeIndex);
        if (idx === themeIndex) {
            btn.classList.add("active");
            btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } else {
            btn.classList.remove("active");
        }
    });
}

function updateSettingsPremiumUI() {
    const upgradeBtn = document.getElementById('settings-premium-btn');
    const activeBadge = document.getElementById('settings-premium-active-badge');
    if (upgradeBtn && activeBadge) {
        if (premiumUnlocked) {
            upgradeBtn.classList.add('hidden');
            activeBadge.classList.remove('hidden');
        } else {
            upgradeBtn.classList.remove('hidden');
            activeBadge.classList.add('hidden');
        }
    }
}

// COMBO BADGE DISPLAY (updates score-adjacent small badge)
function showComboBadge(linesCount, scoreGain, consecutiveCombo) {
    const badge = document.getElementById("combo-badge");
    if (!badge) return;
    
    let multiplierText = "";
    let comboClass = "double";
    
    if (consecutiveCombo >= 2) {
        if (consecutiveCombo >= 50) {
            multiplierText = " \u00d750 MAX SERİ!";
        } else {
            multiplierText = ` \u00d7${consecutiveCombo} SERİ!`;
        }
        comboClass = consecutiveCombo >= 4 ? 'ultra' : consecutiveCombo === 3 ? 'mega' : 'double';
    } else {
        multiplierText = linesCount >= 4 ? " \u00d74 ULTRA!" : linesCount === 3 ? " \u00d73 COMBO!" : linesCount === 2 ? " \u00d72 DOUBLE!" : "";
        comboClass = linesCount >= 4 ? 'ultra' : linesCount === 3 ? 'mega' : 'double';
    }
    
    badge.textContent = `+${scoreGain}${multiplierText}`;
    badge.className = `combo-badge combo-${comboClass}`;
    badge.style.display = "block";
    badge.classList.remove("hidden");
    
    // Clear previous animation
    badge.style.animation = "none";
    badge.offsetHeight; // force reflow
    badge.style.animation = "comboPop 2s ease-out forwards";
    
    // Clear previous timeout if any
    if (badge.dataset.timeoutId) {
        clearTimeout(parseInt(badge.dataset.timeoutId));
    }
    const tId = setTimeout(() => { 
        badge.classList.add("hidden"); 
        badge.style.display = ""; 
    }, 2100);
    badge.dataset.timeoutId = String(tId);
}

// TRIGGER THE PUNCHY CENTER SCREEN COMBO TEXT ANIMATION
function triggerPunchyComboAnimation(comboIdx) {
    const comboPop = document.getElementById("combo-pop-overlay");
    if (!comboPop) return;
    
    // Set appropriate combo level styling
    comboPop.className = "combo-pop-overlay"; // Reset classes
    if (comboIdx === 2) {
        comboPop.classList.add("combo-pop-2");
    } else if (comboIdx === 3) {
        comboPop.classList.add("combo-pop-3");
    } else if (comboIdx === 4) {
        comboPop.classList.add("combo-pop-4");
    } else {
        comboPop.classList.add("combo-pop-high");
    }
    
    const COMBO_TEXTS = {
        2: "Good!",
        3: "Excellent!",
        4: "Perfect!",
        5: "Amazing!",
        6: "Fantastic!",
        7: "Unbelievable!",
        8: "Phenomenal!",
        9: "Superb!",
        10: "Splendid!",
        11: "Marvelous!",
        12: "Unstoppable!"
    };
    
    let text = COMBO_TEXTS[comboIdx];
    if (!text) {
        text = comboIdx > 12 ? `Unstoppable! x${comboIdx}` : `Combo x${comboIdx}!`;
    }
    comboPop.textContent = text;
    comboPop.classList.remove("hidden");
    
    // Trigger animation flow
    comboPop.style.animation = "none";
    comboPop.offsetHeight; // force reflow
    comboPop.classList.add("animate");
    
    if (comboPop.dataset.timeoutId) {
        clearTimeout(parseInt(comboPop.dataset.timeoutId));
    }
    
    const tId = setTimeout(() => {
        comboPop.classList.add("hidden");
        comboPop.classList.remove("animate");
    }, 1250);
    comboPop.dataset.timeoutId = String(tId);
}

// TRIGGER THE SLIDE-IN THEME BANNER POPUP
function triggerThemeBanner(themeIdx) {
    const banner = document.getElementById("theme-banner-overlay");
    if (!banner) return;
    
    const themeIcons = ["\uD83C\uDF3F", "\uD83C\uDFDB\uFE0F", "\u2744\uFE0F", "\uD83C\uDFDC\uFE0F", "\uD83D\uDC19", "\uD83C\uDF0B", "\uD83C\uDF0C", "\u26D3\uFE0F"];
    const themeLabels = ["Orman", "Gökyüzü", "Buz", "Çöl", "Sualtı", "Volkan", "Uzay", "Zindan"];
    
    const name = themeLabels[themeIdx];
    const icon = themeIcons[themeIdx];
    
    banner.textContent = `YENİ TEMA: ${name} ${icon}`;
    banner.classList.remove("hidden");
    
    banner.style.animation = "none";
    banner.offsetHeight; // force reflow
    banner.classList.add("animate");
    
    if (banner.dataset.timeoutId) {
        clearTimeout(parseInt(banner.dataset.timeoutId));
    }
    
    const tId = setTimeout(() => {
        banner.classList.add("hidden");
        banner.classList.remove("animate");
    }, 2250);
    banner.dataset.timeoutId = String(tId);
}

// User Interaction Trigger to comply with modern browser autoplay policies
window.addEventListener('pointerdown', () => {
    try {
        AudioEngine.initContext();
    } catch(e) {}
}, { once: true });
