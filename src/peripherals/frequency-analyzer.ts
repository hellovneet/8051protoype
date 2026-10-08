/**
 * Micro8051SiM Pin Frequency & Duty Cycle Analyzer
 * Cycle-accurate multi-channel logic probe measuring toggling frequency,
 * duty cycle, high/low pulse widths, edge counts, and digital waveform history
 * across multiple pins simultaneously (e.g., P1.0 through P1.3).
 */

import { ClockSpeedHz } from '../core/types.ts';

export interface PinProbeTarget {
  port: number; // 0, 1, 2, 3
  pin: number;  // 0 to 7
  label: string;
}

export interface LogicTransition {
  cycle: number;
  level: 0 | 1;
}

export interface FrequencyAnalysisMetrics {
  frequencyHz: number;
  periodUs: number;
  periodCycles: number;
  dutyCyclePercent: number;
  highTimeUs: number;
  highCycles: number;
  lowTimeUs: number;
  lowCycles: number;
  currentLevel: 0 | 1;
  totalEdges: number;
  risingEdges: number;
  fallingEdges: number;
  isOscillating: boolean;
  isStatic: boolean;
  statusText: string;
  lastEdgeCycle: number;
}

export const CHANNEL_COLORS = [
  '#f59e0b', // Ch 0: Amber / Yellow
  '#38bdf8', // Ch 1: Cyan
  '#4ade80', // Ch 2: Bright Green
  '#f472b6', // Ch 3: Pink / Magenta
  '#fb923c', // Ch 4: Orange
  '#c084fc', // Ch 5: Purple
  '#a3e635', // Ch 6: Lime
  '#22d3ee', // Ch 7: Sky
];

/**
 * Cycle-accurate tracker for a single physical MCU pin.
 */
export class SinglePinTracker {
  public port: number;
  public pin: number;
  public key: string;
  public label: string;
  public color: string;
  public enabled: boolean;

  // Measurement state
  public lastLevel: 0 | 1 = 1;
  public lastEdgeCycle = 0;
  public lastRisingCycle = 0;
  public lastFallingCycle = 0;

  public currentHighCycles = 0;
  public currentLowCycles = 0;
  public currentPeriodCycles = 0;

  // Filtered/smoothed values
  public smoothedPeriodCycles = 0;
  public smoothedHighCycles = 0;

  // Counters
  public totalEdges = 0;
  public risingEdges = 0;
  public fallingEdges = 0;

  // Waveform transition history (max 512 edges for comprehensive CSV export)
  private readonly MAX_HISTORY = 512;
  public history: LogicTransition[] = [];

  constructor(port: number, pin: number, label?: string, color = '#f59e0b', enabled = false) {
    this.port = port;
    this.pin = pin;
    this.key = `P${port}.${pin}`;
    this.label = label ?? this.key;
    this.color = color;
    this.enabled = enabled;
  }

  public reset(): void {
    this.lastLevel = 1;
    this.lastEdgeCycle = 0;
    this.lastRisingCycle = 0;
    this.lastFallingCycle = 0;
    this.currentHighCycles = 0;
    this.currentLowCycles = 0;
    this.currentPeriodCycles = 0;
    this.smoothedPeriodCycles = 0;
    this.smoothedHighCycles = 0;
    this.totalEdges = 0;
    this.risingEdges = 0;
    this.fallingEdges = 0;
    this.history = [];
  }

  public sample(level: 0 | 1, currentCycle: number): void {
    if (level !== this.lastLevel) {
      const deltaCycles = Math.max(1, currentCycle - this.lastEdgeCycle);
      this.totalEdges++;

      if (level === 1) {
        // RISING EDGE (0 -> 1)
        this.risingEdges++;
        this.currentLowCycles = deltaCycles;
        this.lastRisingCycle = currentCycle;

        if (this.currentHighCycles > 0) {
          const rawPeriod = this.currentHighCycles + this.currentLowCycles;
          this.currentPeriodCycles = rawPeriod;

          if (this.smoothedPeriodCycles === 0) {
            this.smoothedPeriodCycles = rawPeriod;
            this.smoothedHighCycles = this.currentHighCycles;
          } else {
            this.smoothedPeriodCycles = Math.round(this.smoothedPeriodCycles * 0.75 + rawPeriod * 0.25);
            this.smoothedHighCycles = Math.round(this.smoothedHighCycles * 0.75 + this.currentHighCycles * 0.25);
          }
        }
      } else {
        // FALLING EDGE (1 -> 0)
        this.fallingEdges++;
        this.currentHighCycles = deltaCycles;
        this.lastFallingCycle = currentCycle;

        if (this.currentLowCycles > 0) {
          const rawPeriod = this.currentHighCycles + this.currentLowCycles;
          this.currentPeriodCycles = rawPeriod;

          if (this.smoothedPeriodCycles === 0) {
            this.smoothedPeriodCycles = rawPeriod;
            this.smoothedHighCycles = this.currentHighCycles;
          } else {
            this.smoothedPeriodCycles = Math.round(this.smoothedPeriodCycles * 0.75 + rawPeriod * 0.25);
            this.smoothedHighCycles = Math.round(this.smoothedHighCycles * 0.75 + this.currentHighCycles * 0.25);
          }
        }
      }

      this.lastLevel = level;
      this.lastEdgeCycle = currentCycle;

      this.history.push({ cycle: currentCycle, level });
      if (this.history.length > this.MAX_HISTORY) {
        this.history.shift();
      }
    }
  }

  public getMetrics(currentCycle: number, clockHz: number): FrequencyAnalysisMetrics {
    const level = this.lastLevel;
    const cyclesSinceLastEdge = currentCycle - this.lastEdgeCycle;

    // Timeout logic: if no edge for > 4 periods (or 100,000 cycles ~ 100ms)
    const timeoutCycles = Math.max(100000, (this.currentPeriodCycles || 1000) * 4);
    const isStatic = this.totalEdges < 2 || cyclesSinceLastEdge > timeoutCycles;
    const isOscillating = !isStatic && this.currentPeriodCycles > 0;

    const periodCycles = isOscillating
      ? (this.smoothedPeriodCycles > 0 ? this.smoothedPeriodCycles : this.currentPeriodCycles)
      : 0;

    const highCycles = isOscillating
      ? (this.smoothedHighCycles > 0 ? this.smoothedHighCycles : this.currentHighCycles)
      : (level === 1 ? cyclesSinceLastEdge : 0);

    const lowCycles = isOscillating
      ? Math.max(0, periodCycles - highCycles)
      : (level === 0 ? cyclesSinceLastEdge : 0);

    const cycleDurationUs = (12 * 1000000) / clockHz;

    let frequencyHz = 0;
    let periodUs = 0;
    let highTimeUs = 0;
    let lowTimeUs = 0;
    let dutyCyclePercent = level === 1 ? 100 : 0;

    if (isOscillating && periodCycles > 0) {
      periodUs = periodCycles * cycleDurationUs;
      frequencyHz = periodUs > 0 ? 1000000 / periodUs : 0;
      highTimeUs = highCycles * cycleDurationUs;
      lowTimeUs = lowCycles * cycleDurationUs;
      dutyCyclePercent = Math.min(100, Math.max(0, (highCycles / periodCycles) * 100));
    }

    let statusText = 'STATIC LOW (0V / GND)';
    if (isOscillating) {
      if (Math.abs(dutyCyclePercent - 50) < 2) {
        statusText = 'SQUARE WAVE (50%)';
      } else {
        statusText = `PWM (${dutyCyclePercent.toFixed(1)}% DUTY)`;
      }
    } else if (level === 1) {
      statusText = 'STATIC HIGH (+5V / VCC)';
    }

    return {
      frequencyHz,
      periodUs,
      periodCycles,
      dutyCyclePercent,
      highTimeUs,
      highCycles,
      lowTimeUs,
      lowCycles,
      currentLevel: level,
      totalEdges: this.totalEdges,
      risingEdges: this.risingEdges,
      fallingEdges: this.fallingEdges,
      isOscillating,
      isStatic,
      statusText,
      lastEdgeCycle: this.lastEdgeCycle,
    };
  }
}

/**
 * Frequency Analyzer supporting single and multi-pin simultaneous logic analysis.
 */
export class FrequencyAnalyzer {
  public probeTarget: PinProbeTarget = { port: 1, pin: 0, label: 'P1.0 (LED 0)' };
  public clockHz: ClockSpeedHz = 12000000;

  // Trackers dictionary keyed by "P{port}.{pin}"
  public trackers: Map<string, SinglePinTracker> = new Map();

  // Frozen / Hold state
  public isHold = false;
  private heldMetrics: FrequencyAnalysisMetrics | null = null;

  constructor(target?: Partial<PinProbeTarget>, clockHz: ClockSpeedHz = 12000000) {
    if (target) {
      this.probeTarget = { ...this.probeTarget, ...target };
    }
    this.clockHz = clockHz;

    // Initialize all 8 pins of Port 1 by default
    for (let pin = 0; pin < 8; pin++) {
      const color = CHANNEL_COLORS[pin % CHANNEL_COLORS.length];
      const tracker = new SinglePinTracker(1, pin, `P1.${pin}`, color, pin === 0);
      this.trackers.set(`P1.${pin}`, tracker);
    }

    // Initialize common Port 3 pins
    const p3Pins = [0, 1, 4, 5];
    for (const pin of p3Pins) {
      const color = CHANNEL_COLORS[pin % CHANNEL_COLORS.length];
      const tracker = new SinglePinTracker(3, pin, `P3.${pin}`, color, false);
      this.trackers.set(`P3.${pin}`, tracker);
    }

    // Ensure primary probe target exists and is enabled
    this.ensureTracker(this.probeTarget.port, this.probeTarget.pin, this.probeTarget.label, true);
  }

  /**
   * Retrieve or create a tracker for any port/pin combination.
   */
  public ensureTracker(port: number, pin: number, label?: string, enabled = false): SinglePinTracker {
    const key = `P${port}.${pin}`;
    let tracker = this.trackers.get(key);
    if (!tracker) {
      const color = CHANNEL_COLORS[pin % CHANNEL_COLORS.length];
      tracker = new SinglePinTracker(port, pin, label ?? key, color, enabled);
      this.trackers.set(key, tracker);
    } else {
      if (label) tracker.label = label;
      if (enabled) tracker.enabled = true;
    }
    return tracker;
  }

  public getTracker(port: number, pin: number): SinglePinTracker | undefined {
    return this.trackers.get(`P${port}.${pin}`);
  }

  /**
   * Set primary probe target (and ensure it's enabled in the signal view).
   */
  public setProbe(port: number, pin: number, label?: string): void {
    const p = Math.max(0, Math.min(3, port));
    const b = Math.max(0, Math.min(7, pin));
    this.probeTarget = {
      port: p,
      pin: b,
      label: label ?? `P${p}.${b}`,
    };
    const tracker = this.ensureTracker(p, b, label, true);
    tracker.enabled = true;
  }

  /**
   * Toggle a specific pin on or off in the multi-channel signal view.
   */
  public togglePin(port: number, pin: number, forceState?: boolean): boolean {
    const tracker = this.ensureTracker(port, pin);
    const nextState = forceState !== undefined ? forceState : !tracker.enabled;
    tracker.enabled = nextState;

    // If we just disabled the primary probe target, find another enabled pin as primary
    if (!nextState && this.probeTarget.port === port && this.probeTarget.pin === pin) {
      const remaining = this.getEnabledTrackers();
      if (remaining.length > 0) {
        this.probeTarget = {
          port: remaining[0].port,
          pin: remaining[0].pin,
          label: remaining[0].label,
        };
      }
    } else if (nextState) {
      // If no pin was enabled or user specifically toggled this pin
      this.probeTarget = {
        port: tracker.port,
        pin: tracker.pin,
        label: tracker.label,
      };
    }
    return tracker.enabled;
  }

  public isPinEnabled(port: number, pin: number): boolean {
    const tracker = this.trackers.get(`P${port}.${pin}`);
    return tracker ? tracker.enabled : false;
  }

  /**
   * Quick multi-pin presets.
   */
  public setMultiPinPreset(preset: 'single' | 'nibble' | 'byte'): void {
    // Disable all currently enabled pins first
    for (const tracker of this.trackers.values()) {
      tracker.enabled = false;
    }

    if (preset === 'single') {
      // Single probe on P1.0
      this.setProbe(1, 0, 'P1.0 (LED 0)');
    } else if (preset === 'nibble') {
      // P1.0 through P1.3 simultaneously
      for (let pin = 0; pin < 4; pin++) {
        const tracker = this.ensureTracker(1, pin, `P1.${pin} (Bit ${pin})`, true);
        tracker.enabled = true;
      }
      this.probeTarget = { port: 1, pin: 0, label: 'P1.0 (Bit 0)' };
    } else if (preset === 'byte') {
      // All 8 pins P1.0 through P1.7
      for (let pin = 0; pin < 8; pin++) {
        const tracker = this.ensureTracker(1, pin, `P1.${pin}`, true);
        tracker.enabled = true;
      }
      this.probeTarget = { port: 1, pin: 0, label: 'P1.0' };
    }
  }

  /**
   * Returns all currently enabled channel trackers in sorted order.
   */
  public getEnabledTrackers(): SinglePinTracker[] {
    const enabled: SinglePinTracker[] = [];
    for (const tracker of this.trackers.values()) {
      if (tracker.enabled) {
        enabled.push(tracker);
      }
    }
    // Sort primarily by port, then by pin
    return enabled.sort((a, b) => a.port === b.port ? a.pin - b.pin : a.port - b.port);
  }

  public reset(): void {
    for (const tracker of this.trackers.values()) {
      tracker.reset();
    }
    this.isHold = false;
    this.heldMetrics = null;
  }

  public toggleHold(): boolean {
    if (!this.isHold) {
      this.heldMetrics = this.getMetrics(this.getPrimaryTracker().lastEdgeCycle);
      this.isHold = true;
    } else {
      this.isHold = false;
      this.heldMetrics = null;
    }
    return this.isHold;
  }

  /**
   * Sample all active/enabled pins from port latches and external pin levels.
   */
  public sample(portLatches: number[], portPins: number[], currentCycle: number): void {
    if (this.isHold) return;

    // Sample each enabled tracker + the primary probe target
    for (const tracker of this.trackers.values()) {
      if (!tracker.enabled && (tracker.port !== this.probeTarget.port || tracker.pin !== this.probeTarget.pin)) {
        continue;
      }

      const port = tracker.port;
      const pin = tracker.pin;

      const latchBit = ((portLatches[port] ?? 0xFF) >> pin) & 1;
      const pinBit = ((portPins[port] ?? 0xFF) >> pin) & 1;
      const level = (latchBit & pinBit) as 0 | 1;

      tracker.sample(level, currentCycle);
    }
  }

  private getPrimaryTracker(): SinglePinTracker {
    return this.ensureTracker(this.probeTarget.port, this.probeTarget.pin, this.probeTarget.label, true);
  }

  /**
   * Primary metrics for top dashboard cards.
   */
  public getMetrics(currentCycle: number): FrequencyAnalysisMetrics {
    if (this.isHold && this.heldMetrics) {
      return this.heldMetrics;
    }
    const tracker = this.getPrimaryTracker();
    return tracker.getMetrics(currentCycle, this.clockHz);
  }

  /**
   * Metrics for an arbitrary pin.
   */
  public getMetricsForChannel(port: number, pin: number, currentCycle: number): FrequencyAnalysisMetrics {
    const tracker = this.ensureTracker(port, pin);
    return tracker.getMetrics(currentCycle, this.clockHz);
  }

  // Getters for backward compatibility
  public get totalEdges(): number {
    return this.getPrimaryTracker().totalEdges;
  }

  public get risingEdges(): number {
    return this.getPrimaryTracker().risingEdges;
  }

  public get fallingEdges(): number {
    return this.getPrimaryTracker().fallingEdges;
  }

  public get history(): LogicTransition[] {
    return this.getPrimaryTracker().history;
  }

  /**
   * Export all captured logic transition events and channel metrics as a standardized CSV string.
   * Compatible with Excel, LibreOffice, Python pandas, MATLAB, and digital logic analysis tools.
   */
  public generateCsvExport(clockHz: ClockSpeedHz, currentCycle: number): string {
    const cycleDurationUs = (12 * 1000000) / clockHz;
    const enabledTrackers = this.getEnabledTrackers();
    const rows: string[] = [];

    // Header metadata comments
    rows.push('# ========================================================');
    rows.push('# Micro8051SiM Logic Analyzer & Frequency Probe CSV Export');
    rows.push(`# 8051 Crystal Clock: ${(clockHz / 1000000).toFixed(clockHz === 11059200 ? 4 : 0)} MHz`);
    rows.push(`# Machine Cycle Duration: ${cycleDurationUs.toFixed(4)} us`);
    rows.push(`# Capture CPU Cycle: ${currentCycle.toLocaleString()}`);
    rows.push(`# Export Timestamp: ${new Date().toISOString()}`);
    rows.push('# ========================================================');
    rows.push('');

    // Section 1: Channel Summary Statistics Table
    rows.push('# --- SECTION 1: MONITORED CHANNEL METRICS SUMMARY ---');
    rows.push('Channel,Port,Pin,Current_Level,Frequency_Hz,Period_us,Period_Cycles,Duty_Pct,High_Time_us,Low_Time_us,Total_Edges,Rising_Edges,Falling_Edges,Status');

    for (const tracker of enabledTrackers) {
      const m = tracker.getMetrics(currentCycle, clockHz);
      rows.push([
        tracker.key,
        tracker.port,
        tracker.pin,
        m.currentLevel,
        m.frequencyHz.toFixed(2),
        m.periodUs.toFixed(2),
        m.periodCycles,
        m.dutyCyclePercent.toFixed(1),
        m.highTimeUs.toFixed(2),
        m.lowTimeUs.toFixed(2),
        m.totalEdges,
        m.risingEdges,
        m.fallingEdges,
        `"${m.statusText}"`,
      ].join(','));
    }
    rows.push('');

    // Section 2: Chronological Logic Transition Log
    rows.push('# --- SECTION 2: CHRONOLOGICAL LOGIC TRANSITION EVENTS ---');
    rows.push('Timestamp_us,Machine_Cycle,Relative_Cycle,Pin,Logic_Level,Voltage_V,Event_Type');

    interface CsvEvent {
      cycle: number;
      pinKey: string;
      level: 0 | 1;
    }

    const allEvents: CsvEvent[] = [];
    for (const tracker of enabledTrackers) {
      for (const t of tracker.history) {
        allEvents.push({ cycle: t.cycle, pinKey: tracker.key, level: t.level });
      }
    }

    allEvents.sort((a, b) => a.cycle - b.cycle);

    if (allEvents.length === 0) {
      // If no transitions logged yet, record current static state
      for (const tracker of enabledTrackers) {
        const timeUs = (currentCycle * cycleDurationUs).toFixed(3);
        const volt = tracker.lastLevel === 1 ? '5.0' : '0.0';
        rows.push(`${timeUs},${currentCycle},0,${tracker.key},${tracker.lastLevel},${volt},"STATIC"`);
      }
    } else {
      const firstCycle = allEvents[0].cycle;
      for (const evt of allEvents) {
        const relCycle = evt.cycle - firstCycle;
        const timeUs = (relCycle * cycleDurationUs).toFixed(3);
        const transType = evt.level === 1 ? 'RISING (0->1)' : 'FALLING (1->0)';
        const volt = evt.level === 1 ? '5.0' : '0.0';
        rows.push(`${timeUs},${evt.cycle},${relCycle},${evt.pinKey},${evt.level},${volt},"${transType}"`);
      }
    }

    return rows.join('\r\n');
  }

  /**
   * Detects the Asynchronous UART 8-N-1 State Machine state on a specified pin.
   */
  public detectAsyncFsmState(
    port: number,
    pin: number,
    cpuCycles: number,
    clockHz: ClockSpeedHz
  ): AsyncFsmDetection {
    const tracker = this.ensureTracker(port, pin);
    const pinLevel = tracker.lastLevel;
    const metrics = tracker.getMetrics(cpuCycles, clockHz);

    // Default: 9600 baud (1 bit = ~104 machine cycles at 12MHz)
    const cyclesPerSec = clockHz / 12;
    let baud = 9600;
    let bitTimeCycles = Math.round(cyclesPerSec / baud);

    // If signal has transitions, estimate baud from shortest pulse width
    if (tracker.smoothedPeriodCycles > 0) {
      const minPulseCycles = Math.min(
        tracker.currentHighCycles > 0 ? tracker.currentHighCycles : 10000,
        tracker.currentLowCycles > 0 ? tracker.currentLowCycles : 10000
      );
      if (minPulseCycles >= 8 && minPulseCycles <= 5000) {
        const testBauds = [115200, 57600, 38400, 19200, 9600, 4800, 2400, 1200];
        let bestBaud = 9600;
        let minDiff = Infinity;
        for (const tb of testBauds) {
          const expectedCycles = cyclesPerSec / tb;
          const diff = Math.abs(minPulseCycles - expectedCycles);
          if (diff < minDiff) {
            minDiff = diff;
            bestBaud = tb;
          }
        }
        baud = bestBaud;
        bitTimeCycles = Math.round(cyclesPerSec / baud);
      }
    }

    if (!metrics.isOscillating && tracker.history.length === 0) {
      if (pinLevel === 1) {
        return {
          state: 'IDLE',
          stateId: 'S0',
          stateName: 'IDLE / MARK',
          bitIndex: 0,
          detectedBaud: baud,
          bitTimeCycles,
          pinLevel,
          decodedByte: null,
          triggerEvent: 'Line quiescent at logic 1 (+5V)',
          nextExpectedTrigger: 'Start Bit: Falling Edge (1 -> 0)',
          isSignalActive: false,
          historySummary: 'Line idle at Mark (1)',
        };
      } else {
        return {
          state: 'START_BIT',
          stateId: 'S1',
          stateName: 'START BIT DETECTED',
          bitIndex: 0,
          detectedBaud: baud,
          bitTimeCycles,
          pinLevel,
          decodedByte: null,
          triggerEvent: 'Line held low (0V)',
          nextExpectedTrigger: 'Baud sample at 1.5 Bit Times',
          isSignalActive: true,
          historySummary: 'Static 0 or long space',
        };
      }
    }

    const elapsedSinceFall = tracker.lastFallingCycle > 0 ? cpuCycles - tracker.lastFallingCycle : 999999;
    const elapsedSinceRise = tracker.lastRisingCycle > 0 ? cpuCycles - tracker.lastRisingCycle : 999999;
    const isRecentlyActive = Math.min(elapsedSinceFall, elapsedSinceRise) < bitTimeCycles * 20;

    if (!isRecentlyActive) {
      return {
        state: 'IDLE',
        stateId: 'S0',
        stateName: 'IDLE / MARK',
        bitIndex: 0,
        detectedBaud: baud,
        bitTimeCycles,
        pinLevel,
        decodedByte: null,
        triggerEvent: 'Frame transmission finished; line returned to Mark (1)',
        nextExpectedTrigger: 'Next Start Bit falling edge (1 -> 0)',
        isSignalActive: false,
        historySummary: `${tracker.totalEdges} total edges recorded`,
      };
    }

    const frameElapsed = elapsedSinceFall;
    const bitPos = frameElapsed / bitTimeCycles;

    if (bitPos < 1.0) {
      return {
        state: 'START_BIT',
        stateId: 'S1',
        stateName: 'START BIT VERIFY',
        bitIndex: 0,
        detectedBaud: baud,
        bitTimeCycles,
        pinLevel,
        decodedByte: null,
        triggerEvent: `Falling edge detected ${frameElapsed} cycles ago (${(bitPos * 100).toFixed(0)}% of Start Bit)`,
        nextExpectedTrigger: 'Center sample at 1.5 Bit Times -> Data Bit D0',
        isSignalActive: true,
        historySummary: 'Start bit (0) active',
      };
    } else if (bitPos < 9.0) {
      const bitIndex = Math.min(7, Math.floor(bitPos - 1.0));
      return {
        state: 'DATA_BITS',
        stateId: 'S2',
        stateName: `SAMPLE DATA BIT (D${bitIndex})`,
        bitIndex,
        detectedBaud: baud,
        bitTimeCycles,
        pinLevel,
        decodedByte: null,
        triggerEvent: `Baud timer tick at ${(bitPos).toFixed(1)} Tb -> Bit D${bitIndex} = ${pinLevel}`,
        nextExpectedTrigger: bitIndex < 7 ? `Advance to Bit D${bitIndex + 1}` : 'Stop Bit check at 9.5 Bit Times',
        isSignalActive: true,
        historySummary: `Streaming Data Bit D${bitIndex} (${pinLevel})`,
      };
    } else if (bitPos < 10.5) {
      if (pinLevel === 0) {
        return {
          state: 'FRAMING_ERROR',
          stateId: 'S5',
          stateName: 'FRAMING ERROR',
          bitIndex: 7,
          detectedBaud: baud,
          bitTimeCycles,
          pinLevel,
          decodedByte: null,
          triggerEvent: 'Stop bit expected at logic 1, but pin sampled at 0!',
          nextExpectedTrigger: 'Line recovery to logic 1',
          isSignalActive: true,
          historySummary: 'Missing stop bit (0 instead of 1)',
        };
      }
      return {
        state: 'STOP_BIT',
        stateId: 'S3',
        stateName: 'STOP BIT VERIFIED',
        bitIndex: 7,
        detectedBaud: baud,
        bitTimeCycles,
        pinLevel,
        decodedByte: null,
        triggerEvent: 'Stop bit (1) verified at 9.5 - 10.0 Tb',
        nextExpectedTrigger: 'Byte latch into SBUF & RI/TI flag',
        isSignalActive: true,
        historySummary: 'Stop bit OK (1)',
      };
    } else {
      return {
        state: 'FRAME_COMPLETE',
        stateId: 'S4',
        stateName: 'FRAME COMPLETE',
        bitIndex: 7,
        detectedBaud: baud,
        bitTimeCycles,
        pinLevel,
        decodedByte: null,
        triggerEvent: '10-bit asynchronous UART frame fully received & latched',
        nextExpectedTrigger: 'Return to IDLE / Mark (1)',
        isSignalActive: true,
        historySummary: 'Full frame received',
      };
    }
  }

  /**
   * Detects the Synchronous Serial State Machine state (Clock + Data).
   */
  public detectSyncFsmState(
    clkPort: number,
    clkPin: number,
    dataPort: number,
    dataPin: number,
    cpuCycles: number,
    clockHz: ClockSpeedHz
  ): SyncFsmDetection {
    const clkTracker = this.ensureTracker(clkPort, clkPin);
    const dataTracker = this.ensureTracker(dataPort, dataPin);
    const clkMetrics = clkTracker.getMetrics(cpuCycles, clockHz);
    const dataLevel = dataTracker.lastLevel;
    const clkLevel = clkTracker.lastLevel;

    const clockEdges = clkTracker.risingEdges;
    const bitIndex = clockEdges > 0 ? (clockEdges - 1) % 8 : 0;
    const isClockActive = clkMetrics.isOscillating;

    const elapsedSinceClk = clkTracker.lastRisingCycle > 0 ? cpuCycles - clkTracker.lastRisingCycle : 999999;
    const isRecentEdge = elapsedSinceClk < 100;

    if (!isClockActive && clkTracker.totalEdges === 0) {
      return {
        state: 'IDLE',
        stateId: 'SYNC_0',
        stateName: 'SYNCHRONOUS IDLE',
        bitIndex: 0,
        clockLevel: clkLevel,
        dataLevel,
        clockEdgesCount: 0,
        clockFrequencyHz: 0,
        assembledByte: null,
        triggerEvent: 'Clock line quiescent; Shift Register ready',
        nextExpectedTrigger: 'Transmission start / SBUF write (Clock Active Edge ↑)',
        isClockActive: false,
        historySummary: 'Clock idle',
      };
    }

    if (clockEdges % 8 === 0 && clockEdges > 0 && elapsedSinceClk > 200) {
      return {
        state: 'TRANSFER_COMPLETE',
        stateId: 'SYNC_4',
        stateName: 'TRANSFER COMPLETE',
        bitIndex: 7,
        clockLevel: clkLevel,
        dataLevel,
        clockEdgesCount: clockEdges,
        clockFrequencyHz: clkMetrics.frequencyHz,
        assembledByte: null,
        triggerEvent: `8 clock pulses completed (${clockEdges} total pulses transferred); Interrupt Flag TI/RI asserted`,
        nextExpectedTrigger: 'Next byte transmission / Clear TI/RI',
        isClockActive,
        historySummary: '8-bit frame complete',
      };
    }

    if (isRecentEdge && elapsedSinceClk < 10) {
      return {
        state: 'LATCH_DATA',
        stateId: 'SYNC_2',
        stateName: `LATCH DATA BIT (D${bitIndex})`,
        bitIndex,
        clockLevel: clkLevel,
        dataLevel,
        clockEdgesCount: clockEdges,
        clockFrequencyHz: clkMetrics.frequencyHz,
        assembledByte: null,
        triggerEvent: `Clock active rising edge ↑ detected; Data wire sampled at logic ${dataLevel}`,
        nextExpectedTrigger: 'Shift register advance',
        isClockActive: true,
        historySummary: `Bit ${bitIndex} latched = ${dataLevel}`,
      };
    } else if (isRecentEdge && elapsedSinceClk < 30) {
      return {
        state: 'SHIFT_BIT',
        stateId: 'SYNC_3',
        stateName: `SHIFT & ADVANCE (Bit ${bitIndex})`,
        bitIndex,
        clockLevel: clkLevel,
        dataLevel,
        clockEdgesCount: clockEdges,
        clockFrequencyHz: clkMetrics.frequencyHz,
        assembledByte: null,
        triggerEvent: `Data bit shifted into position ${bitIndex}; bit counter = ${(bitIndex + 1) % 8}/8`,
        nextExpectedTrigger: bitIndex < 7 ? 'Wait for next clock edge ↑' : 'Transfer complete flag',
        isClockActive: true,
        historySummary: `Shifted bit ${bitIndex}`,
      };
    } else {
      return {
        state: 'WAIT_CLOCK_EDGE',
        stateId: 'SYNC_1',
        stateName: 'WAIT CLOCK EDGE',
        bitIndex,
        clockLevel: clkLevel,
        dataLevel,
        clockEdgesCount: clockEdges,
        clockFrequencyHz: clkMetrics.frequencyHz,
        assembledByte: null,
        triggerEvent: `Waiting for clock edge ${bitIndex + 1} of 8`,
        nextExpectedTrigger: `Active Rising Edge (↑) for Bit D${(bitIndex + 1) % 8}`,
        isClockActive: true,
        historySummary: `Awaiting clock pulse ${bitIndex + 1}`,
      };
    }
  }
}

export type SignalDisplayMode = 'timeline' | 'comm-graph';
export type CommunicationViewMode = 'logic-traces' | 'async-uart' | 'sync-serial';
export type ProtocolFsmMode = 'async-uart' | 'sync-serial' | 'comparison';

export interface AsyncFsmDetection {
  state: 'IDLE' | 'START_BIT' | 'DATA_BITS' | 'STOP_BIT' | 'FRAME_COMPLETE' | 'FRAMING_ERROR';
  stateId: string; // 'S0', 'S1', 'S2', 'S3', 'S4', 'S5'
  stateName: string;
  bitIndex: number; // 0..7
  detectedBaud: number;
  bitTimeCycles: number;
  pinLevel: 0 | 1;
  decodedByte: number | null;
  triggerEvent: string;
  nextExpectedTrigger: string;
  isSignalActive: boolean;
  historySummary: string;
}

export interface SyncFsmDetection {
  state: 'IDLE' | 'WAIT_CLOCK_EDGE' | 'LATCH_DATA' | 'SHIFT_BIT' | 'TRANSFER_COMPLETE';
  stateId: string; // 'SYNC_0', 'SYNC_1', 'SYNC_2', 'SYNC_3', 'SYNC_4'
  stateName: string;
  bitIndex: number; // 0..7
  clockLevel: 0 | 1;
  dataLevel: 0 | 1;
  clockEdgesCount: number;
  clockFrequencyHz: number;
  assembledByte: number | null;
  triggerEvent: string;
  nextExpectedTrigger: string;
  isClockActive: boolean;
  historySummary: string;
}

