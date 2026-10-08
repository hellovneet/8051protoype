# Micro8051SiM

Micro8051SiM is a practical 8051 microcontroller simulator and virtual lab. It brings the assembler, debugger, CPU state, memory views, and virtual hardware into one place so you can write 8051 assembly and see what happens step by step.

## Run locally

### Requirements
- Node.js

### Setup
1. Install the project dependencies:
   `npm install`
2. If your setup uses Gemini features, add your `GEMINI_API_KEY` to `.env.local`.
3. Start the development server:
   `npm run dev`

Then open the local address shown by Vite in your browser.

## Build

To create a production build, run:

`npm run build`

## Project notes

The simulator is designed as a learning-focused virtual 8051 workbench, with tools for assembling code, stepping through execution, inspecting registers and memory, and experimenting with virtual peripherals.

---

© 2026 Vineet Sharma
