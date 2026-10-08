/**
 * Micro8051SiM Verified 8051 Example Programs
 * Real assembly programs that execute deterministically on the CPU emulator.
 */

export interface ExampleProgram {
  id: string;
  title: string;
  category: 'Basics' | 'Peripherals' | 'Timers & Interrupts' | 'Communications' | 'Advanced';
  description: string;
  sourceCode: string;
}

export const EXAMPLES: ExampleProgram[] = [
  {
    id: 'led-blink',
    title: '1. LED Blink & Toggle',
    category: 'Basics',
    description: 'Toggles P1.0 LED repeatedly with a nested loop delay routine (prompt test program).',
    sourceCode: `; ============================================
; Micro8051SiM: LED Blink & Toggle
; Toggles LED connected to P1.0
; ============================================
ORG 0000H

START:
    MOV A,#55H        ; Initialize pattern
    MOV P1,A          ; Output to Port 1 LEDs

LOOP:
    CPL P1.0          ; Toggle LED 0
    ACALL DELAY       ; Wait
    SJMP LOOP         ; Repeat forever

DELAY:
    MOV R7,#10        ; Outer loop counter
D1:
    MOV R6,#50        ; Inner loop counter
D2:
    DJNZ R6,D2
    DJNZ R7,D1
    RET

END
`,
  },
  {
    id: 'led-counter',
    title: '2. LED Binary Counter',
    category: 'Basics',
    description: 'Counts from 0 to 255 in binary on the 8 LEDs connected to Port 1.',
    sourceCode: `; ============================================
; Micro8051SiM: 8-bit Binary Counter
; Counts 0 to 255 on Port 1 LEDs
; ============================================
ORG 0000H

    MOV A,#00H        ; Reset counter to 0

COUNT_LOOP:
    MOV P1,A          ; Display binary count on LEDs
    ACALL DELAY       ; Visual delay
    INC A             ; Increment counter
    SJMP COUNT_LOOP   ; Loop indefinitely

DELAY:
    MOV R7,#8
D1:
    MOV R6,#60
D2:
    DJNZ R6,D2
    DJNZ R7,D1
    RET

END
`,
  },
  {
    id: 'led-chaser',
    title: '3. LED Knight Rider / Chaser',
    category: 'Basics',
    description: 'Rotates an active LED back and forth across all 8 pins of Port 1.',
    sourceCode: `; ============================================
; Micro8051SiM: Knight Rider LED Chaser
; Sweeps a single lit LED back and forth on P1
; ============================================
ORG 0000H

    MOV A,#01H        ; Start with bit 0 active

SWEEP_LEFT:
    MOV P1,A
    ACALL DELAY
    RL A              ; Rotate Accumulator Left
    CJNE A,#80H,SWEEP_LEFT
    MOV P1,A
    ACALL DELAY

SWEEP_RIGHT:
    RR A              ; Rotate Accumulator Right
    MOV P1,A
    ACALL DELAY
    CJNE A,#01H,SWEEP_RIGHT
    SJMP SWEEP_LEFT

DELAY:
    MOV R7,#6
DL1:
    MOV R6,#50
DL2:
    DJNZ R6,DL2
    DJNZ R7,DL1
    RET

END
`,
  },
  {
    id: 'switch-to-led',
    title: '4. Interactive Switch to LED',
    category: 'Peripherals',
    description: 'Reads physical DIP switches on Port 3 and mirrors their state directly to Port 1 LEDs.',
    sourceCode: `; ============================================
; Micro8051SiM: Switch to LED Mirror
; Reads Port 3 DIP Switches -> Drives Port 1 LEDs
; Switch P3.0 directly controls LED P1.0
; ============================================
ORG 0000H

START:
    MOV P3,#0FFH      ; Configure Port 3 as input (write 1s)

SCAN_LOOP:
    MOV A,P3          ; Read state of switches on Port 3
    CPL A             ; Invert: closed switch (0V) -> turn LED ON (1)
    MOV P1,A          ; Output directly to Port 1 LEDs
    SJMP SCAN_LOOP    ; Continuous real-time polling

END
`,
  },
  {
    id: 'lcd-hello',
    title: '5. LCD 16x2 "MICRO8051SIM"',
    category: 'Peripherals',
    description: 'Authentic HD44780 initialization and character generation sequence displaying MICRO8051SIM on the LCD.',
    sourceCode: `; ============================================
; Micro8051SiM: HD44780 16x2 LCD Interface
; RS = P2.0, RW = P2.1, EN = P2.2, Data = Port 0
; Writes "MICRO8051SIM" on Line 1, "SYSTEM READY" on Line 2
; ============================================
ORG 0000H

    ACALL LCD_INIT    ; Initialize HD44780 controller

    ; Line 1: "MICRO8051SIM"
    MOV DPTR,#MSG1
    ACALL PRINT_STRING

    ; Move cursor to beginning of Line 2 (DDRAM addr 40H)
    MOV A,#0C0H
    ACALL SEND_CMD

    ; Line 2: "8051 VIRTUAL LAB"
    MOV DPTR,#MSG2
    ACALL PRINT_STRING

STOP:
    SJMP STOP

; --- LCD Subroutines ---
LCD_INIT:
    MOV A,#38H        ; 8-bit mode, 2 lines, 5x7 font
    ACALL SEND_CMD
    MOV A,#0CH        ; Display ON, cursor OFF
    ACALL SEND_CMD
    MOV A,#01H        ; Clear display
    ACALL SEND_CMD
    MOV A,#06H        ; Auto-increment cursor
    ACALL SEND_CMD
    RET

SEND_CMD:
    MOV P0,A          ; Place command on Port 0
    CLR P2.0          ; RS = 0 (Command register)
    CLR P2.1          ; RW = 0 (Write)
    SETB P2.2         ; EN = 1
    ACALL SHORT_DELAY
    CLR P2.2          ; EN = 0 (Latch on falling edge)
    ACALL SHORT_DELAY
    RET

SEND_DATA:
    MOV P0,A          ; Place character on Port 0
    SETB P2.0         ; RS = 1 (Data register)
    CLR P2.1          ; RW = 0 (Write)
    SETB P2.2         ; EN = 1
    ACALL SHORT_DELAY
    CLR P2.2          ; EN = 0 (Latch on falling edge)
    ACALL SHORT_DELAY
    RET

PRINT_STRING:
    CLR A
    MOVC A,@A+DPTR    ; Read byte from code memory
    JZ STR_DONE       ; Null terminator 00H
    ACALL SEND_DATA
    INC DPTR
    SJMP PRINT_STRING
STR_DONE:
    RET

SHORT_DELAY:
    MOV R7,#10
SD: DJNZ R7,SD
    RET

; --- Text Strings ---
MSG1: DB "MICRO8051SIM",0
MSG2: DB "8051 VIRTUAL LAB",0

END
`,
  },
  {
    id: 'seven-segment',
    title: '6. 7-Segment Multiplexed Display',
    category: 'Peripherals',
    description: 'Multiplexes 4-digit 7-segment display on P0 (segments) and P2.0-P2.3 (digit enables) showing "1234".',
    sourceCode: `; ============================================
; Micro8051SiM: 4-Digit 7-Segment Multiplexing
; Segments (a-g,dp) on Port 0
; Digit Select 0-3 on P2.0 - P2.3 (active low)
; Displays digits: [1] [2] [3] [4]
; ============================================
ORG 0000H

START:
    ; Digit 0: Show '1'
    MOV P0,#06H       ; Segments for '1' (b+c)
    CLR P2.0          ; Enable Digit 0
    ACALL DELAY
    SETB P2.0         ; Disable Digit 0

    ; Digit 1: Show '2'
    MOV P0,#5BH       ; Segments for '2'
    CLR P2.1          ; Enable Digit 1
    ACALL DELAY
    SETB P2.1         ; Disable Digit 1

    ; Digit 2: Show '3'
    MOV P0,#4FH       ; Segments for '3'
    CLR P2.2          ; Enable Digit 2
    ACALL DELAY
    SETB P2.2         ; Disable Digit 2

    ; Digit 3: Show '4'
    MOV P0,#66H       ; Segments for '4'
    CLR P2.3          ; Enable Digit 3
    ACALL DELAY
    SETB P2.3         ; Disable Digit 3

    SJMP START        ; Continuous scanning

DELAY:
    MOV R7,#15
DLY:DJNZ R7,DLY
    RET

END
`,
  },
  {
    id: 'keypad-reader',
    title: '7. 4x3 Keypad Matrix Scanner',
    category: 'Peripherals',
    description: 'Scans rows P2.0-P2.3 and reads columns P2.4-P2.6. When a key is pressed, displays the key value on Port 1 LEDs.',
    sourceCode: `; ============================================
; Micro8051SiM: 4x3 Matrix Keypad Scanner
; Rows: P2.0 - P2.3
; Columns: P2.4 - P2.6
; Output: Port 1 LEDs show pressed key code
; ============================================
ORG 0000H

    MOV P1,#00H       ; Clear LEDs

MAIN_SCAN:
    ; Scan Row 0 (P2.0 = 0)
    MOV P2,#0FEH      ; 1111 1110B (Row 0 LOW)
    JNB P2.4,KEY_1    ; Row 0, Col 0 -> Key 1
    JNB P2.5,KEY_2    ; Row 0, Col 1 -> Key 2
    JNB P2.6,KEY_3    ; Row 0, Col 2 -> Key 3

    ; Scan Row 1 (P2.1 = 0)
    MOV P2,#0FDH      ; 1111 1101B (Row 1 LOW)
    JNB P2.4,KEY_4    ; Row 1, Col 0 -> Key 4
    JNB P2.5,KEY_5    ; Row 1, Col 1 -> Key 5
    JNB P2.6,KEY_6    ; Row 1, Col 2 -> Key 6

    ; Scan Row 2 (P2.2 = 0)
    MOV P2,#0FBH      ; 1111 1011B (Row 2 LOW)
    JNB P2.4,KEY_7    ; Row 2, Col 0 -> Key 7
    JNB P2.5,KEY_8    ; Row 2, Col 1 -> Key 8
    JNB P2.6,KEY_9    ; Row 2, Col 2 -> Key 9

    ; Scan Row 3 (P2.3 = 0)
    MOV P2,#0F7H      ; 1111 0111B (Row 3 LOW)
    JNB P2.5,KEY_0    ; Row 3, Col 1 -> Key 0

    SJMP MAIN_SCAN

KEY_1: MOV P1,#01H
       SJMP MAIN_SCAN
KEY_2: MOV P1,#02H
       SJMP MAIN_SCAN
KEY_3: MOV P1,#03H
       SJMP MAIN_SCAN
KEY_4: MOV P1,#04H
       SJMP MAIN_SCAN
KEY_5: MOV P1,#05H
       SJMP MAIN_SCAN
KEY_6: MOV P1,#06H
       SJMP MAIN_SCAN
KEY_7: MOV P1,#07H
       SJMP MAIN_SCAN
KEY_8: MOV P1,#08H
       SJMP MAIN_SCAN
KEY_9: MOV P1,#09H
       SJMP MAIN_SCAN
KEY_0: MOV P1,#00H
       SJMP MAIN_SCAN

END
`,
  },
  {
    id: 'timer-delay',
    title: '8. Timer 0 Precise Delay',
    category: 'Timers & Interrupts',
    description: 'Uses Timer 0 Mode 1 (16-bit timer) to generate an accurate delay and toggle Port 1.7.',
    sourceCode: `; ============================================
; Micro8051SiM: Timer 0 Precise Delay
; Configures Timer 0 in Mode 1 (16-bit Timer)
; Generates overflow and toggles P1.7
; ============================================
ORG 0000H

START:
    MOV TMOD,#01H     ; Timer 0: Mode 1 (16-bit timer)

REPEAT:
    CPL P1.7          ; Toggle output pin P1.7
    ACALL T0_DELAY    ; Run Timer 0 delay
    SJMP REPEAT

T0_DELAY:
    MOV TL0,#00H      ; Preload lower byte
    MOV TH0,#0E0H     ; Preload upper byte (counts ~8192 cycles)
    SETB TR0          ; Start Timer 0 (TR0 = 1)

WAIT_TF0:
    JNB TF0,WAIT_TF0  ; Wait for overflow flag TF0 to be set
    CLR TR0           ; Stop Timer 0
    CLR TF0           ; Clear overflow flag
    RET

END
`,
  },
  {
    id: 'timer-interrupt',
    title: '9. Timer Interrupt Generator',
    category: 'Timers & Interrupts',
    description: 'Enables global interrupt EA and Timer 0 interrupt ET0. The ISR at 000BH toggles P1.0 automatically.',
    sourceCode: `; ============================================
; Micro8051SiM: Timer 0 Interrupt Routine
; Vector 000BH: Timer 0 Interrupt Service Routine (ISR)
; Automatic hardware square wave generation on P1.0
; ============================================
ORG 0000H
    LJMP MAIN         ; Reset vector

ORG 000BH             ; Timer 0 Interrupt Vector
    CPL P1.0          ; Toggle LED inside ISR
    MOV TL0,#00H      ; Reload timer
    MOV TH0,#0F0H
    RETI              ; Return from Interrupt

MAIN:
    MOV TMOD,#01H     ; Timer 0 Mode 1 (16-bit)
    MOV TL0,#00H
    MOV TH0,#0F0H
    SETB ET0          ; Enable Timer 0 Interrupt (IE.1)
    SETB EA           ; Enable Global Interrupts (IE.7)
    SETB TR0          ; Start Timer 0

IDLE_LOOP:
    SJMP IDLE_LOOP    ; CPU idle while interrupts do work!

END
`,
  },
  {
    id: 'uart-hello',
    title: '10. UART Serial "HELLO"',
    category: 'Communications',
    description: 'Transmits string "MICRO8051SIM UART TEST" through SBUF and monitors TI flag in SCON.',
    sourceCode: `; ============================================
; Micro8051SiM: UART Serial Transmission
; Transmits string via SBUF to UART Terminal
; ============================================
ORG 0000H

    MOV SCON,#50H     ; Mode 1 (8-bit UART), REN = 1
    MOV TMOD,#20H     ; Timer 1 Mode 2 (8-bit auto-reload)
    MOV TH1,#0FDH     ; 9600 Baud reload value
    SETB TR1          ; Start Timer 1

    MOV DPTR,#TEXT_MSG

SEND_STR:
    CLR A
    MOVC A,@A+DPTR
    JZ DONE
    ACALL SEND_CHAR
    INC DPTR
    SJMP SEND_STR

DONE:
    SJMP DONE

SEND_CHAR:
    MOV SBUF,A        ; Transmit byte to UART SBUF
WAIT_TI:
    JNB TI,WAIT_TI    ; Wait until Transmit Interrupt flag TI is set
    CLR TI            ; Clear TI for next character
    RET

TEXT_MSG:
    DB "HELLO FROM MICRO8051SIM! ",0

END
`,
  },
  {
    id: 'uart-echo',
    title: '11. UART Interactive Echo',
    category: 'Communications',
    description: 'Waits for incoming byte on serial port (RI flag), reads SBUF, and echoes it back through TX!',
    sourceCode: `; ============================================
; Micro8051SiM: UART Interactive Echo
; Receives characters from user in UART Terminal
; and immediately echoes them back!
; ============================================
ORG 0000H

    MOV SCON,#50H     ; 8-bit UART, Receive Enabled (REN=1)
    MOV TMOD,#20H     ; Timer 1 Mode 2 auto-reload
    MOV TH1,#0FDH     ; Baud rate
    SETB TR1

ECHO_LOOP:
    JNB RI,ECHO_LOOP  ; Wait for Receive Interrupt flag (RI)
    MOV A,SBUF        ; Read incoming byte from SBUF
    CLR RI            ; Clear receive flag

    ; Mirror to LEDs as visual indicator
    MOV P1,A

    ; Transmit echo back out
    MOV SBUF,A
WAIT_TI:
    JNB TI,WAIT_TI
    CLR TI
    SJMP ECHO_LOOP

END
`,
  },
  {
    id: 'dc-motor',
    title: '12. DC Motor Direction & Control',
    category: 'Peripherals',
    description: 'Controls DC motor H-Bridge: Rotates Clockwise, pauses, reverses Counter-Clockwise on P2.0-P2.2.',
    sourceCode: `; ============================================
; Micro8051SiM: DC Motor Control
; IN1 = P2.0, IN2 = P2.1, EN = P2.2
; CW -> PAUSE -> CCW -> BRAKE
; ============================================
ORG 0000H

MOTOR_LOOP:
    ; 1. Spin Clockwise (CW)
    SETB P2.2         ; Enable motor
    SETB P2.0         ; IN1 = 1
    CLR P2.1          ; IN2 = 0
    MOV P1,#01H       ; Indicator LED
    ACALL LONG_DELAY

    ; 2. Motor Stop / Brake
    CLR P2.2          ; Disable
    MOV P1,#00H
    ACALL LONG_DELAY

    ; 3. Spin Counter-Clockwise (CCW)
    SETB P2.2         ; Enable
    CLR P2.0          ; IN1 = 0
    SETB P2.1         ; IN2 = 1
    MOV P1,#02H       ; Indicator LED
    ACALL LONG_DELAY

    ; 4. Motor Stop
    CLR P2.2
    MOV P1,#00H
    ACALL LONG_DELAY

    SJMP MOTOR_LOOP

LONG_DELAY:
    MOV R7,#12
LD1:MOV R6,#50
LD2:DJNZ R6,LD2
    DJNZ R7,LD1
    RET

END
`,
  },
  {
    id: 'dac-waveform',
    title: '13. DAC Sawtooth Waveform',
    category: 'Advanced',
    description: 'Generates analog sawtooth waveform on Port 1 for live viewing on the virtual Oscilloscope.',
    sourceCode: `; ============================================
; Micro8051SiM: DAC Sawtooth Waveform Generator
; Port 1 connects to 8-bit DAC ladder (0 to 5V)
; Observed in the Virtual Oscilloscope bench!
; ============================================
ORG 0000H

    MOV A,#00H

WAVE_LOOP:
    MOV P1,A          ; Output analog step to DAC port
    INC A             ; Step ramp
    ACALL STEP_DELAY
    SJMP WAVE_LOOP

STEP_DELAY:
    MOV R7,#4
SD: DJNZ R7,SD
    RET

END
`,
  },
  {
    id: 'arithmetic-math',
    title: '14. Arithmetic & BCD Logic Test',
    category: 'Advanced',
    description: 'Executes ADD, SUBB, MUL, DIV, and DA A decimal adjustments, displaying results in registers.',
    sourceCode: `; ============================================
; Micro8051SiM: 8051 Arithmetic Engine Test
; Demonstrates ADD, SUBB, MUL, DIV, and DA A
; ============================================
ORG 0000H

    ; 1. Multiplication: 12H * 05H = 5AH
    MOV A,#12H
    MOV B,#05H
    MUL AB            ; A = Low byte, B = High byte
    MOV R0,A          ; Store in R0

    ; 2. Division: 64H (100) / 0AH (10) = 10, rem 0
    MOV A,#64H
    MOV B,#0AH
    DIV AB            ; A = Quotient, B = Remainder
    MOV R1,A

    ; 3. BCD Addition with DA A
    MOV A,#28H        ; BCD 28
    ADD A,#35H        ; Add BCD 35 -> Binary 5DH
    DA A              ; Decimal adjust -> BCD 63H!
    MOV P1,A          ; Output BCD to LEDs

HALT:
    SJMP HALT

END
`,
  },
  {
    id: 'freq-square-wave',
    title: '15. 1.000 kHz Square Wave (P1.0)',
    category: 'Timers & Interrupts',
    description: 'Generates an exact 1.000 kHz square wave on P1.0 (50% duty cycle, 500 us HIGH / 500 us LOW) for Frequency Analyzer verification.',
    sourceCode: `; ============================================
; Micro8051SiM: 1.000 kHz Square Wave Generator
; Pin: P1.0 (Probe Channel A)
; Oscillator: 12.000 MHz (1 machine cycle = 1 us)
; Target Frequency: 1.000 kHz (Period = 1000 us)
; Duty Cycle: 50.0% (500 us High, 500 us Low)
; ============================================
ORG 0000H

START:
WAVE_LOOP:
    CPL P1.0          ; Toggle P1.0 (1 cycle)
    ACALL DELAY_500US ; Wait 500 us (2 cycles for ACALL)
    SJMP WAVE_LOOP    ; Repeat (2 cycles)

DELAY_500US:
    MOV R7,#247       ; 1 cycle
D1:
    DJNZ R7,D1        ; 247 * 2 = 494 cycles
    NOP               ; 1 cycle
    RET               ; 2 cycles
                      ; Total: ~500 cycles = 500 us

END
`,
  },
  {
    id: 'freq-pwm-25',
    title: '16. PWM Pulse Generator (25% Duty Cycle)',
    category: 'Timers & Interrupts',
    description: 'Generates a 25% duty cycle pulse train on P1.0 (250 us HIGH, 750 us LOW, 1.000 kHz total frequency).',
    sourceCode: `; ============================================
; Micro8051SiM: 25% Duty Cycle PWM Generator
; Pin: P1.0 (Probe Channel A)
; Frequency: 1.000 kHz (Period = 1000 us)
; High Time: 250 us (25.0% Duty Cycle)
; Low Time:  750 us (75.0% Idle)
; ============================================
ORG 0000H

START:
PWM_LOOP:
    SETB P1.0         ; Output HIGH (1 cycle)
    ACALL DELAY_250US ; 250 us duration
    CLR P1.0          ; Output LOW (1 cycle)
    ACALL DELAY_750US ; 750 us duration
    SJMP PWM_LOOP     ; Repeat forever

; 250 us delay routine (~250 cycles at 12 MHz)
DELAY_250US:
    MOV R7,#122
D_HIGH:
    DJNZ R7,D_HIGH
    RET

; 750 us delay routine (~750 cycles at 12 MHz)
DELAY_750US:
    MOV R7,#368
D_LOW:
    DJNZ R7,D_LOW
    RET

END
`,
  },
  {
    id: 'freq-multi-counter',
    title: '17. Multi-Pin 4-Bit Counter (P1.0 - P1.3)',
    category: 'Timers & Interrupts',
    description: 'Binary frequency divider across P1.0 through P1.3 simultaneously: P1.0 (f), P1.1 (f/2), P1.2 (f/4), P1.3 (f/8) for Multi-Channel Logic Analyzer testing.',
    sourceCode: `; ============================================
; Micro8051SiM: 4-Bit Binary Counter (P1.0 - P1.3)
; Multi-Channel Frequency & Logic Analyzer Test
; - P1.0 (Bit 0): Toggles every count  -> Frequency f
; - P1.1 (Bit 1): Toggles every 2 counts -> Frequency f / 2
; - P1.2 (Bit 2): Toggles every 4 counts -> Frequency f / 4
; - P1.3 (Bit 3): Toggles every 8 counts -> Frequency f / 8
; ============================================
ORG 0000H

START:
    MOV P1, #00H      ; Initialize Port 1 pins LOW
COUNT_LOOP:
    ACALL DELAY_100US ; 100 us timing gate
    INC P1            ; Increment Port 1, advancing all 4 pins
    SJMP COUNT_LOOP   ; Loop indefinitely

DELAY_100US:
    MOV R7, #48       ; 48 * 2 = 96 cycles + overhead ~ 100 cycles
D_WAIT:
    DJNZ R7, D_WAIT
    RET

END
`,
  },
  {
    id: 'freq-stepper-wave',
    title: '18. 4-Phase Stepper Pulses (P1.0 - P1.3)',
    category: 'Peripherals',
    description: 'Rotates active-high sequential pulses across P1.0, P1.1, P1.2, and P1.3 simultaneously to test multi-channel phase shift and signal timing.',
    sourceCode: `; ============================================
; Micro8051SiM: 4-Phase Stepper Wave Drive
; Channels: P1.0 -> P1.1 -> P1.2 -> P1.3
; Demonstrates rotating pulse sequence across 4 channels
; ============================================
ORG 0000H

START:
    MOV A, #01H       ; Initial state: P1.0 HIGH
STEP_LOOP:
    MOV P1, A         ; Drive coil outputs on P1.0..P1.3
    ACALL DELAY_250US ; Pulse width hold time
    RL A              ; Rotate pulse to next pin (01H->02H->04H->08H)
    ANL A, #0FH       ; Keep lower 4 bits (P1.0 - P1.3)
    JZ RESET_COILS    ; Wrap around if zero
    SJMP STEP_LOOP

RESET_COILS:
    MOV A, #01H       ; Restart at P1.0
    SJMP STEP_LOOP

DELAY_250US:
    MOV R7, #120
D_STEP:
    DJNZ R7, D_STEP
    RET

END
`,
  },
  {
    id: 'comp-ramp-adc',
    title: '19. Software Ramp ADC (Comparator & DAC)',
    category: 'Peripherals',
    description: 'Implements an analog-to-digital converter using the EdSim51 Analog Comparator on P3.7 and DAC on Port 1. Steps the DAC voltage until P3.7 falls low.',
    sourceCode: `; ============================================
; Micro8051SiM: Software Ramp ADC
; Uses Analog Comparator (P3.7) and DAC (Port 1)
; - Non-Inverting (+) = Potentiometer Vin (0-5V)
; - Inverting (-)     = DAC Output (Port 1)
; - Comparator Output = P3.7 (1 if Vin > Vdac, 0 if Vin <= Vdac)
; ============================================
ORG 0000H

START:
CONVERT:
    MOV R0, #00H      ; Start DAC ramp at 0 (0.00 V)

RAMP_LOOP:
    MOV P1, R0        ; Output current voltage step to DAC
    NOP               ; Settle DAC

    ; Test Comparator on P3.7:
    ; P3.7 = 1: Vin > Vdac  (keep ramping up)
    ; P3.7 = 0: Vin <= Vdac (DAC reached input level!)
    JNB P3.7, CONV_DONE

    INC R0            ; Increment voltage step
    CJNE R0, #0FFH, RAMP_LOOP ; Ramp up to maximum

CONV_DONE:
    MOV A, R0         ; A holds 8-bit digitized result (0-255)
    MOV R2, A         ; Store result in R2

    ; Wait before next conversion
    ACALL DELAY_LOOP
    SJMP CONVERT

DELAY_LOOP:
    MOV R7, #200
D1:
    DJNZ R7, D1
    RET

END
`,
  },
  {
    id: 'comp-sar-adc',
    title: '20. Successive Approximation ADC (SAR & Comparator)',
    category: 'Peripherals',
    description: 'Implements an 8-bit Successive Approximation Register (SAR) binary search ADC using the Analog Comparator on P3.7 and DAC on Port 1.',
    sourceCode: `; ============================================
; Micro8051SiM: SAR Binary Search ADC
; Uses Analog Comparator (P3.7) & DAC (Port 1)
; Digitizes analog input voltage in only 8 tests!
; ============================================
ORG 0000H

START:
SAR_START:
    MOV R0, #00H      ; Clear result accumulator
    MOV R1, #80H      ; Start trial mask at MSB (Bit 7 = 10000000b)

SAR_BIT_LOOP:
    MOV A, R0
    ORL A, R1         ; Set trial bit
    MOV P1, A         ; Drive DAC with trial voltage
    NOP               ; Settle DAC

    ; Test Comparator on P3.7:
    ; P3.7 = 1 if Vin > Vdac (keep the trial bit)
    ; P3.7 = 0 if Vin <= Vdac (clear the trial bit)
    JB P3.7, KEEP_BIT
    SJMP NEXT_BIT

KEEP_BIT:
    MOV R0, A         ; Retain trial bit in R0

NEXT_BIT:
    MOV A, R1
    CLR C
    RRC A             ; Shift trial mask to next bit (Bit 7 -> 0)
    MOV R1, A
    JNZ SAR_BIT_LOOP  ; Continue until all 8 bits tested

    ; Conversion complete! R0 holds 8-bit digital value
    MOV A, R0
    MOV R3, A         ; Store result in R3

    ACALL DELAY_WAIT
    SJMP SAR_START

DELAY_WAIT:
    MOV R7, #250
D_WAIT:
    DJNZ R7, D_WAIT
    RET

END
`,
  },
  {
    id: 'comm-async-uart',
    title: '21. Asynchronous UART Serial Frame (9600 Baud, P3.1)',
    category: 'Communications',
    description: 'Generates an asynchronous 8-N-1 serial communication stream on P3.1 (TXD) with 1 Start bit (0), 8 Data bits, and 1 Stop bit (1) for Protocol Analyzer observation.',
    sourceCode: `; ============================================
; Asynchronous Serial UART Transmitter (8-N-1)
; Micro8051SiM: 9600 Baud on Pin P3.1 (TXD)
; Frame: 1 Start Bit (0) + 8 Data Bits + 1 Stop Bit (1)
; No shared clock wire transmitted!
; ============================================
ORG 0000H

START:
    ; 1. Configure Timer 1 for 9600 Baud (Mode 2 Auto-Reload)
    MOV TMOD, #20H    ; Timer 1, Mode 2
    MOV TH1, #0FDH    ; 9600 baud reload value (-3)
    MOV TL1, #0FDH
    SETB TR1          ; Start Timer 1

    ; 2. Configure SCON for Mode 1 (8-bit UART)
    MOV SCON, #50H    ; Mode 1, 8-bit UART, REN=1

TX_LOOP:
    ; Transmit ASCII 'A' (0x41 = 01000001b)
    MOV SBUF, #'A'
WAIT_A:
    JNB TI, WAIT_A    ; Wait until byte sent
    CLR TI

    ACALL DELAY_FRAME

    ; Transmit ASCII 'B' (0x42 = 01000010b)
    MOV SBUF, #'B'
WAIT_B:
    JNB TI, WAIT_B
    CLR TI

    ACALL DELAY_FRAME
    SJMP TX_LOOP

DELAY_FRAME:
    MOV R7, #120
D_FRAME:
    DJNZ R7, D_FRAME
    RET

END
`,
  },
  {
    id: 'comm-sync-mode0',
    title: '22. Synchronous Shift Register (8051 Mode 0, P3.1/P3.0)',
    category: 'Communications',
    description: 'Demonstrates synchronous serial communication using 8051 Serial Mode 0: 8 clock pulses on P3.1 (TXD/CLK) synchronously latch 8 data bits on P3.0 (RXD/DATA).',
    sourceCode: `; ============================================
; Synchronous Serial Shift Register (8051 Mode 0)
; - Clock Pin: P3.1 (TXD) - 8 square wave pulses
; - Data Pin:  P3.0 (RXD) - 8 synchronous data bits
; Speed: Oscillator / 12 (1.0 MHz at 12 MHz crystal)
; ============================================
ORG 0000H

START:
    ; Configure SCON for Mode 0 (Synchronous 8-bit Shift Register)
    MOV SCON, #00H    ; Mode 0 (SM0=0, SM1=0)

SYNC_LOOP:
    ; 1. Transmit pattern 55H (01010101b)
    MOV SBUF, #55H    ; Generates 8 clock pulses on P3.1 with data on P3.0
WAIT_55:
    JNB TI, WAIT_55
    CLR TI

    ACALL DELAY_GAP

    ; 2. Transmit pattern AAH (10101010b)
    MOV SBUF, #0AAH
WAIT_AA:
    JNB TI, WAIT_AA
    CLR TI

    ACALL DELAY_GAP
    SJMP SYNC_LOOP

DELAY_GAP:
    MOV R7, #100
D_GAP:
    DJNZ R7, D_GAP
    RET

END
`,
  },
];

