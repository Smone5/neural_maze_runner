export class ConfettiSystem {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private particles: Particle[] = [];
    private active = false;
    private width = 0;
    private height = 0;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.position = "fixed";
        this.canvas.style.top = "0";
        this.canvas.style.left = "0";
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.pointerEvents = "none";
        this.canvas.style.zIndex = "9999";
        document.body.appendChild(this.canvas);

        const ctx = this.canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create confetti context");
        this.ctx = ctx;

        this.resize();
        window.addEventListener("resize", () => this.resize());
        this.loop = this.loop.bind(this);
    }

    private resize(): void {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    explode(x: number, y: number): void {
        const colors = ["#ff5a36", "#00d4ff", "#00ff88", "#ffcc00", "#ffffff"];
        for (let i = 0; i < 100; i++) {
            const p = new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]);
            this.particles.push(p);
        }
        if (!this.active) {
            this.active = true;
            this.loop();
        }
    }

    fire(): void {
        const w = this.width;
        const h = this.height;
        this.explode(w * 0.2, h * 0.5);
        this.explode(w * 0.5, h * 0.5);
        this.explode(w * 0.8, h * 0.5);
    }

    private loop(): void {
        if (this.particles.length === 0) {
            this.active = false;
            this.ctx.clearRect(0, 0, this.width, this.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            p.draw(this.ctx);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        requestAnimationFrame(this.loop);
    }
}

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;

    constructor(x: number, y: number, color: string) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 10 + 5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 5;
        this.life = 100 + Math.random() * 50;
        this.size = Math.random() * 8 + 4;
        this.color = color;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }

    update(): void {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // Gravity
        this.vx *= 0.96; // Air resistance
        this.vy *= 0.96;
        this.rotation += this.rotationSpeed;
        this.life--;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;

        ctx.globalAlpha = Math.min(1, this.life / 30);
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}
