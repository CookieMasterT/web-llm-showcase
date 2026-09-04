import { VIEW_NAVS } from "../config/constants.js";
import { logger } from "../utils/logger.js";

export function initNavigation() {
  VIEW_NAVS.forEach((view) => {
    document.getElementById(`nav-${view}`).addEventListener("click", () => {
      // Only allow switching to Chat/Insights if disabled attribute is not present
      if (document.getElementById(`nav-${view}`).hasAttribute("disabled")) {
        logger.debug(`Navigation to "${view}" blocked (tab is disabled).`);
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
