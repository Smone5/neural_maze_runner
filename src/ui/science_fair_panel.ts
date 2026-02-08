import { ExperimentPanel } from "./experiment_panel";

export class ScienceFairPanel {
  readonly root: HTMLElement;

  // Inputs (Public for read access or internal use)
  public scienceEpisodesInput!: HTMLInputElement;
  public scienceTrialsInput!: HTMLInputElement;
  public compareRandomCheck!: HTMLInputElement;
  public compareQLearnCheck!: HTMLInputElement;
  public compareSarsaCheck!: HTMLInputElement;
  public compareExpectedSarsaCheck!: HTMLInputElement;
  public compareDoubleQCheck!: HTMLInputElement;

  // Research
  private topic1Input!: HTMLTextAreaElement;
  private topic2Input!: HTMLTextAreaElement;
  private sourcesInput!: HTMLTextAreaElement;

  // Plan
  private purposeInput!: HTMLTextAreaElement;
  private hypothesisInput!: HTMLTextAreaElement;
  private hypothesisWhyInput!: HTMLTextAreaElement;
  private variableSelect!: HTMLSelectElement;
  private variableWhyInput!: HTMLTextAreaElement;
  private controlSelect!: HTMLSelectElement;

  // Observation
  private observationLog!: HTMLTextAreaElement;

  // Conclusion
  private conclusionSelect!: HTMLSelectElement;
  private resultsSummaryInput!: HTMLTextAreaElement;
  private lifeConnectionInput!: HTMLTextAreaElement;

  // Wizard State
  private currentStep = 1;
  private totalSteps = 5;
  private steps: HTMLElement[] = [];
  private navDots: HTMLElement[] = [];
  private expertSpeech!: HTMLElement;
  private expertAvatar!: HTMLElement;

  // Depedencies
  private experimentPanel: ExperimentPanel;

  constructor(experimentPanel: ExperimentPanel) {
    this.experimentPanel = experimentPanel;

    // Root Container
    this.root = document.createElement("div");
    this.root.className = "science-wizard-container";

    // Initialize Inputs
    this.initInputs();

    // Build UI
    this.buildWizardUI();
    this.goToStep(1);
  }

  private initInputs() {
    // --- Step 3 Setup Inputs ---
    this.scienceEpisodesInput = this.createInput("number", "50");
    this.scienceEpisodesInput.min = "1"; this.scienceEpisodesInput.max = "500";
    this.scienceTrialsInput = this.createInput("number", "3");
    this.scienceTrialsInput.min = "3"; this.scienceTrialsInput.max = "20";

    this.compareRandomCheck = this.createCheckbox(true);
    this.compareQLearnCheck = this.createCheckbox(true);
    this.compareSarsaCheck = this.createCheckbox(true);
    this.compareExpectedSarsaCheck = this.createCheckbox(true);
    this.compareDoubleQCheck = this.createCheckbox(true);

    // --- Step 1 Research Inputs ---
    this.topic1Input = this.createTextArea("Example: I learned that robots use rewards to know if they did a good job...");
    this.topic2Input = this.createTextArea("Example: I learned that the shortest path is not always the easiest to find...");
    this.sourcesInput = this.createTextArea("1. Website: www.ai-for-kids.com\n2. Expert: My Science Teacher", 2);

    // --- Step 2 Plan Inputs ---
    this.purposeInput = this.createTextArea("The purpose of this project is to find out if...");
    this.hypothesisInput = this.createTextArea("If I use [Brain Type], then the robot will...");
    this.hypothesisWhyInput = this.createTextArea("I chose this because my research says...");
    this.variableWhyInput = this.createTextArea("I am changing this because...");

    this.variableSelect = document.createElement("select");
    ["The Algorithm (Brain Type)", "The Maze Layout", "The Reward Values"].forEach(o => this.variableSelect.add(new Option(o, o)));

    this.controlSelect = document.createElement("select");
    ["Random Agent (No Brain)", "Q-Learning (Normal Brain)"].forEach(o => this.controlSelect.add(new Option(o, o)));

    // --- Step 4 Observation ---
    this.observationLog = this.createTextArea("Example: I noticed at episode 10, the robot started to turn left more often...", 6);
    this.observationLog.className = "observation-log";

    // --- Step 5 Conclusion ---
    this.resultsSummaryInput = this.createTextArea("The Smart Brain reached 100% success after 50 episodes...");
    this.lifeConnectionInput = this.createTextArea("This algorithm could be used to help real delivery robots...");

    this.conclusionSelect = document.createElement("select");
    ["-- Select One --", "Yes, the data supported my hypothesis.", "No, the data did NOT support my hypothesis.", "The results were mixed."].forEach(o => this.conclusionSelect.add(new Option(o, o)));
  }

  private createInput(type: string, value: string): HTMLInputElement {
    const i = document.createElement("input");
    i.type = type;
    i.value = value;
    return i;
  }

  private createCheckbox(checked: boolean): HTMLInputElement {
    const i = document.createElement("input");
    i.type = "checkbox";
    i.checked = checked;
    return i;
  }

  private createTextArea(placeholder: string, rows = 3): HTMLTextAreaElement {
    const t = document.createElement("textarea");
    t.placeholder = placeholder;
    t.rows = rows;
    return t;
  }

  private buildWizardUI() {
    // 1. Tree of Thought Header (Progress)
    const treeHeader = document.createElement("div");
    treeHeader.className = "wizard-tree-header";
    this.root.append(treeHeader);

    // Nodes
    const nodes = [
      { id: 1, label: "Research", icon: "🧠" },
      { id: 2, label: "Plan", icon: "📐" },
      { id: 3, label: "Setup", icon: "⚡" },
      { id: 4, label: "Test", icon: "👁️" },
      { id: 5, label: "Results", icon: "⚖️" }
    ];

    nodes.forEach((n, idx) => {
      const node = document.createElement("div");
      node.className = "wizard-node";
      node.innerHTML = `<div class="node-icon">${n.icon}</div><div class="node-label">${n.id}. ${n.label}</div>`;
      node.onclick = () => this.goToStep(n.id);
      treeHeader.append(node);
      this.navDots.push(node);

      if (idx < nodes.length - 1) {
        const line = document.createElement("div");
        line.className = "wizard-line";
        treeHeader.append(line);
      }
    });

    // 2. Expert Banner
    const expertBanner = document.createElement("div");
    expertBanner.className = "expert-banner";
    this.expertAvatar = document.createElement("div");
    this.expertAvatar.className = "expert-avatar";
    this.expertSpeech = document.createElement("div");
    this.expertSpeech.className = "expert-speech";
    expertBanner.append(this.expertAvatar, this.expertSpeech);
    this.root.append(expertBanner);

    // 3. Wizard Content Area
    const contentArea = document.createElement("div");
    contentArea.className = "wizard-content";
    this.root.append(contentArea);

    // --- Build Steps ---

    // Step 1: Research
    const step1 = this.createStep("Research Report");
    step1.append(
      this.createCard("Topic #1: Reinforcement Learning", "How do robots learn?", this.topic1Input),
      this.createCard("Topic #2: The Maze Challenge", "What makes pathfinding hard?", this.topic2Input),
      this.createCard("Sources", "Where did you get this info?", this.sourcesInput)
    );

    // Step 2: Plan
    const step2 = this.createStep("Mission Plan");
    const varForm = document.createElement("div");
    varForm.className = "wizard-form-grid";
    varForm.append(
      this.createField("Independent Variable", "What changes?", this.variableSelect),
      this.createField("Reasoning", "Why change this?", this.variableWhyInput),
      this.createField("Control Group", "Baseline to compare?", this.controlSelect),
      this.createConstantsDisplay()
    );

    step2.append(
      this.createCard("Mission Purpose", "Why are we doing this?", this.purposeInput),
      this.createCard("Hypothesis", "What do you think will happen?", this.hypothesisInput),
      this.createCard("Justification", "Why do you think that?", this.hypothesisWhyInput),
      this.createCard("Variables", "Defining the experiment", varForm)
    );

    // Step 3: Setup
    const step3 = this.createStep("Configuration");
    const paramGrid = document.createElement("div");
    paramGrid.className = "wizard-form-grid";
    paramGrid.append(
      this.createField("Episodes per Trial", "How many attempts?", this.scienceEpisodesInput),
      this.createField("Trials", "Repeats for fairness?", this.scienceTrialsInput)
    );

    const brainRow = document.createElement("div");
    brainRow.className = "science-check-row";
    brainRow.append(
      this.createCheckField("Random Agent", this.compareRandomCheck),
      this.createCheckField("Q-Learning", this.compareQLearnCheck),
      this.createCheckField("SARSA", this.compareSarsaCheck),
      this.createCheckField("Expected SARSA", this.compareExpectedSarsaCheck),
      this.createCheckField("Double Q-learning", this.compareDoubleQCheck)
    );

    step3.append(
      this.createCard("Parameters", "Set the rules of the simulation.", paramGrid),
      this.createCard("Contestants", "Who is competing?", brainRow)
    );

    // Step 4: Test
    const step4 = this.createStep("Test & Observe");
    // Embed runner from ExperimentPanel
    state4_wrapper: {
      const wrapper = document.createElement("div");
      wrapper.className = "runner-wrapper";
      wrapper.append(this.experimentPanel.runnerRoot);
      step4.append(wrapper);
    }
    step4.append(
      this.createCard("Observer's Log", "What do you see happening live?", this.observationLog)
    );

    // Step 5: Results
    const step5 = this.createStep("Analysis");
    step5.append(
      this.createCard("Results Data", "", this.experimentPanel.chartsRoot), // Embed Charts
      this.createCard("Data Analysis", "Summarize the chart data.", this.resultsSummaryInput),
      this.createField("Conclusion", "Did it match your hypothesis?", this.conclusionSelect),
      this.createCard("Real World", "How does this apply to life?", this.lifeConnectionInput)
    );

    const finishBtn = document.createElement("button");
    finishBtn.textContent = "🖨️ Print Final Report";
    finishBtn.className = "btn-primary-action btn-finish";
    finishBtn.onclick = () => this.printProject();
    step5.append(finishBtn);

    this.steps = [step1, step2, step3, step4, step5];
    contentArea.append(...this.steps);

    // 4. Navigation Footer
    const navFooter = document.createElement("div");
    navFooter.className = "wizard-footer";

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "← Back";
    prevBtn.onclick = () => this.goToStep(this.currentStep - 1);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next Step →";
    nextBtn.className = "btn-primary-action";
    nextBtn.onclick = () => {
      // Validation could go here
      this.goToStep(this.currentStep + 1);
    };

    navFooter.append(prevBtn, nextBtn);
    this.root.append(navFooter);
  }

  private createStep(title: string): HTMLElement {
    const s = document.createElement("div");
    s.className = "wizard-step";
    s.style.display = "none";
    return s;
  }

  private createCard(title: string, subtitle: string, content: HTMLElement): HTMLElement {
    const c = document.createElement("div");
    c.className = "wizard-card";
    c.innerHTML = `<h4>${title}</h4>${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ""}`;
    c.append(content);
    return c;
  }

  private createField(label: string, sub: string, input: HTMLElement): HTMLElement {
    const f = document.createElement("label");
    f.className = "wizard-field";
    f.innerHTML = `<strong>${label}</strong><span>${sub}</span>`;
    f.append(input);
    return f;
  }

  private createCheckField(label: string, input: HTMLElement): HTMLElement {
    const l = document.createElement("label");
    l.className = "wizard-check-field";
    l.append(input, document.createTextNode(label));
    return l;
  }

  private createConstantsDisplay(): HTMLElement {
    const d = document.createElement("div");
    d.className = "constants-box";
    d.innerHTML = "<strong>Constants:</strong> Maze Size, Start Position, Goal Position";
    return d;
  }

  public goToStep(step: number) {
    if (step < 1 || step > this.totalSteps) return;
    this.currentStep = step;

    // Update Visibility
    this.steps.forEach((s, i) => s.style.display = (i + 1 === step) ? "grid" : "none");

    // Update Header
    this.navDots.forEach((n, i) => {
      n.classList.toggle("active", i + 1 === step);
      n.classList.toggle("completed", i + 1 < step);
    });

    // Update Expert
    this.updateExpert(step);
  }

  private updateExpert(step: number) {
    const experts = [
      { name: "Dr. Curiosity", role: "Research Expert", color: "#d69aff", text: "Welcome! Every great discovery starts with good questions. Let's gather intel!", icon: "🧠" },
      { name: "Architect Plan", role: "Strategy Expert", color: "#66d9ef", text: "We need a blueprint. What are we testing, and what do we expect to happen?", icon: "📐" },
      { name: "Operator Spark", role: "Systems Expert", color: "#ffd700", text: "Time to configure the machine. Let's set up the simulation parameters.", icon: "⚡" },
      { name: "Observer Eye", role: "Data Expert", color: "#a6e22e", text: "Watch closely! The data we gather here is the most important part.", icon: "👁️" },
      { name: "Judge Truth", role: "Analysis Expert", color: "#f92672", text: "The moment of truth. Does the evidence support your idea? Be honest!", icon: "⚖️" }
    ];

    const exp = experts[step - 1];
    if (exp) {
      this.expertAvatar.innerHTML = exp.icon;
      this.expertAvatar.style.background = exp.color;
      this.expertSpeech.innerHTML = `<strong>${exp.name} (${exp.role})</strong><p>${exp.text}</p>`;
    }
  }

  // --- Prerequisite Check (Keep logic but maybe unused in Wizard flow if navigation allows free movement) ---
  // You might want to block Next button if check fails, but for now we allow free roam.

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private asReportHtml(value: string, fallback = "N/A"): string {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return this.escapeHtml(trimmed).replace(/\n/g, "<br/>");
  }

  private printProject() {
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow popups!"); return; }

    const chartTitles = [
      "Learning Curve: Success by Episode",
      "Compare Success Last 10",
      "Compare Steps Last 10",
    ];
    const chartImages = this.experimentPanel.getChartImageDataUrls();
    const chartsHtml = chartImages.length
      ? chartImages
        .map((src, index) => `
          <figure class="chart">
            <img src="${src}" alt="Experiment chart ${index + 1}" />
            <figcaption>${chartTitles[index] ?? `Chart ${index + 1}`}</figcaption>
          </figure>
        `)
        .join("")
      : `<p>No chart images are available yet. Run the Science Test first.</p>`;

    const content = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Science Fair Project: AI Maze Lab</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 50px; line-height: 1.6; color: #333; }
          h1 { border-bottom: 3px solid #00adef; padding-bottom: 10px; color: #004a7c; }
          h2 { color: #00adef; margin-top: 30px; border-left: 5px solid #00adef; padding-left: 15px; }
          .section { margin-bottom: 25px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
          strong { color: #004a7c; }
          .page-break { page-break-after: always; }
          .meta { font-style: italic; color: #666; margin-bottom: 40px; }
          .chart-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
          .chart { margin: 0; border: 1px solid #ddd; background: #fff; padding: 12px; border-radius: 8px; }
          .chart img { width: 100%; max-width: 900px; height: auto; display: block; margin: 0 auto 8px auto; }
          .chart figcaption { text-align: center; color: #444; font-size: 14px; }
          @media print {
            body { padding: 20px; }
            .chart { break-inside: avoid; }
          }
        </style>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 150);
          });
        </script>
      </head>
      <body>
        <h1>My Science Fair Project: AI Learning</h1>
        <div class="meta">Student Project Notebook | Created with AI Maze Lab</div>

        <h2>I. RESEARCH REPORT</h2>
        <div class="section">
          <strong>Topic #1 (Reinforcement Learning):</strong><br/>
          ${this.asReportHtml(this.topic1Input.value)}
        </div>
        <div class="section">
          <strong>Topic #2 (Maze Navigation):</strong><br/>
          ${this.asReportHtml(this.topic2Input.value)}
        </div>
        <div class="section">
          <strong>Bibliography:</strong><br/>
          ${this.asReportHtml(this.sourcesInput.value)}
        </div>

        <div class="page-break"></div>

        <h2>II. THE PLAN</h2>
        <div class="section">
          <strong>Mission Purpose:</strong><br/>
          ${this.asReportHtml(this.purposeInput.value)}
        </div>
        <div class="section">
          <strong>Hypothesis:</strong> ${this.asReportHtml(this.hypothesisInput.value)}<br/>
          <strong>Justification:</strong> ${this.asReportHtml(this.hypothesisWhyInput.value)}
        </div>
        <div class="section">
          <strong>Independent Variable:</strong> ${this.escapeHtml(this.variableSelect.value)}<br/>
          <strong>Justification:</strong> ${this.asReportHtml(this.variableWhyInput.value)}<br/>
          <strong>Control Group:</strong> ${this.escapeHtml(this.controlSelect.value)}<br/>
          <strong>Constants:</strong> Maze size, Start pos, Goal pos.
        </div>

        <div class="page-break"></div>

        <h2>III. OBSERVATION LOG</h2>
        <div class="section">
          <strong>Live Observations:</strong><br/>
          ${this.asReportHtml(this.observationLog.value, "No observations recorded.")}
        </div>

        <h2>IV. RESULTS CHARTS</h2>
        <div class="section chart-grid">
          ${chartsHtml}
        </div>

        <h2>V. CONCLUSION & ANALYSIS</h2>
        <div class="section">
          <strong>Data Analysis:</strong><br/>
          ${this.asReportHtml(this.resultsSummaryInput.value)}
        </div>
        <div class="section">
          <strong>Conclusion:</strong> ${this.escapeHtml(this.conclusionSelect.value)}
        </div>
        <div class="section">
          <strong>Life Connection:</strong><br/>
          ${this.asReportHtml(this.lifeConnectionInput.value)}
        </div>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(content);
    win.document.close();
  }
}
