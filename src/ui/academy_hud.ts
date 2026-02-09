import { AdaptiveMissionCoach } from "../core/adaptive_coach";
import { LevelDef } from "../core/levels";

export class AcademyHUD {
    readonly root: HTMLElement;
    private currentMission: LevelDef | null = null;
    private coach: AdaptiveMissionCoach;

    constructor(coach: AdaptiveMissionCoach) {
        this.coach = coach;
        this.root = document.createElement("div");
        this.root.className = "academy-hud";
        this.render();
    }

    setMission(mission: LevelDef | null) {
        this.currentMission = mission;
        this.render();
    }

    render() {
        this.root.innerHTML = "";
        if (!this.currentMission) {
            this.root.hidden = true;
            return;
        }
        this.root.hidden = false;
        this.root.style.display = "";

        const stats = this.coach.getCoachIronyStats();
        const insight = this.coach.getMissionInsight(this.currentMission.id);

        const missionInfo = document.createElement("div");
        missionInfo.className = "hud-mission-info";
        missionInfo.innerHTML = `
      <div class="hud-label">ACTIVE MISSION</div>
      <div class="hud-value">${this.currentMission.title}</div>
      <div class="hud-subvalue">${this.currentMission.lesson}</div>
    `;

        const coachFeedback = document.createElement("div");
        coachFeedback.className = "hud-coach-feedback";
        coachFeedback.innerHTML = `
      <div class="hud-label">COACH INSIGHT</div>
      <div class="hud-tip">${insight.coachTip}</div>
    `;

        const ironyStats = document.createElement("div");
        ironyStats.className = "hud-irony-stats";
        ironyStats.title = stats.ironyMessage;
        ironyStats.innerHTML = `
      <div class="hud-label">COACH BRAIN (RL)</div>
      <div class="hud-value-row">
        <span>Episodes: ${stats.coachEpisodes}</span>
        <span>Stability: ${stats.coachBrainStability}</span>
      </div>
    `;

        this.root.append(missionInfo, coachFeedback, ironyStats);
    }

    refresh() {
        this.render();
    }
}
