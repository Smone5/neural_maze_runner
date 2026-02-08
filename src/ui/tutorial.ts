
export class TutorialSystem {
    private readonly root: HTMLElement;
    private readonly slides: { title: string; html: string }[];
    private currentSlide: number = 0;
    private overlay: HTMLElement;
    private contentBox: HTMLElement;

    constructor() {
        this.slides = [
            {
                title: "Welcome to RL School! 🎓",
                html: `
          <p>Hi! I'm <strong>Kurt</strong>, your robot friend.</p>
          <p>We are going to do a <strong>Science Experiment</strong> together.</p>
          <p>We want to see if a computer can learn to solve a maze all by itself!</p>
          <div style="text-align: center; font-size: 3rem; margin: 20px;">🤖 🧩</div>
        `
            },
            {
                title: "The Agent (The Mouse) 🐭",
                html: `
          <p>In Science, we call the learner an <strong>Agent</strong>.</p>
          <p>Imagine a robot mouse. It doesn't know the maze yet.</p>
          <p>It has to explore to find the goal.</p>
          <ul>
            <li><strong>Random Agent:</strong> Moves with a blindfold on. (Silly!)</li>
            <li><strong>Smart Agent:</strong> Remembers where it has been.</li>
          </ul>
        `
            },
            {
                title: "Rewards (Cheese & Bonks) 🧀",
                html: `
          <p>How does the Agent learn?</p>
          <p>We give it points!</p>
          <ul class="reward-list">
            <li><strong>+10 Points (Cheese):</strong> Reaching the Goal! 🏆</li>
            <li><strong>-1 Point (Tired):</strong> Taking a step. (We want to be fast!)</li>
            <li><strong>-5 Points (Bonk):</strong> Hitting a wall. Ouch! 🤕</li>
          </ul>
          <p>The Agent wants to get the <strong>Most Points Possible</strong>.</p>
        `
            },
            {
                title: "The Brain (Q-Table) 🧠",
                html: `
          <p>Your agent has a notebook called a <strong>Q-Table</strong>.</p>
          <p>Every time it takes a step, it writes down a score.</p>
          <p><em>"Turn Left here? Bad idea. -5 points."</em></p>
          <p><em>"Go Straight? Good idea! I got closer to the goal."</em></p>
          <p>Over time, the notebook gets full of good advice!</p>
        `
            },
            {
                title: "The Scientific Method 🧪",
                html: `
          <p>To be real scientists, we need to compare things.</p>
          <p><strong>Hypothesis:</strong> "I bet the Smart Agent is faster than the Random Agent."</p>
          <p><strong>Control Group:</strong> The Random Agent (to see what happens with NO learning).</p>
          <p>Let's run the experiment and see if you are right!</p>
        `
            },
            {
                title: "Your Missions 🚀",
                html: `
          <p>In the <strong>Missions</strong> tab, you'll solve puzzles by training AI.</p>
          <p>Each mission has a simple flow:</p>
          <ol>
            <li><strong>The Lesson:</strong> Read the strategy on the left sidebar.</li>
            <li><strong>Watch Learning:</strong> Click the big button to watch the AI practice.</li>
            <li><strong>Mastery Quiz:</strong> When you're ready, answer a question to finish!</li>
          </ol>
        `
            },
            {
                title: "Cleared for Takeoff! ✅",
                html: `
          <p>Solving missions earns you <strong>XP</strong> and unlocks new levels.</p>
          <p>If you ever get stuck, look for me (Kurt) in the sidebar for tips.</p>
          <p>Good luck, Scientist!</p>
          <div style="text-align: center; font-size: 3rem; margin: 20px;">🎮 🧠</div>
        `
            }
        ];

        this.root = document.createElement("div");
        this.root.className = "tutorial-overlay";
        this.root.style.display = "none";

        this.overlay = document.createElement("div");
        this.overlay.className = "tutorial-backdrop";

        this.contentBox = document.createElement("div");
        this.contentBox.className = "tutorial-box glassy-panel";

        this.root.append(this.overlay, this.contentBox);
        document.body.append(this.root);

        this.overlay.onclick = () => this.close();
    }

    start() {
        this.currentSlide = 0;
        this.render();
        this.root.style.display = "flex";
    }

    close() {
        this.root.style.display = "none";
    }

    private render() {
        const slide = this.slides[this.currentSlide];
        this.contentBox.innerHTML = "";

        const h2 = document.createElement("h2");
        h2.textContent = slide.title;

        const body = document.createElement("div");
        body.className = "tutorial-body";
        body.innerHTML = slide.html;

        const controls = document.createElement("div");
        controls.className = "tutorial-controls";

        const backBtn = document.createElement("button");
        backBtn.textContent = "Back";
        backBtn.disabled = this.currentSlide === 0;
        backBtn.onclick = () => {
            this.currentSlide--;
            this.render();
        };

        const nextBtn = document.createElement("button");
        nextBtn.className = "action-btn";
        const isLast = this.currentSlide === this.slides.length - 1;
        nextBtn.textContent = isLast ? "Let's Go!" : "Next";
        nextBtn.onclick = () => {
            if (isLast) {
                this.close();
            } else {
                this.currentSlide++;
                this.render();
            }
        };

        controls.append(backBtn, nextBtn);
        this.contentBox.append(h2, body, controls);
    }
}
