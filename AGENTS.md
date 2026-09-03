# AGENTS.md

## Project Overview
- Web app (Vite + Vanilla JS) showcasing WebLLM for running small LLMs in the browser.
- Supports 3 navigation views: setup (model installation), chat (the showcase), and insights (placeholder, will contain an explanation as to what is happening).
- Includes chat messaging, token/prompt visualizations, and model download/configuration.
- Meant for educational purposes, not as a chatbot, therefore AI inteligence itself, or usage convenience are not important, this project is meant to showcase how Generative AI works, and showcase the Inference, all self-contained in a static site, for accessibility.

## Development & Build Commands
- `npm install`: Installs dependencies.
- `npm start`: Starts the local Vite development server.
- `npm run build`: Builds the project for production.
- `npm run test`: Runs test suite (note that the test suite is empty right now).
- `npm run lint`: Runs the linter.

## Codebase Architecture & Key Directories
- `src/`: Application source code, you will do 99% of the work in here.
- `tests/`: Test files and test configurations.

### File Catalog
- `vite.config.js`: Contains Vite configuration, entry points, CSS imports, and other build/serve settings.
- `eslint.config.js`: ESLint configuration defining linting rules and target files.
- `package.json`: Contains project metadata, dependencies, and npm script commands.

- `src/index.html`: The main HTML entry point for the application, only contains raw html, and import maps. When adding new features, you will likely need to modify this.
- `src/index.js`: The primary JavaScript entry point, initializes the app and router, it simply initializes all other modules.
- `src/style.css`: Global styles and CSS rules, not relevant for code changes since it's not a UI component.
- `src/config/constants.js`: Application constants and default configuration values, contains the default model, system prompt and available navigation ids.
- `src/services/chatService.js`: A service for chatView.js, handles the async loop for streaming tokens from the model.
- `src/services/webllmEngine.js`: A service for modelSetup.js and chatService.js, handles initalizing the Webllm backend, responsible for listing available models, does NOT download or run models. 
- `src/state/appState.js`: Contains the application state, contains the current messages, the currently selected model, and whether the inference is stopped or paused.
- `src/ui/chatView.js`: Contains a set of functions used to show the chat inside the ui.
- `src/ui/controls.js`: Binds the 3 inference control buttons: stop, pause and reset, does NOT control the slider, or the message input box.
- `src/ui/modelSetup.js`: Controls the model setup panel, handles downloading models and enabling further progression.
- `src/ui/navigation.js`: Handles the navigation bar (on the left), and whether or not you are allowed to switch to a certain view. doesn't display anything or handle view changes itself.
- `src/ui/tokenDiagnosticsView.js`: Contains the token diagnostics view, it is split into 2 columns, the left column contains the chosen tokens and special tokens, and the right column contains the current tokens probabilities over all tokens.
- `src/utils/probabilityMath.js`: Contains the probability math, which is used to convert the token odds given by the backend into real probabilities (accounting for temperature, and accounting for top-p to show the real probabilities of the tokens).

## Agent Guidelines & Conventions
- This project uses Vanilla JS, so no React, or other frontend frameworks. All UI components are built using Vanilla JS and HTML.
- Don't use TailwindCSS, you can use the existing CSS, but don't add new Tailwind classes.
- This project does not contain chat history, please do not hallucinate it containing chat history.
