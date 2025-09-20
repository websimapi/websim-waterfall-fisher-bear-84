import { BEARS, FISH } from '../unlocks.js';

let fadeTimeout;

export function bindUI() {
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const scoreContainer = document.getElementById('score-container');
    const streakContainer = document.getElementById('streak-container');
    const scoreEl = document.getElementById('score');
    const streakEl = document.getElementById('streak');
    const finalScoreEl = document.getElementById('final-score');
    const startButton = document.getElementById('start-button');

    const quickChoices = document.getElementById('quick-choices');
    const chooseBear = document.getElementById('choose-bear');
    const chooseFish = document.getElementById('choose-fish');
    const unlocksPanel = document.getElementById('unlocks-container');
    const selectionBack = document.getElementById('selection-back');
    const selectionTitle = document.getElementById('selection-title');
    const bearCategory = document.getElementById('bear-category');
    const fishCategory = document.getElementById('fish-category');

    function openSelection(type) {
        const logo = document.getElementById('game-logo');
        if (logo) {
            logo.classList.add('fade-out');
        }
        selectionTitle.textContent = type === 'bear' ? 'Select Bear' : 'Select Fish';
        bearCategory.style.display = type === 'bear' ? 'block' : 'none';
        fishCategory.style.display = type === 'fish' ? 'block' : 'none';
        quickChoices.classList.add('hidden');
        unlocksPanel.classList.remove('hidden');
    }

    selectionBack.addEventListener('click', () => {
        unlocksPanel.classList.add('hidden');
        quickChoices.classList.remove('hidden');
    });

    chooseBear.addEventListener('click', () => openSelection('bear'));
    chooseFish.addEventListener('click', () => openSelection('fish'));

    function handleStart() {
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        scoreContainer.classList.remove('hidden');
        streakContainer.classList.remove('hidden');
    }

    return { startButton };
}

export function updateUIValues({ score, streak }) {
    if (typeof score === 'number') document.getElementById('score').innerText = score;
    if (typeof streak === 'number') document.getElementById('streak').innerText = `x${streak}`;
}

export function showHUD() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('score-container').classList.remove('hidden');
    document.getElementById('streak-container').classList.remove('hidden');
    const lb = document.getElementById('leaderboard-modal'); if (lb) lb.classList.add('hidden');
}

export function showGameOver() {
    const goScreen = document.getElementById('game-over-screen');
    goScreen.classList.remove('hidden', 'fade-out');
    document.getElementById('score-container').classList.add('hidden');
    document.getElementById('streak-container').classList.add('hidden');
    const submitBtn = document.getElementById('submit-score-btn'); if (submitBtn) submitBtn.disabled = false;
}

export function showStart(isFirstLoad = false) {
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('score-container').classList.add('hidden');
    document.getElementById('streak-container').classList.add('hidden');
    
    const quick = document.getElementById('quick-choices');
    const unlocks = document.getElementById('unlocks-container');
    if (quick) quick.classList.remove('hidden');
    if (unlocks) unlocks.classList.add('hidden');
    
    const logo = document.getElementById('game-logo');
    if (logo) {
        if (isFirstLoad) {
            logo.classList.remove('fade-out', 'hidden');
            logo.style.animation = 'none';
            void logo.offsetHeight; 
            logo.style.animation = '';
            logo.style.opacity = '1';

            clearTimeout(fadeTimeout);
            fadeTimeout = setTimeout(() => {
                 if (logo && !logo.classList.contains('fade-out')) {
                    logo.classList.add('fade-out');
                 }
            }, 2000);
        } else {
            clearTimeout(fadeTimeout);
            logo.classList.add('hidden');
        }
    }
}

function createUnlockBox(item, type, isUnlocked, isSelected, clickHandler) {
    const box = document.createElement('div');
    box.className = 'unlock-box';
    if (isSelected) box.classList.add('selected');
    if (!isUnlocked) box.classList.add('locked');

    const img = document.createElement('img');
    img.src = item.asset;
    img.alt = item.name;
    box.appendChild(img);
    
    const span = document.createElement('span');
    span.textContent = item.name;
    box.appendChild(span);

    if (isUnlocked) {
        box.addEventListener('click', () => {
            clickHandler(type, item.id);
            // Visually update selection
            const parent = box.parentElement;
            if (parent) {
                Array.from(parent.children).forEach(child => child.classList.remove('selected'));
            }
            box.classList.add('selected');
        });
    } else {
        const unlockText = document.createElement('span');
        unlockText.textContent = `Score ${item.unlockCondition.value}`;
        unlockText.style.fontSize = '10px';
        unlockText.style.opacity = '0.8';
        box.appendChild(unlockText);
    }
    
    return box;
}

export function populateUnlocks(progress, clickHandler) {
    const bearContainer = document.getElementById('bear-unlocks');
    const fishContainer = document.getElementById('fish-unlocks');
    
    bearContainer.innerHTML = '';
    fishContainer.innerHTML = '';

    BEARS.forEach(bear => {
        const isUnlocked = progress.unlockedBears.includes(bear.id);
        const isSelected = progress.selectedBear === bear.id;
        const box = createUnlockBox(bear, 'bear', isUnlocked, isSelected, clickHandler);
        bearContainer.appendChild(box);
    });

    FISH.forEach(fish => {
        const isUnlocked = progress.unlockedFish.includes(fish.id);
        const isSelected = progress.selectedFish === fish.id;
        const box = createUnlockBox(fish, 'fish', isUnlocked, isSelected, clickHandler);
        fishContainer.appendChild(box);
    });
}