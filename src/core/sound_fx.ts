export class SoundFx {
    private ctx: AudioContext | null = null;
    private isEnabled = true;

    private ambientGain: GainNode | null = null;
    private ambientA: OscillatorNode | null = null;
    private ambientB: OscillatorNode | null = null;

    private lastBumpAtMs = 0;
    private bumpCooldownMs = 320;

    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.stopAmbient();
            if (this.ctx) this.ctx.suspend();
        } else {
            if (this.ctx) this.ctx.resume();
        }
    }

    async resume(): Promise<void> {
        if (!this.isEnabled) return;
        if (!this.ctx) {
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === "suspended") {
            await this.ctx.resume();
        }
    }

    private ensureAmbient(): void {
        if (!this.ctx || !this.isEnabled) return;
        if (this.ambientA && this.ambientB && this.ambientGain) return;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.connect(this.ctx.destination);

        const a = this.ctx.createOscillator();
        const b = this.ctx.createOscillator();
        a.type = "sine";
        b.type = "sine";
        // Deeper, calmer drone (D2 + A2)
        a.frequency.setValueAtTime(73.42, this.ctx.currentTime);
        b.frequency.setValueAtTime(110.0, this.ctx.currentTime);
        a.connect(gain);
        b.connect(gain);
        a.start();
        b.start();

        this.ambientGain = gain;
        this.ambientA = a;
        this.ambientB = b;
    }

    startAmbient(): void {
        if (!this.ctx || !this.isEnabled) return;
        this.ensureAmbient();

        if (!this.ambientGain || !this.ambientA || !this.ambientB) return;

        const now = this.ctx.currentTime;

        // Richer, layered Cyberpunk synth (C2 + G2)
        this.ambientA.frequency.setTargetAtTime(65.41, now, 1);
        this.ambientB.frequency.setTargetAtTime(98.0, now, 1);

        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setTargetAtTime(0.04, now, 1.5);
    }

    stopAmbient(): void {
        if (!this.ctx || !this.ambientGain) return;
        const now = this.ctx.currentTime;
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setTargetAtTime(0.0001, now, 0.5);
    }

    private tone(freq: number, durationSec: number, gainValue: number, type: OscillatorType, slideTo?: number): void {
        if (!this.isEnabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + durationSec);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(gainValue, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + durationSec + 0.05);
    }

    step(): void {
        // Light positive "move" chirp (intentionally bright so it does not resemble bumps).
        this.tone(520, 0.06, 0.028, "triangle", 760);
        setTimeout(() => this.tone(760, 0.04, 0.014, "sine"), 16);
    }

    setAmbientTension(level: number): void {
        if (!this.ctx || !this.ambientA || !this.ambientB || !this.isEnabled) return;
        const t = Math.max(0, Math.min(1, level));
        const now = this.ctx.currentTime;

        // Slight detune for tension
        this.ambientA.detune.setTargetAtTime(t * 100, now, 0.2);
        this.ambientB.detune.setTargetAtTime(t * -50, now, 0.2);
    }

    turn(): void {
        // Softer turn cue, distinct from forward move and bump.
        this.tone(330, 0.07, 0.016, "triangle", 240);
    }

    bump(): void {
        const nowMs = performance.now();
        if (nowMs - this.lastBumpAtMs < this.bumpCooldownMs) return;
        this.lastBumpAtMs = nowMs;
        // Heavy Mechanical Thud
        this.tone(120, 0.15, 0.06, "sawtooth", 40);
    }

    reward(): void {
        // Tech-Chime (High speed)
        this.tone(880, 0.05, 0.05, "sine");
        setTimeout(() => this.tone(1320, 0.08, 0.04, "sine"), 40);
    }

    goal(): void {
        // Resonant Win Sequence
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((f, i) => {
            setTimeout(() => this.tone(f, 0.18, 0.06, "triangle"), i * 90);
        });
    }

    bell(): void {
        if (!this.ctx || !this.isEnabled) return;
        const now = this.ctx.currentTime;
        // Classic high-pitched School Bell "Ding"
        [880, 1760, 3520].forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.05 / (i + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

            osc.connect(gain);
            gain.connect(this.ctx!.destination);

            osc.start(now);
            osc.stop(now + 0.8);
        });
    }

    play(effect: "levelComplete"): void {
        if (effect === "levelComplete") {
            this.goal();
        }
    }

    fire(): void {
        // Crackling noise
        if (!this.ctx || !this.isEnabled) return;
        const now = this.ctx.currentTime;
        // Burst of noise
        const count = 5;
        for (let i = 0; i < count; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(100 + Math.random() * 400, now + i * 0.05);
            gain.gain.setValueAtTime(0.05, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.15);
        }
    }

    water(): void {
        // Splash - low freq slide
        this.tone(300, 0.3, 0.08, "triangle", 50);
        setTimeout(() => this.tone(200, 0.4, 0.05, "sine", 30), 50);
    }

    ice(): void {
        // Slip - high freq slide up
        this.tone(600, 0.2, 0.05, "sine", 1200);
    }

    hole(): void {
        // Falling - descending whistle
        this.tone(800, 0.6, 0.06, "sine", 100);
    }
}
