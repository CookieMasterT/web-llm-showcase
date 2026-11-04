import { initNavigation } from "./ui/navigation.js";
import { initModelSetup } from "./ui/modelSetup.js";
import { initChatView } from "./ui/chatView.js";
import { initControls } from "./ui/controls.js";
import { initLogging } from "./utils/logger.js";
import { initDebugConsole } from "./utils/debug.js";
import { initGlobalErrorHandlers } from "./utils/errorHandler.js";

// Initialize application modules
initDebugConsole();
initLogging();
initGlobalErrorHandlers();
initNavigation();
initModelSetup();
initChatView();
initControls();
