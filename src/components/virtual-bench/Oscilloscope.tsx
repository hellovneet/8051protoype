/**
 * Micro8051SiM Oscilloscope, DAC & Analog Comparator
 * High-precision simulation of EdSim51 virtual peripheral:
 * - Digital-to-Analog Converter (DAC driven by Port 1)
 * - Analog Comparator:
 *     Non-inverting input (+) = Potentiometer Vin (0.0V to 5.0V)
 *     Inverting input (-)     = DAC Output Vdac (0.0V to 5.0V)
 *     Output (Logic 1 or 0)   = Connected directly to pin P3.7
 * - ADC0804 mode with 8-bit digital output byte
 */

import React, { useRef, useEffect, useState } from 'react';
import { PinMapping } from '../../core/types.ts';

interface OscilloscopeProps {
  dacVoltage: number;
  dacHistory: number[];
  adcVoltage: number;
  adcDigital: number;
  onAdcVoltageChange: (voltage: number) => void;
  mapping: PinMapping;
  comparatorEnabled?: boolean;
  comparatorOutput?: 0 | 1;
  onToggleComparator?: (enabled: boolean) => void;
  onLoadCodePreset?: (code: string, title: string) => void;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  dacVoltage,
  dacHistory,
  adcVoltage,
  adcDigital,
  onAdcVoltageChange,
  mapping,
  comparatorEnabled = true,
  comparatorOutput = adcVoltage > dacVoltage ? 1 : 0,
  onToggleComparator,
  onLoadCodePreset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeMode, setActiveMode] = useState<'comparator' | 'adc'>(
    comparatorEnabled ? 'comparator' : 'adc'
  );

  const handleModeChange = (mode: 'comparator' | 'adc') => {
    setActiveMode(mode);
    if (onToggleComparator) {
      onToggleComparator(mode === 'comparator');
    }
  };

  // Oscilloscope CRT display rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Clear background
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, width, height);

    // 2. Oscilloscope Reticle Grid
    ctx.strokeStyle = '#24201d';
    ctx.lineWidth = 1;

    // Horizontal voltage divisions (1.0V per division across 5 divisions)
    const vSteps = 5;
    for (let i = 0; i <= vSteps; i++) {
      const y = Math.round((height / vSteps) * i);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical time divisions (8 divisions)
    const tSteps = 8;
    for (let i = 0; i <= tSteps; i++) {
      const x = Math.round((width / tSteps) * i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Center crosshair axis
    ctx.strokeStyle = '#38332c';
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Comparator Threshold Line (Vin from Potentiometer)
    const vinY = Math.max(2, Math.min(height - 2, height - (adcVoltage / 5.0) * height));
    ctx.strokeStyle = '#38bdf8'; // Cyan line for comparator threshold
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, vinY);
    ctx.lineTo(width, vinY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold indicator badge on right edge of canvas
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`Vin: ${adcVoltage.toFixed(2)}V`, width - 68, Math.max(12, Math.min(height - 4, vinY - 4)));

    // 4. Draw DAC Voltage Trace (Amber curve)
    if (dacHistory.length > 1) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const dx = width / (dacHistory.length - 1);
      for (let i = 0; i < dacHistory.length; i++) {
        const v = dacHistory[i]; // 0 to 5V
        const y = height - (v / 5.0) * height;
        const x = i * dx;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset glow
    }

    // 5. Grid Voltage Scale Labels
    ctx.fillStyle = '#78716c';
    ctx.font = '9px monospace';
    ctx.fillText('5.0V', 4, 12);
    ctx.fillText('2.5V', 4, height / 2 + 3);
    ctx.fillText('0.0V', 4, height - 4);
  }, [dacHistory, adcVoltage]);

  // EdSim51 Comparator Assembly Code Examples
  const sampleRampAdcCode = `; ============================================
; Software Ramp ADC using Comparator & DAC
; EdSim51 Virtual Comparator Integration:
; - Non-Inverting (+) = Potentiometer Vin
; - Inverting (-)     = DAC Output (Port 1)
; - Comparator Output = P3.7
; ============================================
ORG 0000H

START:
CONVERT:
    MOV R0, #00H      ; Start DAC ramp at 0 (0.00 V)

RAMP_LOOP:
    MOV P1, R0        ; Output current voltage step to DAC
    NOP               ; Allow DAC to settle

    ; Read comparator output on P3.7:
    ; P3.7 = 1 if Vin > Vdac  (DAC still below analog input)
    ; P3.7 = 0 if Vin <= Vdac (DAC has crossed analog input!)
    JNB P3.7, CONV_DONE ; When P3.7 falls to 0, conversion complete!

    INC R0            ; Increment DAC voltage step
    CJNE R0, #0FFH, RAMP_LOOP ; Ramp up to maximum (255)

CONV_DONE:
    MOV A, R0         ; A now contains digitized 8-bit result (0-255)
    MOV R2, A         ; Store digitized value in R2

    ACALL DELAY_LOOP  ; Wait before next conversion
    SJMP CONVERT

DELAY_LOOP:
    MOV R7, #200
D1:
    DJNZ R7, D1
    RET

END
`;

  const sampleSarAdcCode = `; ============================================
; Successive Approximation Register (SAR) ADC
; 8-Step Binary Search using Comparator & DAC
; Converts analog voltage to 8-bit digital in 8 tests!
; ============================================
ORG 0000H

START:
SAR_START:
    MOV R0, #00H      ; Clear result accumulator
    MOV R1, #80H      ; Start trial mask at MSB (Bit 7 = 10000000b)

SAR_BIT_LOOP:
    MOV A, R0
    ORL A, R1         ; Set trial bit in accumulator
    MOV P1, A         ; Drive DAC with trial voltage
    NOP               ; Settle DAC

    ; Test Comparator: P3.7 = 1 if Vin > Vdac, 0 if Vin <= Vdac
    JB P3.7, KEEP_BIT ; If Vin > Vdac, keep the 1 bit!
    ; Otherwise Vin <= Vdac, so discard the trial bit:
    SJMP NEXT_BIT

KEEP_BIT:
    MOV R0, A         ; Keep trial bit in result register R0

NEXT_BIT:
    MOV A, R1
    CLR C
    RRC A             ; Shift trial mask to next lower bit
    MOV R1, A
    JNZ SAR_BIT_LOOP  ; Repeat for all 8 bits (Bit 7 down to Bit 0)

    ; Conversion complete! R0 holds digitized 8-bit value
    MOV A, R0
    MOV R3, A         ; Store result in R3

    ACALL DELAY_LOOP
    SJMP SAR_START

DELAY_LOOP:
    MOV R7, #250
D_WAIT:
    DJNZ R7, D_WAIT
    RET

END
`;

  const sampleAlarmCode = `; ============================================
; Voltage Threshold Alarm (Comparator on P3.7)
; Monitors Vin: if Vin > Vdac, triggers alarm on P1.0!
; Set Potentiometer > 2.5V to trigger alarm.
; ============================================
ORG 0000H

START:
    ; Set reference threshold on DAC (128 = ~2.50 V)
    MOV P1, #80H      ; Output 2.50V reference threshold

MONITOR_LOOP:
    ; P3.7 is HIGH if Vin > 2.50 V:
    JB P3.7, ALARM_ON
    SJMP ALARM_OFF

ALARM_ON:
    ; Turn ON Alarm indicator (Blink P1.7)
    CPL P1.7
    ACALL DELAY
    SJMP MONITOR_LOOP

ALARM_OFF:
    CLR P1.7
    SJMP MONITOR_LOOP

DELAY:
    MOV R7, #150
D_ALARM:
    DJNZ R7, D_ALARM
    RET

END
`;

  const compOutput = comparatorOutput;
  const isVinGreater = adcVoltage > dacVoltage;

  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-3 select-none shadow-sm flex flex-col gap-2.5">
      {/* 1. Header with Mode Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            activeMode === 'comparator'
              ? compOutput === 1
                ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]'
                : 'bg-[#524d43]'
              : 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]'
          }`} />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            OSCILLOSCOPE, DAC & ANALOG COMPARATOR
          </span>
          <span className="text-[10px] font-mono text-[#a8a29e] bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#38332c]">
            PIN: <strong className="text-[#fbbf24]">P3.7</strong>
          </span>
        </div>

        {/* Mode Selector Tabs (EdSim51: Comparator vs ADC) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#78716c] font-bold">MODE:</span>
          <button
            onClick={() => handleModeChange('comparator')}
            className={`px-2 py-0.5 text-[10px] font-mono font-black rounded-xs border cursor-pointer transition-colors ${
              activeMode === 'comparator'
                ? 'bg-[#f59e0b] text-black border-[#fbbf24] shadow-xs'
                : 'bg-[#141210] text-[#a8a29e] border-[#44403c] hover:border-[#fbbf24] hover:text-white'
            }`}
            title="Enable EdSim51 virtual comparator (compares Vin vs Vdac, output on P3.7)"
          >
            ⚡ COMPARATOR (P3.7)
          </button>
          <button
            onClick={() => handleModeChange('adc')}
            className={`px-2 py-0.5 text-[10px] font-mono font-black rounded-xs border cursor-pointer transition-colors ${
              activeMode === 'adc'
                ? 'bg-[#f59e0b] text-black border-[#fbbf24] shadow-xs'
                : 'bg-[#141210] text-[#a8a29e] border-[#44403c] hover:border-[#fbbf24] hover:text-white'
            }`}
            title="ADC0804 converter mode"
          >
            ADC0804 CHIP
          </button>
        </div>
      </div>

      {/* 2. Main Instrument Layout: CRT Screen (Left) + Controls & Comparator (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Oscilloscope CRT Screen (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-1.5">
          <div className="relative border-2 border-[#44403c] rounded-sm p-1 bg-[#0c0a09]">
            <canvas
              ref={canvasRef}
              width={340}
              height={140}
              className="w-full h-36 block rounded-xs"
            />
            {/* Live readout overlays */}
            <div className="absolute top-2 right-2 text-[10px] font-mono bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#38332c] flex items-center gap-2">
              <span className="text-[#fbbf24] font-bold">DAC: {dacVoltage.toFixed(2)}V</span>
              <span className="text-[#38bdf8] font-bold">Vin: {adcVoltage.toFixed(2)}V</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-[#a8a29e]">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                <strong className="text-white">DAC:</strong> Port {mapping.dac.port}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                <strong className="text-white">Vin:</strong> Potentiometer
              </span>
            </div>
            <span className="text-[#78716c]">1.0V / Division · 0 to 5.0V</span>
          </div>
        </div>

        {/* Right: Potentiometer Slider & Comparator Logic / ADC Data (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2 bg-[#141210] border border-[#38332c] p-2.5 rounded-sm">
          {/* Potentiometer Input Control */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[11px] font-mono font-black text-[#fbbf24]">
              <span>ANALOG POTENTIOMETER (Vin)</span>
              <span className="text-white font-bold text-xs bg-[#1c1917] px-1.5 py-0.2 rounded-xs border border-[#44403c]">
                {adcVoltage.toFixed(2)} V
              </span>
            </div>

            <div className="flex flex-col gap-1 my-1">
              <input
                type="range"
                min="0"
                max="5"
                step="0.05"
                value={adcVoltage}
                onChange={(e) => onAdcVoltageChange(parseFloat(e.target.value))}
                className="w-full accent-[#38bdf8] cursor-pointer h-2 bg-[#292524] rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono font-bold text-[#a8a29e]">
                <span>0.0V (GND)</span>
                <span className="text-[#38bdf8] font-bold">Comparator Non-Inverting (+)</span>
                <span>5.0V (VCC)</span>
              </div>
            </div>
          </div>

          {/* Mode-Specific Display: Comparator vs ADC */}
          {activeMode === 'comparator' ? (
            /* EdSim51 Virtual Comparator Instrument Card */
            <div className="bg-[#1c1917] border border-[#44403c] p-2 rounded-xs flex flex-col gap-1.5 font-mono text-[11px]">
              <div className="flex justify-between items-center pb-1 border-b border-[#2d2924]">
                <span className="text-[10px] font-black uppercase text-[#38bdf8]">
                  ANALOG COMPARATOR STATUS:
                </span>
                <span
                  className={`px-1.5 py-0.2 text-[9px] font-black rounded-xs border ${
                    compOutput === 1
                      ? 'bg-[#22c55e] text-black border-[#86efac]'
                      : 'bg-[#27272a] text-[#a1a1aa] border-[#52525b]'
                  }`}
                >
                  OUTPUT: {compOutput === 1 ? '1 (HIGH)' : '0 (LOW)'}
                </span>
              </div>

              {/* OP-AMP Voltage Inputs */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-[#141210] p-1 rounded-xs border border-[#2d2924]">
                  <span className="text-[#a8a29e] block text-[9px]">(+) NON-INVERTING:</span>
                  <span className="text-[#38bdf8] font-black text-xs">Vin: {adcVoltage.toFixed(2)}V</span>
                </div>
                <div className="bg-[#141210] p-1 rounded-xs border border-[#2d2924]">
                  <span className="text-[#a8a29e] block text-[9px]">(-) INVERTING:</span>
                  <span className="text-[#fbbf24] font-black text-xs">Vdac: {dacVoltage.toFixed(2)}V</span>
                </div>
              </div>

              {/* Logical comparison result & pin mapping */}
              <div className="flex justify-between items-center text-[10px] bg-[#141210] p-1.5 rounded-xs border border-[#2d2924]">
                <div>
                  <span className="text-[#78716c]">CONDITION: </span>
                  <strong className={isVinGreater ? 'text-[#22c55e]' : 'text-[#f87171]'}>
                    {isVinGreater ? 'Vin > Vdac' : 'Vin ≤ Vdac'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#78716c]">PIN: </span>
                  <strong className="text-[#fbbf24]">P3.7 = {compOutput}</strong>
                </div>
              </div>

              <div className="text-[9px] text-[#78716c] italic">
                Assembly: Test with <code className="text-[#fbbf24] font-bold">JB P3.7, ADDR</code> or <code className="text-[#fbbf24] font-bold">MOV C, P3.7</code>
              </div>
            </div>
          ) : (
            /* ADC0804 Chip Readout */
            <div className="bg-[#1c1917] border border-[#44403c] p-2 rounded-xs flex flex-col gap-1 font-mono text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#a8a29e] font-bold">ADC0804 DIGITAL BYTE:</span>
                <span className="text-[#fbbf24] font-black text-xs">
                  {adcDigital} (0x{adcDigital.toString(16).toUpperCase().padStart(2, '0')}H)
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-[#78716c]">
                <span>BINARY: {adcDigital.toString(2).padStart(8, '0')}b</span>
                <span>DATA PORT: Port {mapping.adc.dataPort}</span>
              </div>
              <div className="text-[9px] text-[#78716c] pt-1 border-t border-[#2d2924]">
                Start Pin: P{mapping.adc.startPin.port}.{mapping.adc.startPin.pin} · EOC Pin: P{mapping.adc.eocPin.port}.{mapping.adc.eocPin.pin}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. 1-Click Educational Test Code Presets */}
      {onLoadCodePreset && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#38332c] text-[10px] font-mono">
          <span className="text-[#78716c] font-bold uppercase text-[9px]">
            ⚡ COMPARATOR CODE PRESETS:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                handleModeChange('comparator');
                onLoadCodePreset(sampleRampAdcCode, 'Ramp ADC (Comparator & DAC)');
              }}
              className="px-2 py-0.5 text-[9px] font-black bg-[#141210] text-[#38bdf8] border border-[#38bdf8] hover:bg-[#38bdf8] hover:text-black rounded-xs cursor-pointer transition-colors"
              title="Loads software Ramp ADC using the comparator on P3.7"
            >
              ★ Ramp ADC (P3.7)
            </button>
            <button
              onClick={() => {
                handleModeChange('comparator');
                onLoadCodePreset(sampleSarAdcCode, 'SAR Binary ADC (Comparator)');
              }}
              className="px-2 py-0.5 text-[9px] font-black bg-[#141210] text-[#4ade80] border border-[#4ade80] hover:bg-[#4ade80] hover:text-black rounded-xs cursor-pointer transition-colors"
              title="Loads Successive Approximation (SAR) binary search ADC"
            >
              ★ SAR Binary ADC
            </button>
            <button
              onClick={() => {
                handleModeChange('comparator');
                onLoadCodePreset(sampleAlarmCode, 'Voltage Alarm (Comparator)');
              }}
              className="px-2 py-0.5 text-[9px] font-black bg-[#141210] text-[#fbbf24] border border-[#fbbf24] hover:bg-[#fbbf24] hover:text-black rounded-xs cursor-pointer transition-colors"
              title="Loads threshold voltage alarm triggering when Vin > 2.5V"
            >
              Over-Voltage Alarm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
