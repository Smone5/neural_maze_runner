export class LandingPage {
    public root: HTMLDivElement;
    private onStart: () => void;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.root = document.createElement("div");
        this.root.className = "landing-overlay";
        this.render();
    }

    private render() {
        // Structure:
        // - Background (transparent, clicks pass through to 3D if we want, but better to block interaction until start)
        // - Content Container (Centered)
        //   - H1 Title
        //   - H2 Tagline
        //   - CTA Button
        //   - Feature Grid

        const content = document.createElement("div");
        content.className = "landing-content";

        // 1. Hero Text
        const h1 = document.createElement("h1");
        h1.innerHTML = `<span class="glitch" data-text="NEURAL">NEURAL</span> <span class="highlight">MAZE</span> RUNNER`;
        h1.className = "landing-title";

        const h2 = document.createElement("h2");
        h2.textContent = "Train AI. Race the Machine. Master the Code.";
        h2.className = "landing-subtitle";

        // 2. Main CTA
        const startBtn = document.createElement("button");
        startBtn.className = "btn-start-mission";
        startBtn.innerHTML = `<span>INITIALIZE MISSION</span> <div class="btn-glare"></div>`;
        startBtn.onclick = () => this.handleStart();

        // 3. Features Grid
        const grid = document.createElement("div");
        grid.className = "landing-features";

        const features = [
            {
                icon: "🧠",
                title: "Train AI Agents",
                desc: "Build Q-Learning & SARSA models from scratch."
            },
            {
                icon: "🏎️",
                title: "Man vs. Machine",
                desc: "Race your own AI in real-time 3D mazes."
            },
            {
                icon: "🔬",
                title: "Visual Labs",
                desc: "Watch neural networks learn and adapt live."
            }
        ];

        features.forEach(f => {
            const col = document.createElement("div");
            col.className = "feature-col";
            col.innerHTML = `
        <div class="feature-icon">${f.icon}</div>
        <h3>${f.title}</h3>
        <p>${f.desc}</p>
      `;
            grid.appendChild(col);
        });

        content.append(h1, h2, startBtn, grid);

        // Footer / Credits
        const footer = document.createElement("div");
        footer.className = "landing-footer";

        const text = document.createElement("span");
        text.textContent = "Created by ";

        const link = document.createElement("a");
        link.href = "https://www.aivoyages.net/";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.referrerPolicy = "no-referrer";
        link.className = "footer-link";
        link.setAttribute("aria-label", "Open AI Voyages website (external link)");
        link.onclick = (event) => {
            const ok = window.confirm(
                "This opens an external website. Please ask a parent or teacher first. Continue?"
            );
            if (!ok) {
                event.preventDefault();
            }
        };

        const logoImg = document.createElement("img");
        logoImg.src = "/assets/ai_voyages_logo_small.png";
        logoImg.alt = "AI Voyages LLC";
        logoImg.className = "footer-logo";

        link.appendChild(logoImg);
        link.appendChild(document.createTextNode(" AI Voyages LLC"));

        const privacyLink = document.createElement("a");
        privacyLink.href = "/privacy.html";
        privacyLink.target = "_blank";
        privacyLink.rel = "noopener noreferrer";
        privacyLink.className = "footer-link footer-link-secondary";
        privacyLink.textContent = "Privacy & Safety";
        privacyLink.setAttribute("aria-label", "Open privacy and safety notice in a new tab");

        footer.appendChild(text);
        footer.appendChild(link);
        footer.appendChild(privacyLink);

        content.append(footer);
        this.root.append(content);
    }

    private handleStart() {
        // Animate out
        this.root.classList.add("fade-out");

        // Play sound (if we had access directly, or rely on callback)
        // We'll rely on callback to trigger main app sound/music

        // Wait for animation to finish then unmount
        setTimeout(() => {
            this.root.style.display = "none";
            this.onStart();
        }, 800);
    }
}
