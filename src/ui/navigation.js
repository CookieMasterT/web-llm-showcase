import { VIEW_NAVS } from "../config/constants.js";
import { logger } from "../utils/logger.js";

export function initNavigation() {
  VIEW_NAVS.forEach((view) => {
    const navElement = document.getElementById(`nav-${view}`);
    allowNavigation(false);

    // Only allow switching to Chat/Insights if disabled attribute is not present
    navElement.addEventListener("click", () => {
      if (navElement.disabled) {
        return;
      }
      logger.debug(`Navigating to view: "${view}".`);
      VIEW_NAVS.forEach((v) => {
        document.getElementById(`${v}-view`).classList.add("hidden");
        document.getElementById(`nav-${v}`).classList.remove("active");
      });
      document.getElementById(`${view}-view`).classList.remove("hidden");
      document.getElementById(`nav-${view}`).classList.add("active");
    });
  });
}

export function allowNavigation(allow) {
  const blockedViews = ["chat", "insights"];
  blockedViews.forEach((view) => {
    const navElement = document.getElementById(`nav-${view}`);
    if (!navElement) return;

    if (allow) {
      navElement.disabled = false;
      navElement.title = "";
    } else {
      navElement.disabled = true;
      navElement.title = "Please download a model first";
    }
  });
}
