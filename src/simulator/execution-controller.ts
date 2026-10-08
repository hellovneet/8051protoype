/**
 * Micro8051SiM Execution Controller & Simulator Engine
 * High-performance cycle scheduler, breakpoint management, and UI throttling.
 */

import { CPU8051 } from '../core/cpu/cpu.ts';
import { PeripheralsManager } from '../peripherals/peripherals.ts';
import { ClockSpeedHz, SimulationSpeed, ConsoleMessage } from '../core/types.ts';

export type SimulatorStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'BREAKPOINT' | 'HALTED';

export interface ControllerCallbacks {
  onStatusChange?: (status: SimulatorStatus) => void;
  onStateUpdate?: () => void;
  onConsoleLog?: (msg: Omit<ConsoleMessage, 'id' | 'timestamp'>) => void;
  onBreakpointHit?: (address: number, line?: number) => void;
}

export class ExecutionController {
  public cpu: CPU8051;
  public peripherals: PeripheralsManager;

  public status: SimulatorStatus = 'READY';
  public clockHz: ClockSpeedHz = 12000000; // 12 MHz default
  public speedMultiplier: SimulationSpeed = 1;

  // Breakpoints: set of code addresses
  public breakpoints: Set<number> = new Set();
  // Address to source line mapping (from assembler)
  public addressToLine: Map<number, number> = new Map();
  public lineToAddress: Map<number, number> = new Map();

  // Step-over target address (if stepping over LCALL/ACALL)
  private stepOverTarget: number | null = null;

  // Animation / execution loop handles
  private animFrameId: number | null = null;
  private lastFrameTime = 0;

  // UI state throttling
  private lastUiUpdateTime = 0;
  private readonly UI_UPDATE_INTERVAL_MS = 33; // ~30 fps UI refresh during continuous execution

  private callbacks: ControllerCallbacks = {};

  constructor(cpu: CPU8051, peripherals: PeripheralsManager, callbacks: ControllerCallbacks = {}) {
    this.cpu = cpu;
    this.peripherals = peripherals;
    this.callbacks = callbacks;

    // Connect CPU serial transmit to peripherals manager
    this.cpu.onSerialTransmit = (byte: number) => {
      this.peripherals.onCpuSerialTransmit(byte);
      this.log('uart', `TX: '${byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : `0x${byte.toString(16).toUpperCase()}`}'`);
    };
  }

  public setCallbacks(callbacks: ControllerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setStatus(newStatus: SimulatorStatus): void {
    this.status = newStatus;
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(newStatus);
    }
  }

  public log(type: ConsoleMessage['type'], text: string): void {
    if (this.callbacks.onConsoleLog) {
      this.callbacks.onConsoleLog({ type, text });
    }
  }

  // --- BREAKPOINT MANAGEMENT ---

  public toggleBreakpointAtLine(line: number): boolean {
    const addr = this.lineToAddress.get(line);
    if (addr !== undefined) {
      if (this.breakpoints.has(addr)) {
        this.breakpoints.delete(addr);
        return false;
      } else {
        this.breakpoints.add(addr);
        return true;
      }
    }
    return false;
  }

  public toggleBreakpointAtAddress(address: number): boolean {
    if (this.breakpoints.has(address)) {
      this.breakpoints.delete(address);
      return false;
    } else {
      this.breakpoints.add(address);
      return true;
    }
  }

  public hasBreakpointAtLine(line: number): boolean {
    const addr = this.lineToAddress.get(line);
    return addr !== undefined && this.breakpoints.has(addr);
  }

  public clearAllBreakpoints(): void {
    this.breakpoints.clear();
  }

  // --- EXECUTION CONTROLS ---

  public run(): void {
    if (this.status === 'RUNNING') return;

    this.setStatus('RUNNING');
    this.lastFrameTime = performance.now();
    this.loop();
  }

  public pause(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.setStatus('PAUSED');
    this.notifyUi();
  }

  public stop(): void {
    this.pause();
    this.setStatus('READY');
  }

  public reset(): void {
    this.pause();
    this.cpu.reset(true);
    this.peripherals.reset();
    this.stepOverTarget = null;
    this.setStatus('READY');
    this.log('cpu', `CPU & Peripherals reset. PC: 0000H`);
    this.notifyUi();
  }

  public step(): void {
    this.pause();
    this.executeSingleStep();
    this.setStatus('PAUSED');
    this.notifyUi();
  }

  public stepOver(): void {
    this.pause();
    const pc = this.cpu.state.pc;
    const op = this.cpu.state.codeMemory[pc];

    // Check if LCALL (0x12) or ACALL (op & 0x1F === 0x11)
    const isCall = op === 0x12 || (op & 0x1F) === 0x11;
    if (isCall) {
      const instrLen = op === 0x12 ? 3 : 2;
      this.stepOverTarget = (pc + instrLen) & 0xFFFF;
      this.run();
    } else {
      this.step();
    }
  }

  private executeSingleStep(): boolean {
    // 1. Update external inputs into CPU
    this.peripherals.updateInputsToCpu(this.cpu.state);

    // 2. Execute 1 instruction
    this.cpu.step();

    // 3. Update peripherals from CPU outputs
    this.peripherals.updateOutputsFromCpu(this.cpu.state);

    return true;
  }

  private loop = (): void => {
    if (this.status !== 'RUNNING') return;

    const now = performance.now();
    const dt = Math.min(now - this.lastFrameTime, 100); // limit to 100ms delta to prevent huge jumps
    this.lastFrameTime = now;

    // Calculate instructions or machine cycles for this frame
    // 8051 machine cycle = 12 clock ticks.
    // 12MHz = 1,000,000 machine cycles/sec = 1,000 machine cycles/ms.
    const machineCyclesPerSec = this.clockHz / 12;
    const targetCyclesThisFrame =
      this.speedMultiplier === 999
        ? 50000 // Unlimited: batch of 50K cycles per frame
        : Math.round((machineCyclesPerSec * (dt / 1000)) * this.speedMultiplier);

    let executedCycles = 0;
    let hitBreakpoint = false;

    while (executedCycles < targetCyclesThisFrame && !hitBreakpoint) {
      const pc = this.cpu.state.pc;

      // Check step-over target
      if (this.stepOverTarget !== null && pc === this.stepOverTarget) {
        this.stepOverTarget = null;
        this.pause();
        this.notifyUi();
        return;
      }

      // Check breakpoints
      if (this.breakpoints.has(pc)) {
        hitBreakpoint = true;
        this.pause();
        this.setStatus('BREAKPOINT');
        const line = this.addressToLine.get(pc);
        this.log('cpu', `Breakpoint reached at 0x${pc.toString(16).toUpperCase().padStart(4, '0')}${line ? ` (line ${line})` : ''}`);
        if (this.callbacks.onBreakpointHit) {
          this.callbacks.onBreakpointHit(pc, line);
        }
        this.notifyUi();
        return;
      }

      // Execute instruction
      this.peripherals.updateInputsToCpu(this.cpu.state);
      const cycles = this.cpu.step();
      this.peripherals.updateOutputsFromCpu(this.cpu.state);

      executedCycles += Math.max(1, cycles);

      if (this.cpu.state.isHalted) {
        this.pause();
        this.setStatus('HALTED');
        this.log('cpu', 'CPU execution halted.');
        this.notifyUi();
        return;
      }
    }

    // Throttle UI re-renders to prevent lagging
    if (now - this.lastUiUpdateTime >= this.UI_UPDATE_INTERVAL_MS) {
      this.lastUiUpdateTime = now;
      this.notifyUi();
    }

    if (this.status === 'RUNNING') {
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  };

  private notifyUi(): void {
    if (this.callbacks.onStateUpdate) {
      this.callbacks.onStateUpdate();
    }
  }
}
