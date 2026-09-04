import { initNavigation } from "./ui/navigation.js";
import { initModelSetup } from "./ui/modelSetup.js";
import { initChatView } from "./ui/chatView.js";
import { initControls } from "./ui/controls.js";
import { initLogging } from "./utils/logger.js";

// Initialize application modules
initLogging();
initNavigation();
initModelSetup();
initChatView();
initControls();
