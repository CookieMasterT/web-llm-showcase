# web-llm-showcase
A showcase of LLM inference, running directly in your browser.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Git](https://git-scm.com/)

## Installation & Setup

This repository relies on `web-llm-unlocked` as a Git submodule. Follow these steps to set up the project locally:

### 1. Clone the Repository

Clone the project along with its submodules:

```bash
git clone --recurse-submodules https://github.com/CookieMasterT/web-llm-showcase.git
cd web-llm-showcase
```
Note: If you already cloned the repository without --recurse-submodules, initialize and pull the submodule by running:
    Bash

    git submodule update --init --recursive

### 2. Install Dependencies & Build Submodule

Run the install command from the root directory:
```bash
npm install
```
This will automatically install dependencies and build the `web-llm-unlocked` submodule.

## Running the Application

Start the local development server:
```bash
npm start
```
Then open your browser and navigate to `http://localhost:3000/src/` (or the URL displayed in the terminal) to use the showcase.