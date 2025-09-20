export const BEARS = [
    { 
        id: 'splashy', 
        name: 'Splashy Bear', 
        asset: 'bear_unlock.png',
        unlockCondition: { type: 'score', value: 0 }
    },
    { 
        id: 'grizzly', 
        name: 'Grizzly', 
        asset: 'grizzly_bear_unlock.png',
        unlockCondition: { type: 'score', value: 1000 }
    },
    { 
        id: 'polar', 
        name: 'Polar Bear', 
        asset: 'polar_bear_unlock.png',
        unlockCondition: { type: 'score', value: 1500 }
    }
];

export const FISH = [
    { 
        id: 'classic', 
        name: 'Classic Fish', 
        asset: 'fish_unlock.png',
        unlockCondition: { type: 'score', value: 0 }, 
        difficulty: 1,
    },
    { 
        id: 'vitiligo', 
        name: 'Vitiligo Fish', 
        asset: 'vitiligo_fish_unlock.png',
        unlockCondition: { type: 'score', value: 250 }, 
        difficulty: 2,
    },
    { 
        id: 'golden',
        name: 'Golden Fish',
        asset: 'golden_fish_unlock.png',
        unlockCondition: { type: 'score', value: 750 },
        difficulty: 3,
    },
];

const PROGRESS_KEY = 'splashyBearProgress';

export function getPlayerProgress() {
    const defaults = {
        unlockedBears: ['splashy'],
        unlockedFish: ['classic'],
        selectedBear: 'splashy',
        selectedFish: 'classic',
        highScore: 0,
    };
    try {
        const stored = localStorage.getItem(PROGRESS_KEY);
        if (stored) {
            // merge stored with defaults to prevent missing keys on updates
            return { ...defaults, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error("Could not load player progress", e);
    }
    return defaults;
}

export function savePlayerProgress(progress) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch(e) {
        console.error("Could not save player progress", e);
    }
}