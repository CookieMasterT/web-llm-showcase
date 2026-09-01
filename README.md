# Web LLM Showcase

This project is a showcase of LLM inference running directly in your browser using the `web-llm-unlocked` project.

## Prerequisites

Make sure you have the following installed:
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [Git](https://git-scm.com/)

---

## Quick Start

### 1. Clone the Repository

Clone the repository along with its submodule:

```bash
git clone --recurse-submodules https://github.com/CookieMasterT/web-llm-showcase.git
cd web-llm-showcase
```

Note: If you already cloned the repository without --recurse-submodules, run:
```bash
git submodule update --init --recursive
```

### 2. Install Dependencies & Build

Run the installation script from the root directory. This installs all dependencies and builds the web-llm-unlocked submodule:
```bash
npm install
```

### 3. Run the Application

Start the local development server:
```bash
npm start
```

Open your browser and navigate to `http://localhost:3000/` (or the URL displayed in your terminal) to use the showcase.