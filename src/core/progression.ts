export interface ProgressionState {
    unlockedLevels: number[];
    clearedLevels: number[];
    earnedBadges: string[];
}

export class ProgressionManager {
    private static STORAGE_KEY = "rl_hero_progression";
    private state: ProgressionState;

    constructor() {
        this.state = this.loadState();
    }

    private static toLevelId(value: unknown): number | null {
        if (typeof value === "number" && Number.isInteger(value) && value > 0) {
            return value;
        }
        if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
            const parsed = Number(value);
            if (Number.isInteger(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return null;
    }

    private normalizeState(raw: ProgressionState): ProgressionState {
        const unlocked = new Set<number>();
        const cleared = new Set<number>();
        const badges = new Set<string>();

        for (const levelId of raw.unlockedLevels ?? []) {
            const parsed = ProgressionManager.toLevelId(levelId);
            if (parsed != null) {
                unlocked.add(parsed);
            }
        }
        for (const levelId of raw.clearedLevels ?? []) {
            const parsed = ProgressionManager.toLevelId(levelId);
            if (parsed != null) {
                cleared.add(parsed);
            }
        }
        for (const badge of raw.earnedBadges ?? []) {
            if (typeof badge === "string" && badge.trim().length > 0) {
                badges.add(badge);
            }
        }

        // Always keep Mission 1 available.
        unlocked.add(1);
        // Self-heal: if a mission is cleared, the next mission should be unlocked.
        for (const levelId of cleared) {
            unlocked.add(levelId);
            unlocked.add(levelId + 1);
        }

        return {
            unlockedLevels: Array.from(unlocked).sort((a, b) => a - b),
            clearedLevels: Array.from(cleared).sort((a, b) => a - b),
            earnedBadges: Array.from(badges),
        };
    }

    private loadState(): ProgressionState {
        const saved = localStorage.getItem(ProgressionManager.STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as ProgressionState;
                return this.normalizeState(parsed);
            } catch (e) {
                console.error("Failed to parse progression state", e);
            }
        }
        // Default state: Level 1 unlocked
        return {
            unlockedLevels: [1],
            clearedLevels: [],
            earnedBadges: []
        };
    }

    private saveState() {
        localStorage.setItem(ProgressionManager.STORAGE_KEY, JSON.stringify(this.state));
    }

    isUnlocked(levelId: number): boolean {
        return this.state.unlockedLevels.includes(levelId);
    }

    isCleared(levelId: number): boolean {
        return this.state.clearedLevels.includes(levelId);
    }

    clearLevel(levelId: number, badgeName: string, maxLevelId = Number.MAX_SAFE_INTEGER) {
        let changed = false;

        if (!this.state.clearedLevels.includes(levelId)) {
            this.state.clearedLevels.push(levelId);
            changed = true;
        }

        if (!this.state.earnedBadges.includes(badgeName)) {
            this.state.earnedBadges.push(badgeName);
            changed = true;
        }

        if (!this.state.unlockedLevels.includes(levelId)) {
            this.state.unlockedLevels.push(levelId);
            changed = true;
        }

        // Unlock immediate next level.
        const nextLevel = levelId + 1;
        if (nextLevel <= maxLevelId && !this.state.unlockedLevels.includes(nextLevel)) {
            this.state.unlockedLevels.push(nextLevel);
            changed = true;
        }

        // Self-heal unlock chain for any already-cleared missions.
        for (const clearedId of this.state.clearedLevels) {
            const sequentialNext = clearedId + 1;
            if (sequentialNext <= maxLevelId && !this.state.unlockedLevels.includes(sequentialNext)) {
                this.state.unlockedLevels.push(sequentialNext);
                changed = true;
            }
        }

        if (changed) {
            this.state.unlockedLevels.sort((a, b) => a - b);
            this.state.clearedLevels.sort((a, b) => a - b);
            this.saveState();
        }
    }

    getEarnedBadges(): string[] {
        return this.state.earnedBadges;
    }

    getUnlockedLevels(): number[] {
        return [...this.state.unlockedLevels];
    }

    getClearedLevels(): number[] {
        return [...this.state.clearedLevels];
    }

    reset() {
        this.state = {
            unlockedLevels: [1],
            clearedLevels: [],
            earnedBadges: []
        };
        this.saveState();
    }
}
