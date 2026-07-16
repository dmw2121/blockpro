/* ==========================================================================
   BLOCK MASTER PRO - CORE GAME ENGINE
   ========================================================================== */

// 1. SHAPE LIBRARY (Shapes <= 4 blocks)
const SHAPES = [
    // 1 Block
    { matrix: [[1]], name: "Single" },
    // 2 Blocks
    { matrix: [[1, 1]], name: "Domino H" },
    { matrix: [[1], [1]], name: "Domino V" },
    // 3 Blocks
    { matrix: [[1, 1, 1]], name: "Trio H" },
    { matrix: [[1], [1], [1]], name: "Trio V" },
    { matrix: [[1, 1], [1, 0]], name: "Triomino L Corner 1" },
    { matrix: [[1, 1], [0, 1]], name: "Triomino L Corner 2" },
    { matrix: [[1, 0], [1, 1]], name: "Triomino L Corner 3" },
    { matrix: [[0, 1], [1, 1]], name: "Triomino L Corner 4" },
    // 4 Blocks (Tetris Tetrominoes)
    { matrix: [[1, 1], [1, 1]], name: "O-Block" },
    { matrix: [[1, 1, 1, 1]], name: "I-Block H" },
    { matrix: [[1], [1], [1], [1]], name: "I-Block V" },
    // T-Block
    { matrix: [[1, 1, 1], [0, 1, 0]], name: "T-Block Down" },
    { matrix: [[0, 1, 0], [1, 1, 1]], name: "T-Block Up" },
    { matrix: [[1, 0], [1, 1], [1, 0]], name: "T-Block Right" },
    { matrix: [[0, 1], [1, 1], [0, 1]], name: "T-Block Left" },
    // L-Block
    { matrix: [[1, 0], [1, 0], [1, 1]], name: "L-Block Right" },
    { matrix: [[1, 1, 1], [1, 0, 0]], name: "L-Block Down" },
    { matrix: [[1, 1], [0, 1], [0, 1]], name: "L-Block Left" },
    { matrix: [[0, 0, 1], [1, 1, 1]], name: "L-Block Up" },
    // J-Block
    { matrix: [[0, 1], [0, 1], [1, 1]], name: "J-Block Right" },
    { matrix: [[1, 0, 0], [1, 1, 1]], name: "J-Block Down" },
    { matrix: [[1, 1], [1, 0], [1, 0]], name: "J-Block Left" },
    { matrix: [[1, 1, 1], [0, 0, 1]], name: "J-Block Up" },
    // S-Block
    { matrix: [[0, 1, 1], [1, 1, 0]], name: "S-Block H" },
    { matrix: [[1, 0], [1, 1], [0, 1]], name: "S-Block V" },
    // Z-Block
    { matrix: [[1, 1, 0], [0, 1, 1]], name: "Z-Block H" },
    { matrix: [[0, 1], [1, 1], [1, 0]], name: "Z-Block V" }
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
let musicEnabled = true;
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
        const osc = ctx_a.createOscillator();
        const gainNode = ctx_a.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx_a.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(gain, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        osc.start(startTime);
        osc.stop(startTime + dur + 0.01);
    }
    return {
        // Soft thud when block placed
        place() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                tone(180, 'sine', 0.18, 0.08, t);
                tone(120, 'sine', 0.12, 0.12, t + 0.02);
            } catch(e) {}
        },
        // Satisfying whoosh on line clear (1-2 lines)
        clear() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                tone(440, 'sine', 0.22, 0.15, t);
                tone(660, 'sine', 0.18, 0.15, t + 0.07);
                tone(880, 'sine', 0.14, 0.18, t + 0.14);
            } catch(e) {}
        },
        // Punchy combo (3 lines)
        combo() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                [523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.22, 0.18, t + i * 0.08));
            } catch(e) {}
        },
        // Epic ultra fanfare (4 lines)
        ultra() {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
                    tone(f, 'triangle', 0.25, 0.22, t + i * 0.07);
                    tone(f * 2, 'sine', 0.10, 0.20, t + i * 0.07 + 0.01);
                });
            } catch(e) {}
        },
        // Progressive combo sound scaling with multiplier
        comboProgressive(comboIndex) {
            if (!sfxEnabled) return;
            try {
                init();
                const t = ctx_a.currentTime;
                // Base notes shifted up by comboIndex semitones
                const baseFreqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
                const semitones = comboIndex - 1;
                const factor = Math.pow(1.059463, semitones); // Standard 12-TET tuning step
                baseFreqs.forEach((f, i) => {
                    tone(f * factor, 'triangle', 0.22, 0.18, t + i * 0.08);
                    // Add secondary harmony sine wave
                    tone(f * factor * 1.5, 'sine', 0.08, 0.12, t + i * 0.08 + 0.02);
                });
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

// 3. DIRTY START ALGORITHM (30% to 40% fill, no full lines)
function fillBoardDirty() {
    // Reset board array
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    
    // Choose exactly 19 cells for exactly 30% fill rate (19 / 64 cells ≈ 30%)
    const fillCount = 19;
    
    // Create pool of all 64 board coordinates
    let coords = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            coords.push({ r, c });
        }
    }
    
    // Shuffle coordinates pool
    coords.sort(() => Math.random() - 0.5);
    
    let placed = 0;
    for (let i = 0; i < coords.length; i++) {
        if (placed >= fillCount) break;
        
        const { r, c } = coords[i];
        
        // Count blocks currently in row r and column c
        let rowCount = 0;
        let colCount = 0;
        for (let j = 0; j < 8; j++) {
            if (board[r][j] > 0) rowCount++;
            if (board[j][c] > 0) colCount++;
        }
        
        // Ensure no row or column completes (limit to maximum 7 filled cells)
        if (rowCount < 7 && colCount < 7) {
            board[r][c] = 1 + Math.floor(Math.random() * 4); // random color index 1-4
            placed++;
        }
    }
}

// DOCK SHAPE GENERATOR
function generateNewDockShapes() {
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
    badge.innerText = `${historyStack.length}/5`;
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
        currentScoreEl.innerText = displayedScore.toLocaleString();
        if (progress < 1) {
            scoreAnimFrame = requestAnimationFrame(step);
        } else {
            displayedScore = target;
            currentScoreEl.innerText = target.toLocaleString();
        }
    }
    scoreAnimFrame = requestAnimationFrame(step);
}

function updateUI() {
    animateScoreTo(score);
    highScoreEl.innerText = highScore.toLocaleString();
    linesClearedEl.innerText = linesCleared;
}

// 8. DORMANT CANVAS ENGINE (Particles on Line Clear & Placement)
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}

function spawnExplosion(row, col, color, count = 12, sizeMultiplier = 1.0) {
    const rect = canvas.getBoundingClientRect();
    const cellW = rect.width / 8;
    const cellH = rect.height / 8;
    
    const startX = col * cellW + cellW / 2;
    const startY = row * cellH + cellH / 2;
    
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
            gravity: 0.09,
            trail: sizeMultiplier > 1.5 // large particles get trail effect
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
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity; // Gravity pull downwards
        p.alpha -= p.decay;
        
        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        if (p.trail) {
            // Glowing star shape for mega bursts
            ctx.shadowBlur = p.size * 3;
            ctx.shadowColor = p.color;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Stop execution context loop if no particles left (Dormant Engine state)
    if (particles.length > 0) {
        requestAnimationFrame(updateParticles);
    } else {
        isAnimationRunning = false;
        ctx.clearRect(0, 0, rect.width, rect.height);
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
        document.getElementById('game-over-score').innerText = score.toLocaleString();
        document.getElementById('game-over-high').innerText = highScore.toLocaleString();
        document.getElementById('go-lines').innerText = linesCleared;
        
        const newRecordEl = document.getElementById('go-new-record');
        if (isNewRecord) {
            newRecordEl.classList.remove('hidden');
            document.getElementById('go-emoji').textContent = '🏆';
            document.getElementById('go-subtitle').textContent = 'Yeni Rekor!';
            // launch confetti for new record
            startConfetti();
        } else {
            newRecordEl.classList.add('hidden');
            document.getElementById('go-emoji').textContent = '💀';
            document.getElementById('go-subtitle').textContent = 'Hamle kalmadı!';
            stopConfetti();
        }
        
        // Stagger showing the game-over dialog after dispersion finishes (3.6s delay)
        setTimeout(() => {
            document.getElementById('game-over-overlay').classList.remove('hidden');
        }, 3600);
    }
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
        // Increment consecutive combo multiplier
        comboCount++;
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
                const count = isMegaClear ? 20 : 12;
                const sizeMult = linesCount >= 4 ? 2.0 : linesCount >= 3 ? 1.5 : 1.0;
                spawnExplosion(r, c, colorStr, count, sizeMult);
            }
        });
        
        // Extra mega fireworks burst for 3x or 4x clears
        if (isMegaClear) {
            spawnMegaFireworks(linesCount);
        }
        
        // Clear cells in matrix array
        completedRows.forEach(r => {
            for (let c = 0; c < 8; c++) board[r][c] = 0;
        });
        completedCols.forEach(c => {
            for (let r = 0; r < 8; r++) board[r][c] = 0;
        });
        
        // Base Score formula with 3x/4x simultaneous line clear multiplier bonus
        let scoreGain = linesCount * 100 * linesCount;
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
    
    // Touch: move clone well above finger so it's always visible
    if (e.pointerType === "touch") {
        y -= 120;
    }
    
    let closestCell = null;
    let minDistance = Infinity;
    
    const cells = boardEl.querySelectorAll(".grid-cell");
    let cellW = 54;
    const sampleCell = boardEl.querySelector(".grid-cell");
    if (sampleCell) {
        cellW = sampleCell.getBoundingClientRect().width;
    }
    
    // Find cell with minimum Euclidean distance to pointer
    cells.forEach(cell => {
        const rect = cell.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(x - centerX, y - centerY);
        
        if (dist < minDistance) {
            minDistance = dist;
            closestCell = cell;
        }
    });
    
    // Only snap if the pointer is within a reasonable radius (1.5 times cell size)
    if (closestCell && minDistance < cellW * 1.5) {
        return {
            hoverR: parseInt(closestCell.dataset.row),
            hoverC: parseInt(closestCell.dataset.col)
        };
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
        cell.classList.remove("highlight-valid", "highlight-invalid", "highlight-ghost");
        cell.style.removeProperty("--ghost-color");
        cell.style.removeProperty("filter");
    });
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
        
        // 10 score points per block placed
        score += targetCells.length * 10;
        
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
    
    // Measure actual cell dimensions
    let cellW = 54;
    let cellH = 54;
    const sampleCell = boardEl.querySelector(".grid-cell");
    if (sampleCell) {
        const rect = sampleCell.getBoundingClientRect();
        cellW = rect.width;
        cellH = rect.height;
    }
    
    const grabR = draggingState ? draggingState.grabR : 0;
    const grabC = draggingState ? draggingState.grabC : 0;
    
    // Align visual clone matching board grid spaces and 4px gaps exactly
    const gapOffset = 4;
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
    
    draggingState = {
        slotIndex: slotIndex,
        shape: shape,
        grabR: grabR,
        grabC: grabC,
        pointerId: e.pointerId
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
    musicEnabled = localStorage.getItem('blockmaster_music') !== 'false';
    premiumUnlocked = localStorage.getItem('blockmaster_premium') === 'true';
    
    // Update switch elements in DOM
    const musicTgl = document.getElementById('music-toggle');
    const sfxTgl = document.getElementById('sfx-toggle');
    if (musicTgl) musicTgl.checked = musicEnabled;
    if (sfxTgl) sfxTgl.checked = sfxEnabled;
    
    // Show high score on start screen
    const startHighScoreVal = document.getElementById('start-high-score-val');
    if (startHighScoreVal) {
        startHighScoreVal.innerText = highScore.toLocaleString();
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
    
    // Start Game Button
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            document.getElementById('start-screen-overlay').classList.add('hidden');
            startNewGame();
            AudioEngine.initContext();
            if (musicEnabled) {
                startBackgroundMusic();
            }
        });
    }
    
    // Premium Close Button
    const closePremiumBtn = document.getElementById('close-premium-btn');
    if (closePremiumBtn) {
        closePremiumBtn.addEventListener('click', () => {
            document.getElementById('premium-overlay').classList.add('hidden');
        });
    }
    
    // Premium Buy Button
    const buyPremiumBtn = document.getElementById('buy-premium-btn');
    if (buyPremiumBtn) {
        buyPremiumBtn.addEventListener('click', () => {
            premiumUnlocked = true;
            localStorage.setItem('blockmaster_premium', 'true');
            document.getElementById('premium-overlay').classList.add('hidden');
            // Re-render theme picker so padlocks disappear
            initThemePicker();
            alert("Tebrikler! Premium üyelik satın alındı. Tüm temaların kilidi açıldı! \uD83D\uDC51");
        });
    }

    
    // Music Toggle listener
    if (musicTgl) {
        musicTgl.addEventListener('change', (e) => {
            musicEnabled = e.target.checked;
            localStorage.setItem('blockmaster_music', String(musicEnabled));
            if (!musicEnabled) {
                // Clear chords loop immediately
                if (chordsInterval) {
                    clearTimeout(chordsInterval);
                    chordsInterval = null;
                }
                musicPlaying = false;
            } else {
                startBackgroundMusic();
            }
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
                if (startHighScoreVal) startHighScoreVal.innerText = '0';
                alert("En yüksek skor sıfırlandı.");
            }
        });
    }
    
    // Dock slots initialization
    document.querySelectorAll('.dock-slot').forEach(slot => {
        slot.addEventListener('pointerdown', onPointerDown);
    });
    
    // Bottom Theme picker scrollable bar initialization
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
    2: 1000000,   // Buz: 1M
    3: 2000000,   // Çöl: 2M
    4: 3000000,   // Sualtı: 3M
    5: 4000000,   // Volkan: 4M
    6: 5000000,   // Uzay: 5M
    7: 10000000   // Zindan: 10M
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
                const scoreStr = reqScore >= 1000000 ? `${reqScore / 1000000}.000.000` : reqScore.toLocaleString();
                
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

// COMBO BADGE DISPLAY (updates score-adjacent small badge)
function showComboBadge(linesCount, scoreGain, consecutiveCombo) {
    const badge = document.getElementById("combo-badge");
    if (!badge) return;
    
    let multiplierText = "";
    let comboClass = "double";
    
    if (consecutiveCombo >= 2) {
        multiplierText = ` \u00d7${consecutiveCombo} SERİ!`;
        comboClass = consecutiveCombo >= 4 ? 'ultra' : consecutiveCombo === 3 ? 'mega' : 'double';
    } else {
        multiplierText = linesCount >= 4 ? " \u00d74 ULTRA!" : linesCount === 3 ? " \u00d73 COMBO!" : linesCount === 2 ? " \u00d72 DOUBLE!" : "";
        comboClass = linesCount >= 4 ? 'ultra' : linesCount === 3 ? 'mega' : 'double';
    }
    
    badge.textContent = `+${scoreGain.toLocaleString()}${multiplierText}`;
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
    
    comboPop.textContent = `COMBO x${comboIdx}!`;
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

// BACKGROUND MUSIC ENGINE (ambient cheerful arpeggios)
let musicPlaying = false;
let chordsInterval = null; // Used as the timeout tracker
let currentStep = 0;

function startBackgroundMusic() {
    if (musicPlaying) return;
    musicPlaying = true;
    currentStep = 0;
    
    // Cheerful progression: C -> G -> Am -> F (Music Box arpeggios)
    const melody = [
        // C Major (cheerful)
        { freq: 130.81, gain: 0.005, dur: 0.8 }, // C3
        { freq: 196.00, gain: 0.004, dur: 0.8 }, // G3
        { freq: 329.63, gain: 0.004, dur: 0.8 }, // E4
        { freq: 261.63, gain: 0.004, dur: 0.8 }, // C4
        
        // G Major (cheerful)
        { freq: 98.00,  gain: 0.005, dur: 0.8 }, // G2
        { freq: 146.83, gain: 0.004, dur: 0.8 }, // D3
        { freq: 293.66, gain: 0.004, dur: 0.8 }, // D4
        { freq: 196.00, gain: 0.004, dur: 0.8 }, // G3
        
        // A Minor (gentle contrast)
        { freq: 110.00, gain: 0.005, dur: 0.8 }, // A2
        { freq: 164.81, gain: 0.004, dur: 0.8 }, // E3
        { freq: 261.63, gain: 0.004, dur: 0.8 }, // C4
        { freq: 220.00, gain: 0.004, dur: 0.8 }, // A3
        
        // F Major (resolving happily)
        { freq: 87.31,  gain: 0.005, dur: 0.8 }, // F2
        { freq: 130.81, gain: 0.004, dur: 0.8 }, // C3
        { freq: 349.23, gain: 0.004, dur: 0.8 }, // F4
        { freq: 261.63, gain: 0.004, dur: 0.8 }  // C4
    ];
    
    const stepDuration = 550; // ms per step (approx 110 BPM)
    
    function playStep() {
        if (!musicPlaying) return;
        
        try {
            AudioEngine.initContext();
            const ctx_a = AudioEngine.getContext();
            if (ctx_a && ctx_a.state !== 'suspended') {
                const now = ctx_a.currentTime;
                const note = melody[currentStep];
                
                const osc = ctx_a.createOscillator();
                const gainNode = ctx_a.createGain();
                const filter = ctx_a.createBiquadFilter();
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(380, now); // soft warm cut to sit quietly in the back
                
                osc.connect(gainNode);
                gainNode.connect(filter);
                filter.connect(ctx_a.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(note.freq, now);
                
                // Extremely quiet and gentle fade in / fade out
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(note.gain, now + 0.08); // slow soft attack
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.dur); // long release
                
                osc.start(now);
                osc.stop(now + note.dur + 0.1);
            }
        } catch(e) {
            console.log("Music step play error:", e);
        }
        
        currentStep = (currentStep + 1) % melody.length;
        chordsInterval = setTimeout(playStep, stepDuration);
    }
    
    playStep();
}

// User Interaction Trigger to comply with modern browser autoplay policies
window.addEventListener('pointerdown', () => {
    try {
        AudioEngine.initContext();
    } catch(e) {}
}, { once: true });
