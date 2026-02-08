# Web RL Maze Lab

A kid-friendly web reinforcement learning lab for science fairs.

## Stack
- Vite + TypeScript
- Canvas 2D renderer
- Three.js block-style 3D view
- Chart.js dashboard and experiment charts

## Features
- Maze editor with validation (size, border walls, single start/goal, BFS reachability)
- Random (control), Q-learning, SARSA, Expected SARSA, and Double Q-learning agents
- Live demo mode with smooth movement + explain box
- Experiment mode (3+ trials) with deterministic seeds and one-click CSV/PNG exports
- Experiment mode includes a milestone check message for expected learning improvement over Random
- Science Fair panel (variables, procedure, observation log, report prompts, citations, packet export)
- Race mode: kid in 3D vs trained greedy policy (best-of-3 tournament, keyboard controls + sound FX)

## Local Development
```bash
npm install
npm run dev
```

Open: [http://localhost:5173](http://localhost:5173)

## Production Build
```bash
npm run build
npm run preview
```

## Deploy on Vercel
1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** and import the repo.
3. Use defaults:
- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
4. Deploy.

The repo also includes `vercel.json` with these settings preconfigured.

## Controls
- `Run Demo`: visual learning run
- `Run Experiment`: runs all algorithms with trials and exports files
- `Race vs AI`: train policy and run a best-of-3 race tournament with keyboard
- `Pause/Resume`: pause active demo/race
- `Speed: Turbo`: disables per-step animation/dashboard updates for faster training
- Keyboard in Race mode:
- `W` / `ArrowUp`: forward
- `A` / `ArrowLeft`: turn left
- `D` / `ArrowRight`: turn right

## Scientific Setup
- Independent variable: algorithm type
- Control group: Random
- Dependent variables: success rate, steps, episode return
- Controlled variables: maze, reward function, start/goal, episodes, max steps, seed policy
- Minimum trials: 3

## License
Free for everyone! This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
