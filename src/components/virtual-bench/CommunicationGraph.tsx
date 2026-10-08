/**
 * Micro8051SiM Communication Graph & Protocol State Machine Transition Diagram
 * Visualizes cycle-accurate finite state machines (FSM) for:
 * 1. Asynchronous Serial Communication (UART 8-N-1: Idle, Start, Data D0-D7, Stop, Framing Error)
 * 2. Synchronous Serial Communication (Shift Register / Mode 0 / SPI: Clock Edge, Data Latch, Bit Shift, Done)
 * Displays real-time active state indicators driven by physical MCU pin transitions.
 */

import React, { useState, useEffect } from 'react';
import {
  FrequencyAnalyzer,
  AsyncFsmDetection,
  SyncFsmDetection,
  ProtocolFsmMode,
} from '../../peripherals/frequency-analyzer.ts';
import { ClockSpeedHz } from '../../core/types.ts';

interface CommunicationGraphProps {
  analyzer: FrequencyAnalyzer;
  cpuCycles: number;
  clockHz: ClockSpeedHz;
  selectedPort: number;
  selectedPin: number;
  onSelectPin?: (port: number, pin: number, label: string) => void;
  onLoadCodePreset?: (code: string, title: string) => void;
}

export const CommunicationGraph: React.FC<CommunicationGraphProps> = ({
  analyzer,
  cpuCycles,
  clockHz,
  selectedPort,
  selectedPin,
  onSelectPin,
  onLoadCodePreset,
}) => {
  const [fsmProtocol, setFsmProtocol] = useState<ProtocolFsmMode>('async-uart');
  const [syncClkPin, setSyncClkPin] = useState<{ port: number; pin: number }>({ port: 3, pin: 1 });
  const [syncDataPin, setSyncDataPin] = useState<{ port: number; pin: number }>({ port: 3, pin: 0 });
  const [simStepIndex, setSimStepIndex] = useState<number>(0);
  const [simMode, setSimMode] = useState<'live' | 'manual'>('live');
  const [testByte, setTestByte] = useState<number>(0x41); // 'A'

  // Query live FSM detections from the analyzer
  const liveAsync = analyzer.detectAsyncFsmState(selectedPort, selectedPin, cpuCycles, clockHz);
  const liveSync = analyzer.detectSyncFsmState(
    syncClkPin.port,
    syncClkPin.pin,
    syncDataPin.port,
    syncDataPin.pin,
    cpuCycles,
    clockHz
  );

  // Manual simulation state sequences
  const asyncManualStates: Array<AsyncFsmDetection['stateId']> = [
    'S0', // Idle
    'S1', // Start
    'S2', // D0
    'S2', // D1
    'S2', // D2
    'S2', // D3
    'S2', // D4
    'S2', // D5
    'S2', // D6
    'S2', // D7
    'S3', // Stop
    'S4', // Frame complete
  ];

  const syncManualStates: Array<SyncFsmDetection['stateId']> = [
    'SYNC_0', // Idle
    'SYNC_1', // Wait edge
    'SYNC_2', // Latch
    'SYNC_3', // Shift
    'SYNC_1', // Wait edge
    'SYNC_2', // Latch
    'SYNC_3', // Shift
    'SYNC_4', // Transfer complete
  ];

  // Effective active state depending on live vs manual
  const activeAsyncStateId =
    simMode === 'live' ? liveAsync.stateId : asyncManualStates[simStepIndex % asyncManualStates.length];
  const activeSyncStateId =
    simMode === 'live' ? liveSync.stateId : syncManualStates[simStepIndex % syncManualStates.length];

  const handleManualStep = () => {
    setSimMode('manual');
    setSimStepIndex((prev) => prev + 1);
  };

  const handleManualReset = () => {
    setSimMode('live');
    setSimStepIndex(0);
  };

  return (
    <div className="bg-[#141210] border border-[#38332c] rounded-xs p-2.5 flex flex-col gap-2 font-mono text-xs select-none">
      {/* 1. Protocol Sub-Selector & Live/Sim Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2d2924]">
        {/* Protocol Tab Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-[#78716c] font-black uppercase">FSM PROTOCOL:</span>
          <button
            onClick={() => setFsmProtocol('async-uart')}
            className={`px-2.5 py-1 text-[11px] font-black rounded-xs border cursor-pointer transition-colors flex items-center gap-1.5 ${
              fsmProtocol === 'async-uart'
                ? 'bg-[#f59e0b] text-black border-[#fbbf24] shadow-xs'
                : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
            }`}
          >
            <span>📡</span>
            <span>ASYNCHRONOUS UART (8-N-1)</span>
          </button>
          <button
            onClick={() => setFsmProtocol('sync-serial')}
            className={`px-2.5 py-1 text-[11px] font-black rounded-xs border cursor-pointer transition-colors flex items-center gap-1.5 ${
              fsmProtocol === 'sync-serial'
                ? 'bg-[#38bdf8] text-black border-[#38bdf8] shadow-xs'
                : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
            }`}
          >
            <span>🔄</span>
            <span>SYNCHRONOUS SERIAL (CLK + DATA)</span>
          </button>
          <button
            onClick={() => setFsmProtocol('comparison')}
            className={`px-2.5 py-1 text-[11px] font-black rounded-xs border cursor-pointer transition-colors flex items-center gap-1.5 ${
              fsmProtocol === 'comparison'
                ? 'bg-[#a855f7] text-white border-[#c084fc] shadow-xs'
                : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>DUAL COMPARISON</span>
          </button>
        </div>

        {/* Live / Step Simulation Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-[#1c1917] px-1.5 py-0.5 rounded-xs border border-[#38332c] text-[10px]">
            <span className="text-[#78716c]">MODE:</span>
            <span className={simMode === 'live' ? 'text-[#22c55e] font-black' : 'text-[#38bdf8] font-black'}>
              {simMode === 'live' ? '● LIVE PINS' : '⚙ MANUAL STEP'}
            </span>
          </div>

          <button
            onClick={handleManualStep}
            className="px-2 py-0.5 text-[10px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#38bdf8] hover:bg-[#38bdf8] hover:text-black rounded-xs cursor-pointer transition-colors"
            title="Step through the state machine transition diagram manually"
          >
            ⏭ STEP FSM
          </button>

          <button
            onClick={handleManualReset}
            className="px-2 py-0.5 text-[10px] font-black bg-[#1c1917] text-[#a8a29e] border border-[#38332c] hover:text-white rounded-xs cursor-pointer transition-colors"
            title="Return to real-time live MCU pin tracking"
          >
            ↺ LIVE MODE
          </button>
        </div>
      </div>

      {/* 2. Live Pin Detection Status Bar */}
      <div className="bg-[#1c1917] border border-[#44403c] p-2 rounded-xs flex flex-wrap items-center justify-between gap-2 text-[11px]">
        {fsmProtocol !== 'sync-serial' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[#78716c]">MONITORED PIN:</span>
              <span className="text-[#fbbf24] font-black bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#38332c]">
                P{selectedPort}.{selectedPin}
              </span>
              <span className={`px-1 rounded-xs font-bold ${liveAsync.pinLevel === 1 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                [{liveAsync.pinLevel === 1 ? '1 / +5V (MARK)' : '0 / 0V (SPACE)'}]
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#78716c]">ACTIVE STATE:</span>
              <span className="text-[#ffffff] font-black bg-[#2d2924] px-2 py-0.5 rounded-xs border border-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                {liveAsync.stateId}: {liveAsync.stateName}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#78716c]">DETECTED BAUD:</span>
              <span className="text-[#38bdf8] font-black tabular-nums">{liveAsync.detectedBaud} bps</span>
              <span className="text-[9px] text-[#78716c]">({liveAsync.bitTimeCycles} cyc/bit)</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[#78716c]">CLOCK PIN:</span>
              <span className="text-[#fbbf24] font-black bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#38332c]">
                P{syncClkPin.port}.{syncClkPin.pin}
              </span>
              <span className="text-[#78716c] ml-1">DATA PIN:</span>
              <span className="text-[#38bdf8] font-black bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#38332c]">
                P{syncDataPin.port}.{syncDataPin.pin}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#78716c]">ACTIVE STATE:</span>
              <span className="text-[#ffffff] font-black bg-[#2d2924] px-2 py-0.5 rounded-xs border border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)]">
                {liveSync.stateId}: {liveSync.stateName}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#78716c]">EDGES:</span>
              <span className="text-[#22c55e] font-black tabular-nums">{liveSync.clockEdgesCount} Pulses</span>
              <span className="text-[9px] text-[#78716c]">({(liveSync.clockEdgesCount % 8)}/8 in current byte)</span>
            </div>
          </div>
        )}

        {/* Trigger Condition Readout */}
        <div className="text-[10px] text-[#a8a29e] flex items-center gap-1">
          <span className="text-[#78716c]">CURRENT EVENT:</span>
          <span className="text-[#ffffff] italic">
            {fsmProtocol === 'sync-serial' ? liveSync.triggerEvent : liveAsync.triggerEvent}
          </span>
        </div>
      </div>

      {/* 3. State Machine Diagrams (Asynchronous UART vs Synchronous Serial) */}
      {(fsmProtocol === 'async-uart' || fsmProtocol === 'comparison') && (
        <div className="bg-[#0e0d0c] border border-[#2d2924] rounded-xs p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[11px] pb-1 border-b border-[#1f1d1a]">
            <div className="flex items-center gap-2">
              <span className="text-[#f59e0b] font-black uppercase">
                📡 ASYNCHRONOUS UART 8-N-1 FINITE STATE MACHINE (FSM)
              </span>
              <span className="text-[9px] text-[#78716c] bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#2d2924]">
                1 START + 8 DATA + 1 STOP (NO CLOCK WIRE)
              </span>
            </div>
            <span className="text-[10px] text-[#22c55e]">
              ACTIVE NODE: <strong className="text-white">{activeAsyncStateId}</strong>
            </span>
          </div>

          {/* SVG State Machine Transition Diagram */}
          <div className="w-full overflow-x-auto py-1">
            <svg
              viewBox="0 0 760 210"
              className="w-full min-w-[680px] h-[210px] bg-[#080706] rounded-xs border border-[#25211c]"
            >
              <defs>
                {/* Arrow markers */}
                <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker id="arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#22c55e" />
                </marker>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                </marker>
                <marker id="arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#78716c" />
                </marker>
                {/* Active glow filter */}
                <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid backdrop */}
              <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.8" fill="#1c1917" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid-dots)" />

              {/* ---------------- TRANSITION ARROWS ---------------- */}
              {/* S0 -> S1 (Start Bit Trigger: Falling Edge) */}
              <path d="M 100 80 L 160 80" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrow-amber)" />
              <text x="130" y="72" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">1→0 Edge</text>

              {/* S0 Self Loop (Idle Quiescent Line = 1) */}
              <path d="M 45 60 C 25 30, 85 30, 65 60" fill="none" stroke="#78716c" strokeWidth="1.5" markerEnd="url(#arrow-gray)" />
              <text x="55" y="25" fill="#78716c" fontSize="8" textAnchor="middle">Line=1 (Mark)</text>

              {/* S1 -> S2 (Valid 0 at 0.5 bit time) */}
              <path d="M 240 80 L 300 80" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow-cyan)" />
              <text x="270" y="72" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">Wait 1.5 Tb</text>

              {/* S1 -> S0 (Noise glitch rejection) */}
              <path d="M 200 105 C 200 145, 60 145, 60 105" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-red)" />
              <text x="130" y="142" fill="#ef4444" fontSize="8" textAnchor="middle">Glitch: Pin=1 @ 0.5 Tb (Abort)</text>

              {/* S2 Self Loop (Sample D0..D7 bit_idx < 7) */}
              <path d="M 335 60 C 315 25, 385 25, 365 60" fill="none" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow-cyan)" />
              <text x="350" y="24" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">Next Bit (+1.0 Tb)</text>
              <text x="350" y="34" fill="#a8a29e" fontSize="7" textAnchor="middle">bit_idx &lt; 7</text>

              {/* S2 -> S3 (All 8 data bits sampled: bit_idx == 7) */}
              <path d="M 400 80 L 460 80" stroke="#a855f7" strokeWidth="2" markerEnd="url(#arrow-cyan)" />
              <text x="430" y="72" fill="#a855f7" fontSize="8" fontWeight="bold" textAnchor="middle">8 Bits Done</text>

              {/* S3 -> S4 (Stop Bit Verified: Pin == 1) */}
              <path d="M 540 80 L 600 80" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrow-green)" />
              <text x="570" y="72" fill="#22c55e" fontSize="8" fontWeight="bold" textAnchor="middle">Pin=1 (OK)</text>

              {/* S3 -> S5 (Framing Error: Pin == 0) */}
              <path d="M 500 105 L 500 145 L 600 145" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#arrow-red)" />
              <text x="545" y="140" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">Pin=0 (Framing Error)</text>

              {/* S4 -> S0 Return Loop (Byte latched -> Return to IDLE) */}
              <path d="M 640 60 C 640 10, 60 10, 60 55" fill="none" stroke="#22c55e" strokeWidth="1.8" markerEnd="url(#arrow-green)" />
              <text x="360" y="12" fill="#22c55e" fontSize="8" fontWeight="bold" textAnchor="middle">
                Frame Received → Latch SBUF & Set RI/TI Flag → Return to IDLE
              </text>

              {/* S5 -> S0 Error Recovery Loop */}
              <path d="M 640 170 C 640 200, 60 200, 60 105" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-red)" />
              <text x="350" y="196" fill="#ef4444" fontSize="8" textAnchor="middle">
                Line Recovery to 1 (Clear FE Flag) → Return to IDLE
              </text>

              {/* ---------------- STATE NODES ---------------- */}
              {/* NODE S0: IDLE / MARK */}
              <g transform="translate(60, 80)">
                {activeAsyncStateId === 'S0' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#fbbf24" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeAsyncStateId === 'S0' ? '#fbbf24' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#fbbf24" fontSize="9" fontWeight="bold" textAnchor="middle">S0</text>
                <text x="0" y="5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">IDLE</text>
                <text x="0" y="14" fill="#78716c" fontSize="7" textAnchor="middle">Pin=1</text>
              </g>

              {/* NODE S1: START BIT VERIFY */}
              <g transform="translate(200, 80)">
                {activeAsyncStateId === 'S1' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#f59e0b" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeAsyncStateId === 'S1' ? '#f59e0b' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">S1</text>
                <text x="0" y="5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">START</text>
                <text x="0" y="14" fill="#ef4444" fontSize="7" textAnchor="middle">Pin=0</text>
              </g>

              {/* NODE S2: SAMPLE DATA BITS */}
              <g transform="translate(350, 80)">
                {activeAsyncStateId === 'S2' && (
                  <circle cx="0" cy="0" r="30" fill="none" stroke="#38bdf8" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="26" fill="#141210" stroke={activeAsyncStateId === 'S2' ? '#38bdf8' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-7" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">S2</text>
                <text x="0" y="4" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">DATA</text>
                <text x="0" y="14" fill="#38bdf8" fontSize="7" textAnchor="middle">
                  {simMode === 'live' && liveAsync.state === 'DATA_BITS' ? `D${liveAsync.bitIndex}` : 'D0..D7'}
                </text>
              </g>

              {/* NODE S3: STOP BIT CHECK */}
              <g transform="translate(500, 80)">
                {activeAsyncStateId === 'S3' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#c084fc" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeAsyncStateId === 'S3' ? '#c084fc' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#c084fc" fontSize="9" fontWeight="bold" textAnchor="middle">S3</text>
                <text x="0" y="5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">STOP</text>
                <text x="0" y="14" fill="#c084fc" fontSize="7" textAnchor="middle">Pin=1?</text>
              </g>

              {/* NODE S4: FRAME COMPLETE (Accept State: Double Circle) */}
              <g transform="translate(640, 80)">
                {activeAsyncStateId === 'S4' && (
                  <circle cx="0" cy="0" r="30" fill="none" stroke="#22c55e" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="26" fill="#141210" stroke={activeAsyncStateId === 'S4' ? '#22c55e' : '#524d43'} strokeWidth="2.5" />
                <circle cx="0" cy="0" r="21" fill="none" stroke={activeAsyncStateId === 'S4' ? '#22c55e' : '#524d43'} strokeWidth="1.2" />
                <text x="0" y="-6" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">S4</text>
                <text x="0" y="5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">DONE</text>
                <text x="0" y="13" fill="#22c55e" fontSize="7" textAnchor="middle">LATCH</text>
              </g>

              {/* NODE S5: FRAMING ERROR */}
              <g transform="translate(640, 145)">
                {activeAsyncStateId === 'S5' && (
                  <circle cx="0" cy="0" r="26" fill="none" stroke="#ef4444" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="22" fill="#141210" stroke={activeAsyncStateId === 'S5' ? '#ef4444' : '#524d43'} strokeWidth="2" strokeDasharray="3 2" />
                <text x="0" y="-5" fill="#ef4444" fontSize="8.5" fontWeight="bold" textAnchor="middle">S5</text>
                <text x="0" y="5" fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="middle">ERROR</text>
                <text x="0" y="13" fill="#ef4444" fontSize="6.5" textAnchor="middle">FE Flag</text>
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* 4. Synchronous Serial State Machine Diagram */}
      {(fsmProtocol === 'sync-serial' || fsmProtocol === 'comparison') && (
        <div className="bg-[#0e0d0c] border border-[#2d2924] rounded-xs p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[11px] pb-1 border-b border-[#1f1d1a]">
            <div className="flex items-center gap-2">
              <span className="text-[#38bdf8] font-black uppercase">
                🔄 SYNCHRONOUS SERIAL (SHIFT REGISTER / MODE 0) FSM
              </span>
              <span className="text-[9px] text-[#78716c] bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#2d2924]">
                SHARED CLOCK WIRE (NO START/STOP OVERHEAD)
              </span>
            </div>
            <span className="text-[10px] text-[#22c55e]">
              ACTIVE NODE: <strong className="text-white">{activeSyncStateId}</strong>
            </span>
          </div>

          {/* SVG Synchronous State Machine Transition Diagram */}
          <div className="w-full overflow-x-auto py-1">
            <svg
              viewBox="0 0 760 170"
              className="w-full min-w-[680px] h-[170px] bg-[#080706] rounded-xs border border-[#25211c]"
            >
              <defs>
                <marker id="sync-arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker id="sync-arrow-gold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
                </marker>
                <marker id="sync-arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#22c55e" />
                </marker>
              </defs>

              <rect width="100%" height="100%" fill="url(#grid-dots)" />

              {/* SYNC_0 -> SYNC_1 (Write SBUF: Start Clock) */}
              <path d="M 110 80 L 190 80" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#sync-arrow-gold)" />
              <text x="150" y="72" fill="#fbbf24" fontSize="8" fontWeight="bold" textAnchor="middle">Write SBUF</text>

              {/* SYNC_1 -> SYNC_2 (Active Clock Rising Edge Detected) */}
              <path d="M 270 80 L 350 80" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#sync-arrow-blue)" />
              <text x="310" y="72" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">Clock Edge ↑</text>

              {/* SYNC_2 -> SYNC_3 (Latch pin level into shift register) */}
              <path d="M 430 80 L 510 80" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#sync-arrow-blue)" />
              <text x="470" y="72" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">Latch Data Bit</text>

              {/* SYNC_3 -> SYNC_1 Loopback (bit_count < 8: wait next clock edge) */}
              <path d="M 550 60 C 550 25, 230 25, 230 55" fill="none" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#sync-arrow-blue)" />
              <text x="390" y="24" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                Shift & Increment Counter: bit_count &lt; 8 → Wait Next Clock Edge
              </text>

              {/* SYNC_3 -> SYNC_4 (All 8 pulses completed: bit_count == 8) */}
              <path d="M 590 80 L 650 80" stroke="#22c55e" strokeWidth="2" markerEnd="url(#sync-arrow-green)" />
              <text x="620" y="72" fill="#22c55e" fontSize="8" fontWeight="bold" textAnchor="middle">8 Bits Done</text>

              {/* SYNC_4 -> SYNC_0 Loopback (Transfer complete -> Return to IDLE) */}
              <path d="M 690 105 C 690 155, 70 155, 70 105" fill="none" stroke="#22c55e" strokeWidth="1.8" markerEnd="url(#sync-arrow-green)" />
              <text x="380" y="150" fill="#22c55e" fontSize="8" fontWeight="bold" textAnchor="middle">
                Byte Assembled in SBUF → Assert Interrupt TI/RI → Return to SYNC IDLE
              </text>

              {/* ---------------- STATE NODES ---------------- */}
              {/* NODE SYNC_0: IDLE */}
              <g transform="translate(70, 80)">
                {activeSyncStateId === 'SYNC_0' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#fbbf24" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeSyncStateId === 'SYNC_0' ? '#fbbf24' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#fbbf24" fontSize="8" fontWeight="bold" textAnchor="middle">SYNC_0</text>
                <text x="0" y="5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">IDLE</text>
                <text x="0" y="14" fill="#78716c" fontSize="7" textAnchor="middle">Clock=0/1</text>
              </g>

              {/* NODE SYNC_1: WAIT CLOCK EDGE */}
              <g transform="translate(230, 80)">
                {activeSyncStateId === 'SYNC_1' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#38bdf8" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeSyncStateId === 'SYNC_1' ? '#38bdf8' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">SYNC_1</text>
                <text x="0" y="5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">WAIT CLK</text>
                <text x="0" y="14" fill="#38bdf8" fontSize="7" textAnchor="middle">Edge ↑</text>
              </g>

              {/* NODE SYNC_2: LATCH DATA BIT */}
              <g transform="translate(390, 80)">
                {activeSyncStateId === 'SYNC_2' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#22c55e" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeSyncStateId === 'SYNC_2' ? '#22c55e' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#22c55e" fontSize="8" fontWeight="bold" textAnchor="middle">SYNC_2</text>
                <text x="0" y="5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">LATCH</text>
                <text x="0" y="14" fill="#22c55e" fontSize="7" textAnchor="middle">Sample Pin</text>
              </g>

              {/* NODE SYNC_3: SHIFT & ADVANCE */}
              <g transform="translate(550, 80)">
                {activeSyncStateId === 'SYNC_3' && (
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#c084fc" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="24" fill="#141210" stroke={activeSyncStateId === 'SYNC_3' ? '#c084fc' : '#524d43'} strokeWidth="2.5" />
                <text x="0" y="-6" fill="#c084fc" fontSize="8" fontWeight="bold" textAnchor="middle">SYNC_3</text>
                <text x="0" y="5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">SHIFT</text>
                <text x="0" y="14" fill="#c084fc" fontSize="7" textAnchor="middle">bit_idx++</text>
              </g>

              {/* NODE SYNC_4: TRANSFER COMPLETE (Accept State) */}
              <g transform="translate(690, 80)">
                {activeSyncStateId === 'SYNC_4' && (
                  <circle cx="0" cy="0" r="30" fill="none" stroke="#22c55e" strokeWidth="3" filter="url(#glow-gold)" className="animate-pulse" />
                )}
                <circle cx="0" cy="0" r="26" fill="#141210" stroke={activeSyncStateId === 'SYNC_4' ? '#22c55e' : '#524d43'} strokeWidth="2.5" />
                <circle cx="0" cy="0" r="21" fill="none" stroke={activeSyncStateId === 'SYNC_4' ? '#22c55e' : '#524d43'} strokeWidth="1.2" />
                <text x="0" y="-6" fill="#22c55e" fontSize="8" fontWeight="bold" textAnchor="middle">SYNC_4</text>
                <text x="0" y="5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">COMPLETE</text>
                <text x="0" y="14" fill="#22c55e" fontSize="7" textAnchor="middle">TI/RI=1</text>
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* 5. Comprehensive State Machine Transition Table */}
      <div className="bg-[#1c1917] border border-[#38332c] p-2 rounded-xs flex flex-col gap-1.5">
        <span className="text-[10px] text-[#fbbf24] font-black uppercase">
          📋 FSM TRANSITION TABLE & PROTOCOL TIMING SPECIFICATION
        </span>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] font-mono border-collapse">
            <thead>
              <tr className="bg-[#141210] text-[#a8a29e] border-b border-[#2d2924]">
                <th className="p-1">STATE ID</th>
                <th className="p-1">CURRENT STATE</th>
                <th className="p-1">INPUT EVENT / CONDITION</th>
                <th className="p-1">NEXT STATE</th>
                <th className="p-1">ACTION / OUTPUT</th>
                <th className="p-1">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {fsmProtocol !== 'sync-serial' ? (
                <>
                  <tr className={`border-b border-[#25211c] ${activeAsyncStateId === 'S0' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#fbbf24]">S0</td>
                    <td className="p-1">IDLE / MARK</td>
                    <td className="p-1">Pin falling edge: 1 → 0</td>
                    <td className="p-1 text-[#f59e0b]">S1 (START BIT)</td>
                    <td className="p-1">Trigger baud counter (1.5 Tb timer)</td>
                    <td className="p-1">{activeAsyncStateId === 'S0' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeAsyncStateId === 'S1' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#f59e0b]">S1</td>
                    <td className="p-1">START BIT VERIFY</td>
                    <td className="p-1">Pin == 0 at 0.5 bit time</td>
                    <td className="p-1 text-[#38bdf8]">S2 (SAMPLE D0)</td>
                    <td className="p-1">Validate start bit; arm data sampler</td>
                    <td className="p-1">{activeAsyncStateId === 'S1' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeAsyncStateId === 'S2' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#38bdf8]">S2</td>
                    <td className="p-1">SAMPLE DATA (D0-D7)</td>
                    <td className="p-1">Baud clock tick (+1.0 Tb)</td>
                    <td className="p-1 text-[#38bdf8]">S2 (D++) or S3</td>
                    <td className="p-1">Shift pin level into byte register</td>
                    <td className="p-1">{activeAsyncStateId === 'S2' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeAsyncStateId === 'S3' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#c084fc]">S3</td>
                    <td className="p-1">STOP BIT CHECK</td>
                    <td className="p-1">Pin == 1 at 9.5 bit time</td>
                    <td className="p-1 text-[#22c55e]">S4 (COMPLETE)</td>
                    <td className="p-1">Confirm stop bit polarity</td>
                    <td className="p-1">{activeAsyncStateId === 'S3' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeAsyncStateId === 'S4' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#22c55e]">S4</td>
                    <td className="p-1">FRAME COMPLETE</td>
                    <td className="p-1">Valid frame assembled</td>
                    <td className="p-1 text-[#fbbf24]">S0 (IDLE)</td>
                    <td className="p-1">Latch byte into SBUF, set RI/TI flag</td>
                    <td className="p-1">{activeAsyncStateId === 'S4' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeAsyncStateId === 'S5' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#ef4444]">S5</td>
                    <td className="p-1">FRAMING ERROR</td>
                    <td className="p-1">Pin == 0 at stop bit position</td>
                    <td className="p-1 text-[#fbbf24]">S0 (RECOVERY)</td>
                    <td className="p-1">Discard corrupted byte, set FE flag</td>
                    <td className="p-1">{activeAsyncStateId === 'S5' ? '● ACTIVE' : '—'}</td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className={`border-b border-[#25211c] ${activeSyncStateId === 'SYNC_0' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#fbbf24]">SYNC_0</td>
                    <td className="p-1">SYNCHRONOUS IDLE</td>
                    <td className="p-1">SBUF write / Transmit trigger</td>
                    <td className="p-1 text-[#38bdf8]">SYNC_1</td>
                    <td className="p-1">Start 8-pulse clock generator on P3.1</td>
                    <td className="p-1">{activeSyncStateId === 'SYNC_0' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeSyncStateId === 'SYNC_1' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#38bdf8]">SYNC_1</td>
                    <td className="p-1">WAIT CLOCK EDGE</td>
                    <td className="p-1">Clock rising edge ↑ detected</td>
                    <td className="p-1 text-[#22c55e]">SYNC_2</td>
                    <td className="p-1">Arm receiver sample gate</td>
                    <td className="p-1">{activeSyncStateId === 'SYNC_1' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeSyncStateId === 'SYNC_2' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#22c55e]">SYNC_2</td>
                    <td className="p-1">LATCH DATA BIT</td>
                    <td className="p-1">Clock edge synchronous strobe</td>
                    <td className="p-1 text-[#c084fc]">SYNC_3</td>
                    <td className="p-1">Sample Data pin (P3.0) into shift register</td>
                    <td className="p-1">{activeSyncStateId === 'SYNC_2' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeSyncStateId === 'SYNC_3' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#c084fc]">SYNC_3</td>
                    <td className="p-1">SHIFT & ADVANCE</td>
                    <td className="p-1">bit_counter &lt; 8</td>
                    <td className="p-1 text-[#38bdf8]">SYNC_1 or SYNC_4</td>
                    <td className="p-1">Shift register, advance counter (0..7)</td>
                    <td className="p-1">{activeSyncStateId === 'SYNC_3' ? '● ACTIVE' : '—'}</td>
                  </tr>
                  <tr className={`border-b border-[#25211c] ${activeSyncStateId === 'SYNC_4' ? 'bg-[#2a241b] text-white font-bold' : 'text-[#a8a29e]'}`}>
                    <td className="p-1 text-[#22c55e]">SYNC_4</td>
                    <td className="p-1">TRANSFER COMPLETE</td>
                    <td className="p-1">8 clock pulses completed</td>
                    <td className="p-1 text-[#fbbf24]">SYNC_0</td>
                    <td className="p-1">Latch byte, trigger Interrupt TI/RI flag</td>
                    <td className="p-1">{activeSyncStateId === 'SYNC_4' ? '● ACTIVE' : '—'}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
