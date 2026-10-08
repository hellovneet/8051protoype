/**
 * Micro8051SiM - 8051 Microcontroller Simulation & Learning Environment
 * Main Workbench Application (Clean, High-Visibility EdSim51-Style Layout)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CPU8051 } from './core/cpu/cpu.ts';
import { PeripheralsManager } from './peripherals/peripherals.ts';
import { ExecutionController, SimulatorStatus } from './simulator/execution-controller.ts';
import { assemble8051 } from './core/assembler/assembler.ts';
import {
  ClockSpeedHz,
  SimulationSpeed,
  AssemblerResult,
  ConsoleMessage,
  PinMapping,
} from './core/types.ts';
import { EXAMPLES, ExampleProgram } from './examples/examples.ts';
import { runCpuSelfTests } from './core/tests/cpu-tests.ts';

// UI Layout Components
import { Header } from './components/layout/Header.tsx';
import { Toolbar } from './components/layout/Toolbar.tsx';
import { StatusBar } from './components/layout/StatusBar.tsx';
import { ConsolePanel } from './components/layout/ConsolePanel.tsx';
import { AssemblyEditor } from './components/editor/AssemblyEditor.tsx';
import { CpuRegistersView } from './components/debugger/CpuRegistersView.tsx';
import { MemoryViewer } from './components/debugger/MemoryViewer.tsx';
import { SfrViewer } from './components/debugger/SfrViewer.tsx';
import { DisassemblyView } from './components/debugger/DisassemblyView.tsx';
import { VirtualBench } from './components/virtual-bench/VirtualBench.tsx';
import { PinMappingModal } from './components/pin-mapper/PinMappingModal.tsx';
import { InstructionRefModal } from './components/help/InstructionRefModal.tsx';
import { SettingsModal } from './components/settings/SettingsModal.tsx';

export default function App() {
  // References to the simulator core and connected hardware
  const cpuRef = useRef<CPU8051>(new CPU8051());
  const peripheralsRef = useRef<PeripheralsManager>(new PeripheralsManager());
  const controllerRef = useRef<ExecutionController>(
    new ExecutionController(cpuRef.current, peripheralsRef.current)
  );

  // High-contrast mode and saved preferences
  const [isHighContrast, setIsHighContrast] = useState<boolean>(
    () => localStorage.getItem('micro8051_high_contrast') === 'true'
  );

  // Main application state
  const [selectedExampleId, setSelectedExampleId] = useState<string>('led-blink');
  const [projectName, setProjectName] = useState<string>('led_blink.asm');
  const [sourceCode, setSourceCode] = useState<string>(EXAMPLES[0].sourceCode);
  const [assemblerResult, setAssemblerResult] = useState<AssemblerResult>(() =>
    assemble8051(EXAMPLES[0].sourceCode)
  );

  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus>('READY');
  const [clockHz, setClockHz] = useState<ClockSpeedHz>(12000000);
  const [speed, setSpeed] = useState<SimulationSpeed>(1);

  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);

  // Current view settings
  const [codeViewMode, setCodeViewMode] = useState<'editor' | 'disassembly' | 'split'>('editor');
  const [leftBottomTab, setLeftBottomTab] = useState<'registers' | 'ram' | 'sfr'>('registers');
  const [showConsoleDrawer, setShowConsoleDrawer] = useState(false);

  // Modal windows
  const [isPinMapperOpen, setIsPinMapperOpen] = useState(false);
  const [isInstructionRefOpen, setIsInstructionRefOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleToggleHighContrast = useCallback(() => {
    setIsHighContrast((prev) => {
      const next = !prev;
      localStorage.setItem('micro8051_high_contrast', String(next));
      return next;
    });
  }, []);

  // Refresh the UI when the simulation advances
  const [, setUiTick] = useState(0);
  const triggerUi = useCallback(() => setUiTick((t) => (t + 1) % 100000), []);

  const addLog = useCallback((type: ConsoleMessage['type'], text: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setConsoleMessages((prev) => [
      ...prev.slice(-150),
      {
        id: Math.random().toString(36).slice(2, 9),
        timestamp: timeStr,
        type,
        text,
      },
    ]);
  }, []);

  // Set up controller callbacks and run the startup checks
  useEffect(() => {
    const controller = controllerRef.current;

    controller.setCallbacks({
      onStatusChange: (status) => {
        setSimulatorStatus(status);
        triggerUi();
      },
      onStateUpdate: () => {
        triggerUi();
      },
      onConsoleLog: (msg) => {
        addLog(msg.type, msg.text);
      },
      onBreakpointHit: (addr, line) => {
        addLog('cpu', `Breakpoint hit at 0x${addr.toString(16).toUpperCase().padStart(4, '0')}${line ? ` (Line ${line})` : ''}`);
        triggerUi();
      },
    });

    // Run automated self tests on boot
    const testResults = runCpuSelfTests();
    const failedTests = testResults.filter((t) => !t.passed);
    if (failedTests.length === 0) {
      addLog('info', `Self-Test Verification: All ${testResults.length} hardware tests passed.`);
    }

    // Initial assemble
    const initialAsm = assemble8051(sourceCode);
    setAssemblerResult(initialAsm);
    if (initialAsm.success) {
      controller.cpu.loadProgram(initialAsm.code, initialAsm.startAddress);
      controller.addressToLine = initialAsm.addressToLine;
      controller.lineToAddress = initialAsm.lineToAddress;
      addLog('assembler', `Loaded initial program (${initialAsm.programSize} bytes).`);
    }
  }, []);

  // Assemble the current source code
  const handleAssemble = useCallback(() => {
    controllerRef.current.pause();
    const result = assemble8051(sourceCode);
    setAssemblerResult(result);

    if (result.success) {
      controllerRef.current.cpu.loadProgram(result.code, result.startAddress);
      controllerRef.current.addressToLine = result.addressToLine;
      controllerRef.current.lineToAddress = result.lineToAddress;
      controllerRef.current.reset();
      addLog('assembler', `Build successful! ${result.programSize} bytes loaded at 0x${result.startAddress.toString(16).toUpperCase().padStart(4, '0')}H.`);
    } else {
      addLog('error', `Build failed with ${result.errors.length} error(s). See console.`);
      setShowConsoleDrawer(true);
    }
    triggerUi();
  }, [sourceCode, addLog, triggerUi]);

  // Simulation controls
  const handleRun = useCallback(() => {
    controllerRef.current.run();
  }, []);

  const handlePause = useCallback(() => {
    controllerRef.current.pause();
  }, []);

  const handleStep = useCallback(() => {
    controllerRef.current.step();
    triggerUi();
  }, [triggerUi]);

  const handleReset = useCallback(() => {
    controllerRef.current.reset();
    triggerUi();
  }, [triggerUi]);

  const handleStop = useCallback(() => {
    controllerRef.current.stop();
    triggerUi();
  }, [triggerUi]);

  const handleChangeClock = useCallback((hz: ClockSpeedHz) => {
    setClockHz(hz);
    controllerRef.current.clockHz = hz;
    peripheralsRef.current.frequencyAnalyzer.clockHz = hz;
    addLog('info', `Clock frequency configured to ${(hz / 1000000).toFixed(hz === 11059200 ? 4 : 0)} MHz.`);
    triggerUi();
  }, [addLog, triggerUi]);

  const handleChangeSpeed = useCallback((spd: SimulationSpeed) => {
    setSpeed(spd);
    controllerRef.current.speedMultiplier = spd;
    triggerUi();
  }, [triggerUi]);

  // Load an assembly preset, such as one from the frequency analyzer
  const handleLoadPresetCode = useCallback((code: string, title: string) => {
    controllerRef.current.pause();
    setSourceCode(code);
    setProjectName(`${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.asm`);

    const result = assemble8051(code);
    setAssemblerResult(result);
    if (result.success) {
      controllerRef.current.cpu.loadProgram(result.code, result.startAddress);
      controllerRef.current.addressToLine = result.addressToLine;
      controllerRef.current.lineToAddress = result.lineToAddress;
      controllerRef.current.reset();
      addLog('assembler', `Loaded "${title}" (${result.programSize} bytes). Ready to simulate!`);
    } else {
      addLog('error', `Build failed for "${title}".`);
    }
    triggerUi();
  }, [addLog, triggerUi]);

  // Breakpoints
  const handleToggleBreakpointLine = useCallback((line: number) => {
    const controller = controllerRef.current;
    controller.toggleBreakpointAtLine(line);
    setBreakpoints(new Set(controller.breakpoints));
    triggerUi();
  }, [triggerUi]);

  const handleToggleBreakpointAddr = useCallback((addr: number) => {
    const controller = controllerRef.current;
    controller.toggleBreakpointAtAddress(addr);
    setBreakpoints(new Set(controller.breakpoints));
    triggerUi();
  }, [triggerUi]);

  const handleClearBreakpoints = useCallback(() => {
    controllerRef.current.clearAllBreakpoints();
    setBreakpoints(new Set());
    addLog('info', 'All breakpoints cleared.');
    triggerUi();
  }, [addLog, triggerUi]);

  // Example Selection (Instant 1-Click Load)
  const handleSelectExample = useCallback((example: ExampleProgram) => {
    controllerRef.current.pause();
    setSelectedExampleId(example.id);
    setSourceCode(example.sourceCode);
    setProjectName(`${example.id}.asm`);

    const result = assemble8051(example.sourceCode);
    setAssemblerResult(result);
    if (result.success) {
      controllerRef.current.cpu.loadProgram(result.code, result.startAddress);
      controllerRef.current.addressToLine = result.addressToLine;
      controllerRef.current.lineToAddress = result.lineToAddress;
      controllerRef.current.reset();
      addLog('assembler', `Loaded "${example.title}" (${result.programSize} bytes).`);
    }
    triggerUi();
  }, [addLog, triggerUi]);

  // Peripherals interaction
  const handleToggleSwitch = useCallback((index: number) => {
    peripheralsRef.current.toggleSwitch(index);
    triggerUi();
  }, [triggerUi]);

  const handleSetAllSwitches = useCallback((state: boolean) => {
    for (let i = 0; i < 8; i++) {
      peripheralsRef.current.setSwitch(i, state);
    }
    triggerUi();
  }, [triggerUi]);

  const handlePressKeypadKey = useCallback((row: number, col: number) => {
    peripheralsRef.current.pressKey(row, col);
    triggerUi();
  }, [triggerUi]);

  const handleReleaseKeypadKey = useCallback(() => {
    peripheralsRef.current.releaseKey();
    triggerUi();
  }, [triggerUi]);

  const handleAdcVoltageChange = useCallback((v: number) => {
    peripheralsRef.current.adcInputVoltage = v;
    peripheralsRef.current.updateInputsToCpu(cpuRef.current.state);
    triggerUi();
  }, [triggerUi]);

  const handleSendSerialData = useCallback((data: string) => {
    if (data.length > 0) {
      const code = data.charCodeAt(0);
      const cpu = cpuRef.current;
      cpu.setSfrDirect(0x99, code); // SBUF
      const scon = cpu.getSfrDirect(0x98); // SCON
      cpu.setSfrDirect(0x98, scon | 0x01); // Set RI (Receive Interrupt)
      addLog('uart', `User transmitted RX: '${data[0]}' to SBUF.`);
      triggerUi();
    }
  }, [addLog, triggerUi]);

  const handleClearSerialHistory = useCallback(() => {
    peripheralsRef.current.uartTxHistory = '';
    triggerUi();
  }, [triggerUi]);

  const handleSavePinMapping = useCallback((newMapping: PinMapping) => {
    peripheralsRef.current.mapping = newMapping;
    addLog('info', 'Hardware pin mapping updated.');
    triggerUi();
  }, [addLog, triggerUi]);

  // File exports
  const handleExportAsm = useCallback(() => {
    const blob = new Blob([sourceCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectName;
    a.click();
    URL.revokeObjectURL(url);
    addLog('info', `Exported source as ${projectName}`);
  }, [sourceCode, projectName, addLog]);

  const handleExportHex = useCallback(() => {
    const code = assemblerResult.code;
    const start = assemblerResult.startAddress;
    const size = assemblerResult.programSize;

    let hexStr = '';
    let addr = start;
    const end = start + size;

    while (addr < end) {
      const lineLen = Math.min(16, end - addr);
      let line = `:${lineLen.toString(16).toUpperCase().padStart(2, '0')}`;
      line += addr.toString(16).toUpperCase().padStart(4, '0');
      line += '00';

      let checksum = lineLen + ((addr >> 8) & 0xFF) + (addr & 0xFF) + 0x00;
      for (let i = 0; i < lineLen; i++) {
        const b = code[addr + i];
        line += b.toString(16).toUpperCase().padStart(2, '0');
        checksum += b;
      }

      checksum = ((-checksum) & 0xFF);
      line += checksum.toString(16).toUpperCase().padStart(2, '0');
      hexStr += line + '\r\n';
      addr += lineLen;
    }

    hexStr += ':00000001FF\r\n';
    const blob = new Blob([hexStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectName.replace(/\.[^/.]+$/, '') + '.hex';
    a.click();
    URL.revokeObjectURL(url);
    addLog('info', 'Exported Intel HEX binary file.');
  }, [assemblerResult, projectName, addLog]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (controllerRef.current.status === 'RUNNING') handlePause();
        else handleRun();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleStep();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleAssemble();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePause, handleRun, handleStep, handleReset, handleAssemble]);

  // Current PC and execution line
  const cpuState = cpuRef.current.state;
  const currentExecLine = controllerRef.current.addressToLine.get(cpuState.pc);

  return (
    <div className={`flex flex-col h-screen w-screen bg-[#121110] text-[#e6ded5] overflow-hidden ${isHighContrast ? 'high-contrast' : ''}`}>
      {/* 1. Header / Menu Bar */}
      <Header
        onNewProject={() => {
          setSourceCode(`ORG 0000H\nSTART:\n    MOV A,#55H\n    MOV P1,A\nLOOP:\n    SJMP LOOP\nEND\n`);
          setProjectName('new_project.asm');
        }}
        onOpenPinMapper={() => setIsPinMapperOpen(true)}
        onOpenInstructionRef={() => setIsInstructionRefOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportAsm={handleExportAsm}
        onExportHex={handleExportHex}
        onClearBreakpoints={handleClearBreakpoints}
        onResetCpu={handleReset}
        onAssemble={handleAssemble}
        isHighContrast={isHighContrast}
        onToggleHighContrast={handleToggleHighContrast}
      />

      {/* 2. Direct Control Toolbar (EdSim51 Style) */}
      <Toolbar
        status={simulatorStatus}
        clockHz={clockHz}
        speed={speed}
        cycles={cpuState.cycles}
        instructions={cpuState.instructionCount}
        pc={cpuState.pc}
        selectedExampleId={selectedExampleId}
        onSelectExample={handleSelectExample}
        onAssemble={handleAssemble}
        onRun={handleRun}
        onPause={handlePause}
        onStep={handleStep}
        onReset={handleReset}
        onChangeClock={handleChangeClock}
        onChangeSpeed={handleChangeSpeed}
        isHighContrast={isHighContrast}
        onToggleHighContrast={handleToggleHighContrast}
      />

      {/* 3. Main Split Viewport: Left (Code & Registers) | Right (Virtual Hardware Outputs) */}
      <div className="flex-1 flex flex-col lg:flex-row p-2.5 gap-2.5 overflow-hidden">
        {/* LEFT COLUMN: Assembly Code Window & Registers (~45%) */}
        <div className="lg:w-[46%] flex flex-col h-full gap-2 min-w-0">
          {/* Code Window Header */}
          <div className="flex flex-wrap items-center justify-between bg-[#1c1917] border border-[#524d43] px-3 py-1.5 rounded-sm text-xs font-mono shadow-sm gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#fbbf24] font-black">📄</span>
              <span className="text-[#ffffff] font-black">{projectName}</span>
              <span className="text-[11px] text-[#fbbf24] font-bold">
                ({assemblerResult.programSize}B ROM)
              </span>

              {/* Active PC & Instruction Quick Readout */}
              {assemblerResult.disassembly.length > 0 && (
                <div className="bg-[#141210] border border-[#44403c] px-2 py-0.5 rounded-xs flex items-center gap-1.5 text-[11px]">
                  <span className="text-[#fbbf24] font-black">
                    ▶ PC: {cpuState.pc.toString(16).toUpperCase().padStart(4, '0')}H
                  </span>
                  {(() => {
                    const cur = assemblerResult.disassembly.find((d) => d.address === cpuState.pc);
                    return cur ? (
                      <span className="text-[#38bdf8] font-bold">
                        {cur.mnemonic} {cur.operands}
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Code vs EdSim51 Listing vs Split Toggle */}
              <div className="inline-flex rounded border border-[#524d43] p-0.5 bg-[#141210]">
                <button
                  onClick={() => setCodeViewMode('editor')}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs cursor-pointer transition-colors ${
                    codeViewMode === 'editor'
                      ? 'bg-[#f59e0b] text-[#000000] font-black'
                      : 'text-[#d4d4d8] hover:text-[#ffffff]'
                  }`}
                  title="Source code editor with ROM Store Addresses in gutter"
                >
                  📝 EDITOR
                </button>
                <button
                  onClick={() => setCodeViewMode('disassembly')}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs cursor-pointer transition-colors ${
                    codeViewMode === 'disassembly'
                      ? 'bg-[#f59e0b] text-[#000000] font-black'
                      : 'text-[#d4d4d8] hover:text-[#ffffff]'
                  }`}
                  title="EdSim51 Program Memory Listing (Store Addresses & Machine Bytes table)"
                >
                  📋 EDSIM51 LISTING
                </button>
                <button
                  onClick={() => setCodeViewMode('split')}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs cursor-pointer transition-colors ${
                    codeViewMode === 'split'
                      ? 'bg-[#f59e0b] text-[#000000] font-black'
                      : 'text-[#d4d4d8] hover:text-[#ffffff]'
                  }`}
                  title="Split view: Code Editor on top, EdSim51 Listing on bottom"
                >
                  ⫤ SPLIT
                </button>
              </div>

              {/* Clear Breakpoints */}
              {breakpoints.size > 0 && (
                <button
                  onClick={handleClearBreakpoints}
                  className="px-2 py-0.5 text-[10px] font-bold text-[#fca5a5] hover:bg-[#3d1818] rounded-xs border border-[#7f1d1d] cursor-pointer"
                  title="Clear all breakpoints"
                >
                  Clear BP ({breakpoints.size})
                </button>
              )}
            </div>
          </div>

          {/* Active Code or Disassembly View */}
          <div className="flex-1 overflow-hidden min-h-[220px]">
            {codeViewMode === 'editor' && (
              <AssemblyEditor
                sourceCode={sourceCode}
                onChange={setSourceCode}
                currentLine={currentExecLine}
                currentPc={cpuState.pc}
                breakpoints={breakpoints}
                lineToAddress={assemblerResult.lineToAddress}
                disassembly={assemblerResult.disassembly}
                onToggleBreakpoint={handleToggleBreakpointLine}
                errors={assemblerResult.errors}
              />
            )}
            {codeViewMode === 'disassembly' && (
              <DisassemblyView
                disassembly={assemblerResult.disassembly}
                currentPc={cpuState.pc}
                breakpoints={breakpoints}
                onToggleBreakpoint={handleToggleBreakpointAddr}
              />
            )}
            {codeViewMode === 'split' && (
              <div className="flex flex-col h-full gap-2">
                <div className="h-1/2 overflow-hidden">
                  <AssemblyEditor
                    sourceCode={sourceCode}
                    onChange={setSourceCode}
                    currentLine={currentExecLine}
                    currentPc={cpuState.pc}
                    breakpoints={breakpoints}
                    lineToAddress={assemblerResult.lineToAddress}
                    disassembly={assemblerResult.disassembly}
                    onToggleBreakpoint={handleToggleBreakpointLine}
                    errors={assemblerResult.errors}
                  />
                </div>
                <div className="h-1/2 overflow-hidden">
                  <DisassemblyView
                    disassembly={assemblerResult.disassembly}
                    currentPc={cpuState.pc}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={handleToggleBreakpointAddr}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Registers and Memory Tabs under Code Window */}
          <div className="shrink-0 flex flex-col bg-[#1c1917] border border-[#44403c] rounded-sm overflow-hidden shadow-sm">
            <div className="flex border-b border-[#44403c] bg-[#141210] text-[11px] font-mono">
              <button
                onClick={() => setLeftBottomTab('registers')}
                className={`flex-1 py-1.5 text-center font-black uppercase transition-colors cursor-pointer ${
                  leftBottomTab === 'registers'
                    ? 'bg-[#1c1917] text-[#fbbf24] border-b-2 border-[#f59e0b]'
                    : 'text-[#a8a29e] hover:text-[#ffffff]'
                }`}
              >
                CPU REGISTERS & FLAGS
              </button>
              <button
                onClick={() => setLeftBottomTab('ram')}
                className={`flex-1 py-1.5 text-center font-black uppercase transition-colors cursor-pointer ${
                  leftBottomTab === 'ram'
                    ? 'bg-[#1c1917] text-[#fbbf24] border-b-2 border-[#f59e0b]'
                    : 'text-[#a8a29e] hover:text-[#ffffff]'
                }`}
              >
                DATA MEMORY (RAM/XRAM)
              </button>
              <button
                onClick={() => setLeftBottomTab('sfr')}
                className={`flex-1 py-1.5 text-center font-black uppercase transition-colors cursor-pointer ${
                  leftBottomTab === 'sfr'
                    ? 'bg-[#1c1917] text-[#fbbf24] border-b-2 border-[#f59e0b]'
                    : 'text-[#a8a29e] hover:text-[#ffffff]'
                }`}
              >
                SFR TABLE
              </button>
            </div>

            <div className="p-1 min-h-[240px] max-h-[350px] overflow-hidden flex flex-col">
              {leftBottomTab === 'registers' && (
                <div className="h-64 overflow-y-auto">
                  <CpuRegistersView cpuState={cpuState} />
                </div>
              )}
              {leftBottomTab === 'ram' && (
                <div className="h-[340px] flex flex-col min-h-0 overflow-hidden">
                  <MemoryViewer
                    cpuState={cpuState}
                    onWriteByte={(addr, val) => {
                      cpuRef.current.writeDirect(addr, val);
                      triggerUi();
                    }}
                    onWriteRam={(addr, val) => {
                      cpuRef.current.writeRam(addr, val);
                      triggerUi();
                    }}
                    onWriteXram={(addr, val) => {
                      cpuRef.current.writeXram(addr, val);
                      triggerUi();
                    }}
                    onWriteSfr={(addr, val) => {
                      cpuRef.current.writeSfr(addr, val);
                      triggerUi();
                    }}
                    onWriteBit={(bitAddr, val) => {
                      cpuRef.current.writeBit(bitAddr, val);
                      triggerUi();
                    }}
                    onClearRam={(scratchpadOnly) => {
                      cpuRef.current.clearRam(scratchpadOnly);
                      triggerUi();
                    }}
                    onClearXram={() => {
                      cpuRef.current.clearXram();
                      triggerUi();
                    }}
                    readDirect={(addr) => cpuRef.current.readDirect(addr)}
                  />
                </div>
              )}
              {leftBottomTab === 'sfr' && (
                <div className="h-64 overflow-y-auto">
                  <SfrViewer cpuState={cpuState} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Virtual Hardware Board (~54%) */}
        <div className="lg:w-[54%] flex flex-col h-full overflow-hidden">
          <VirtualBench
            peripherals={peripheralsRef.current}
            portLatches={cpuState.portLatches}
            portPins={cpuState.portPins}
            cpuCycles={cpuState.cycles}
            clockHz={clockHz}
            onToggleSwitch={handleToggleSwitch}
            onSetAllSwitches={handleSetAllSwitches}
            onPressKeypadKey={handlePressKeypadKey}
            onReleaseKeypadKey={handleReleaseKeypadKey}
            onAdcVoltageChange={handleAdcVoltageChange}
            onSendSerialData={handleSendSerialData}
            onClearSerialHistory={handleClearSerialHistory}
            onLoadCodePreset={handleLoadPresetCode}
          />
        </div>
      </div>

      {/* 4. Collapsible Console / Build Logs Drawer */}
      {showConsoleDrawer && (
        <div className="h-44 border-t border-[#383129] bg-[#141210] p-2 relative z-30">
          <div className="flex justify-between items-center pb-1 mb-1 border-b border-[#2d2722]">
            <span className="text-xs font-mono font-bold text-[#fbbf24]">
              System Logs & Assembler Diagnostics
            </span>
            <button
              onClick={() => setShowConsoleDrawer(false)}
              className="text-[#8c8275] hover:text-[#fef3c7] text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
            >
              ✕ Close Drawer
            </button>
          </div>
          <div className="h-32">
            <ConsolePanel
              messages={consoleMessages}
              errors={assemblerResult.errors}
              onClear={() => setConsoleMessages([])}
            />
          </div>
        </div>
      )}

      {/* 5. Live Physical Status Bar */}
      <div className="flex items-center justify-between bg-[#100e0c] border-t border-[#26221d] px-3 py-1 text-[10px] font-mono select-none">
        <StatusBar
          status={simulatorStatus}
          clockHz={clockHz}
          cycles={cpuState.cycles}
          instructions={cpuState.instructionCount}
          pc={cpuState.pc}
          breakpointCount={breakpoints.size}
          programSize={assemblerResult.programSize}
        />
        <span className="text-[#78716c] hidden md:inline">© 2026 Vineet Sharma</span>
        <button
          onClick={() => setShowConsoleDrawer(!showConsoleDrawer)}
          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer font-bold ${
            showConsoleDrawer
              ? 'bg-[#d97706] text-[#121110] border-[#fbbf24]'
              : assemblerResult.errors.length > 0
              ? 'bg-[#3b1515] text-[#f87171] border-[#7f1d1d]'
              : 'bg-[#1a1714] text-[#8c8275] border-[#383129] hover:text-[#ded7cd]'
          }`}
        >
          {showConsoleDrawer ? 'Hide Logs' : `Logs (${consoleMessages.length})`}
        </button>
      </div>

      {/* Hardware Pin Mapping Modal */}
      <PinMappingModal
        isOpen={isPinMapperOpen}
        onClose={() => setIsPinMapperOpen(false)}
        currentMapping={peripheralsRef.current.mapping}
        onSaveMapping={handleSavePinMapping}
      />

      {/* 8051 Instruction Reference Modal */}
      <InstructionRefModal
        isOpen={isInstructionRefOpen}
        onClose={() => setIsInstructionRefOpen(false)}
      />

      {/* Workstation Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isHighContrast={isHighContrast}
        onToggleHighContrast={handleToggleHighContrast}
        clockHz={clockHz}
        onChangeClock={handleChangeClock}
        speed={speed}
        onChangeSpeed={handleChangeSpeed}
        onResetAllSettings={() => {
          setIsHighContrast(false);
          localStorage.removeItem('micro8051_high_contrast');
          handleChangeClock(12000000);
          handleChangeSpeed(1);
          addLog('info', 'Workstation settings reset to defaults.');
        }}
      />
    </div>
  );
}
