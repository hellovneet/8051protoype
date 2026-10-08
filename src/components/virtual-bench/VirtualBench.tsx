/**
 * Micro8051SiM Virtual Hardware Board (EdSim51 Simplicity & High Readability)
 * Clear, clean layout with live Port status bar and 1-click view switching.
 */

import React, { useState } from 'react';
import { PeripheralsManager } from '../../peripherals/peripherals.ts';
import { LedArray } from './LedArray.tsx';
import { SwitchArray } from './SwitchArray.tsx';
import { LcdDisplay } from './LcdDisplay.tsx';
import { SevenSegmentDisplay } from './SevenSegmentDisplay.tsx';
import { Keypad } from './Keypad.tsx';
import { DcMotor } from './DcMotor.tsx';
import { Oscilloscope } from './Oscilloscope.tsx';
import { UartTerminal } from './UartTerminal.tsx';
import { FrequencyDisplay } from './FrequencyDisplay.tsx';
import { ClockSpeedHz } from '../../core/types.ts';

interface VirtualBenchProps {
  peripherals: PeripheralsManager;
  portLatches?: number[];
  portPins?: number[];
  cpuCycles?: number;
  clockHz?: ClockSpeedHz;
  onToggleSwitch: (index: number) => void;
  onSetAllSwitches: (state: boolean) => void;
  onPressKeypadKey: (row: number, col: number) => void;
  onReleaseKeypadKey: () => void;
  onAdcVoltageChange: (v: number) => void;
  onSendSerialData: (data: string) => void;
  onClearSerialHistory: () => void;
  onLoadCodePreset?: (code: string, title: string) => void;
}

export type HardwareViewMode =
  | 'all'
  | 'frequency'
  | 'leds-switches'
  | 'lcd'
  | 'seven-seg'
  | 'keypad-motor'
  | 'uart'
  | 'scope';

export const VirtualBench: React.FC<VirtualBenchProps> = ({
  peripherals,
  portLatches = [0xFF, 0xFF, 0xFF, 0xFF],
  portPins = [0xFF, 0xFF, 0xFF, 0xFF],
  cpuCycles = 0,
  clockHz = 12000000,
  onToggleSwitch,
  onSetAllSwitches,
  onPressKeypadKey,
  onReleaseKeypadKey,
  onAdcVoltageChange,
  onSendSerialData,
  onClearSerialHistory,
  onLoadCodePreset,
}) => {
  const [viewMode, setViewMode] = useState<HardwareViewMode>('all');
  const [, setProbeUpdateCounter] = useState(0);

  const p0 = portLatches[0] ?? 0xFF;
  const p1 = portLatches[1] ?? 0xFF;
  const p2 = portLatches[2] ?? 0xFF;
  const p3 = portPins[3] ?? 0xFF;

  const probeTarget = peripherals.frequencyAnalyzer.probeTarget;
  const probeMetrics = peripherals.frequencyAnalyzer.getMetrics(cpuCycles);

  const handleProbePin = (port: number, pin: number, label: string) => {
    peripherals.frequencyAnalyzer.setProbe(port, pin, label);
    setProbeUpdateCounter((c) => c + 1);
  };

  return (
    <div className="flex flex-col h-full gap-2 overflow-y-auto pr-1">
      {/* 1. Live Hardware Port Status Bar (EdSim51 Direct Feedback) */}
      <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-2 shadow-sm font-mono text-xs select-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] border border-[#ffffff]" />
            <span className="font-black text-[#fbbf24] uppercase tracking-wider text-[11px]">
              VIRTUAL 8051 PORTS:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {/* P0 */}
            <div className="bg-[#141210] border border-[#44403c] px-2 py-0.5 rounded-xs flex items-center gap-1.5">
              <span className="text-[#ffffff] font-bold">P0:</span>
              <span className="text-[#fbbf24] font-black">0x{p0.toString(16).toUpperCase().padStart(2, '0')}</span>
              <span className="text-[#ffffff] text-[10px]">({p0.toString(2).padStart(8, '0')}b)</span>
            </div>

            {/* P1 (LEDs) */}
            <div className="bg-[#141210] border border-[#f59e0b] px-2 py-0.5 rounded-xs flex items-center gap-1.5">
              <span className="text-[#fbbf24] font-black">P1 [LEDs]:</span>
              <span className="text-[#ffffff] font-black">0x{p1.toString(16).toUpperCase().padStart(2, '0')}</span>
              <span className="text-[#fbbf24] text-[10px] font-bold">({p1.toString(2).padStart(8, '0')}b)</span>
            </div>

            {/* P2 (Displays) */}
            <div className="bg-[#141210] border border-[#44403c] px-2 py-0.5 rounded-xs flex items-center gap-1.5">
              <span className="text-[#ffffff] font-bold">P2:</span>
              <span className="text-[#fbbf24] font-black">0x{p2.toString(16).toUpperCase().padStart(2, '0')}</span>
              <span className="text-[#ffffff] text-[10px]">({p2.toString(2).padStart(8, '0')}b)</span>
            </div>

            {/* P3 (Switches) */}
            <div className="bg-[#141210] border border-[#f59e0b] px-2 py-0.5 rounded-xs flex items-center gap-1.5">
              <span className="text-[#fbbf24] font-black">P3 [SW]:</span>
              <span className="text-[#ffffff] font-black">0x{p3.toString(16).toUpperCase().padStart(2, '0')}</span>
              <span className="text-[#fbbf24] text-[10px] font-bold">({p3.toString(2).padStart(8, '0')}b)</span>
            </div>

            {/* Live Logic Probe Readout Shortcut */}
            {(() => {
              const enabledTrackers = peripherals.frequencyAnalyzer.getEnabledTrackers();
              const hasMultipleChannels = enabledTrackers.length > 1;

              return (
                <button
                  onClick={() => setViewMode('frequency')}
                  className="bg-[#141210] border border-[#fbbf24] hover:bg-[#26221d] px-2 py-0.5 rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  title="Click to view Multi-Channel Logic & Frequency Analyzer"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    probeMetrics.isOscillating
                      ? 'bg-[#f59e0b] animate-ping'
                      : probeMetrics.currentLevel === 1
                      ? 'bg-[#22c55e]'
                      : 'bg-[#524d43]'
                  }`} />
                  <span className="text-[#fbbf24] font-black">
                    ⌖ PROBE [P{probeTarget.port}.{probeTarget.pin}]
                    {hasMultipleChannels && (
                      <span className="text-[#38bdf8] ml-1 font-bold">
                        (+{enabledTrackers.length - 1} CH)
                      </span>
                    )}:
                  </span>
                  <span className="text-[#ffffff] font-black">
                    {probeMetrics.isOscillating
                      ? probeMetrics.frequencyHz >= 1000
                        ? `${(probeMetrics.frequencyHz / 1000).toFixed(2)} kHz`
                        : `${probeMetrics.frequencyHz.toFixed(1)} Hz`
                      : probeMetrics.currentLevel === 1
                      ? '5V (DC)'
                      : '0V (GND)'}
                  </span>
                  <span className="text-[#38bdf8] text-[10px] font-bold">
                    ({probeMetrics.dutyCyclePercent.toFixed(0)}% Duty)
                  </span>
                </button>
              );
            })()}

            {/* Live Analog Comparator Readout Shortcut */}
            {peripherals.comparatorEnabled && (
              <button
                onClick={() => setViewMode('scope')}
                className="bg-[#141210] border border-[#38bdf8] hover:bg-[#1e293b] px-2 py-0.5 rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                title="Click to view Oscilloscope, DAC & Analog Comparator (P3.7)"
              >
                <span className={`w-2 h-2 rounded-full ${
                  peripherals.comparatorOutput === 1
                    ? 'bg-[#22c55e] shadow-[0_0_6px_#22c55e]'
                    : 'bg-[#524d43]'
                }`} />
                <span className="text-[#38bdf8] font-black">COMP [P3.7]:</span>
                <span className="text-[#ffffff] font-black">
                  {peripherals.comparatorOutput === 1 ? '1 (HIGH)' : '0 (LOW)'}
                </span>
                <span className="text-[#a8a29e] text-[9px]">
                  ({peripherals.adcInputVoltage.toFixed(1)}V {peripherals.adcInputVoltage > peripherals.dacVoltage ? '>' : '≤'} {peripherals.dacVoltage.toFixed(1)}V)
                </span>
              </button>
            )}
          </div>
        </div>

        {/* View Mode Selector Tabs */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#44403c] overflow-x-auto gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#ffffff] font-bold uppercase mr-1">VIEW:</span>
            {(
              [
                { id: 'all', label: '★ ALL HARDWARE' },
                { id: 'frequency', label: '⚡ MULTI-PIN LOGIC PROBE' },
                { id: 'leds-switches', label: 'LEDS & SWITCHES' },
                { id: 'lcd', label: '16×2 LCD' },
                { id: 'seven-seg', label: '7-SEGMENT' },
                { id: 'keypad-motor', label: 'KEYPAD & MOTOR' },
                { id: 'uart', label: 'UART' },
                { id: 'scope', label: '⚡ SCOPE & COMPARATOR' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`px-2 py-0.5 text-[10px] font-mono uppercase font-black rounded-xs transition-colors cursor-pointer whitespace-nowrap border ${
                  viewMode === tab.id
                    ? 'bg-[#f59e0b] text-[#000000] border-[#fbbf24]'
                    : 'bg-[#141210] text-[#ffffff] border-[#524d43] hover:border-[#fbbf24]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Main Hardware Rendering */}
      {viewMode === 'all' && (
        <div className="flex flex-col gap-2">
          {/* ROW 1: Fast I/O - LEDs (Port 1) & DIP Switches (Port 3) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <LedArray
              ledStates={peripherals.ledStates}
              mapping={peripherals.mapping}
              portValue={p1}
              probedPort={probeTarget.port}
              probedPin={probeTarget.pin}
              isPinEnabled={(port, pin) => peripherals.frequencyAnalyzer.isPinEnabled(port, pin)}
              onProbePin={handleProbePin}
            />

            <SwitchArray
              switchStates={peripherals.switchStates}
              mapping={peripherals.mapping}
              onToggleSwitch={onToggleSwitch}
              onSetAll={onSetAllSwitches}
              portValue={p3}
            />
          </div>

          {/* ROW 2: Visual Displays - 16×2 Character LCD & 4-Digit 7-Segment */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <LcdDisplay
              lcd={peripherals.lcd}
              mapping={peripherals.mapping}
            />
            <SevenSegmentDisplay
              segmentDigits={peripherals.segmentDigits}
              segmentPersistence={peripherals.segmentPersistence}
              mapping={peripherals.mapping}
            />
          </div>

          {/* ROW 3: Matrix Input & Actuator - Keypad 4×3 & DC Motor */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <Keypad
              activeKey={peripherals.activeKey}
              onPressKey={onPressKeypadKey}
              onReleaseKey={onReleaseKeypadKey}
              mapping={peripherals.mapping}
            />
            <DcMotor
              state={peripherals.motorState}
              speed={peripherals.motorSpeed}
              angle={peripherals.motorAngle}
              mapping={peripherals.mapping}
            />
          </div>

          {/* ROW 4: Real-Time Pin Frequency & Duty Cycle Analyzer */}
          <FrequencyDisplay
            analyzer={peripherals.frequencyAnalyzer}
            cpuCycles={cpuCycles}
            clockHz={clockHz}
            compact={true}
            onSelectPin={handleProbePin}
            onLoadCodePreset={onLoadCodePreset}
          />

          {/* ROW 5: Oscilloscope, DAC & Analog Comparator */}
          <Oscilloscope
            dacVoltage={peripherals.dacVoltage}
            dacHistory={peripherals.dacWaveformHistory}
            adcVoltage={peripherals.adcInputVoltage}
            adcDigital={peripherals.adcDigitalValue}
            onAdcVoltageChange={onAdcVoltageChange}
            mapping={peripherals.mapping}
            comparatorEnabled={peripherals.comparatorEnabled}
            comparatorOutput={peripherals.comparatorOutput}
            onToggleComparator={(en) => {
              peripherals.toggleComparator(en);
              setProbeUpdateCounter((c) => c + 1);
            }}
            onLoadCodePreset={onLoadCodePreset}
          />
        </div>
      )}

      {viewMode === 'frequency' && (
        <div className="flex flex-col gap-3">
          <FrequencyDisplay
            analyzer={peripherals.frequencyAnalyzer}
            cpuCycles={cpuCycles}
            clockHz={clockHz}
            compact={false}
            onSelectPin={handleProbePin}
            onLoadCodePreset={onLoadCodePreset}
          />
          <LedArray
            ledStates={peripherals.ledStates}
            mapping={peripherals.mapping}
            portValue={p1}
            probedPort={probeTarget.port}
            probedPin={probeTarget.pin}
            isPinEnabled={(port, pin) => peripherals.frequencyAnalyzer.isPinEnabled(port, pin)}
            onProbePin={handleProbePin}
          />
        </div>
      )}

      {viewMode === 'leds-switches' && (
        <div className="flex flex-col gap-3">
          <LedArray
            ledStates={peripherals.ledStates}
            mapping={peripherals.mapping}
            portValue={p1}
            probedPort={probeTarget.port}
            probedPin={probeTarget.pin}
            isPinEnabled={(port, pin) => peripherals.frequencyAnalyzer.isPinEnabled(port, pin)}
            onProbePin={handleProbePin}
          />
          <SwitchArray
            switchStates={peripherals.switchStates}
            mapping={peripherals.mapping}
            onToggleSwitch={onToggleSwitch}
            onSetAll={onSetAllSwitches}
            portValue={p3}
          />
        </div>
      )}

      {viewMode === 'lcd' && (
        <div className="flex flex-col gap-3">
          <LcdDisplay
            lcd={peripherals.lcd}
            mapping={peripherals.mapping}
          />
        </div>
      )}

      {viewMode === 'seven-seg' && (
        <div className="flex flex-col gap-3">
          <SevenSegmentDisplay
            segmentDigits={peripherals.segmentDigits}
            segmentPersistence={peripherals.segmentPersistence}
            mapping={peripherals.mapping}
          />
        </div>
      )}

      {viewMode === 'keypad-motor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Keypad
            activeKey={peripherals.activeKey}
            onPressKey={onPressKeypadKey}
            onReleaseKey={onReleaseKeypadKey}
            mapping={peripherals.mapping}
          />
          <DcMotor
            state={peripherals.motorState}
            speed={peripherals.motorSpeed}
            angle={peripherals.motorAngle}
            mapping={peripherals.mapping}
          />
        </div>
      )}

      {viewMode === 'uart' && (
        <UartTerminal
          txHistory={peripherals.uartTxHistory}
          onSendSerialData={onSendSerialData}
          onClearHistory={onClearSerialHistory}
        />
      )}

      {viewMode === 'scope' && (
        <Oscilloscope
          dacVoltage={peripherals.dacVoltage}
          dacHistory={peripherals.dacWaveformHistory}
          adcVoltage={peripherals.adcInputVoltage}
          adcDigital={peripherals.adcDigitalValue}
          onAdcVoltageChange={onAdcVoltageChange}
          mapping={peripherals.mapping}
          comparatorEnabled={peripherals.comparatorEnabled}
          comparatorOutput={peripherals.comparatorOutput}
          onToggleComparator={(en) => {
            peripherals.toggleComparator(en);
            setProbeUpdateCounter((c) => c + 1);
          }}
          onLoadCodePreset={onLoadCodePreset}
        />
      )}
    </div>
  );
};
