// ==========================================
// TAB 1: ĐIỀU KHIỂN ĐỘNG CƠ, SERVO & CẢM BIẾN
// ==========================================
//% weight=100 color=#0fbc11 icon="\uf11b" block="Cover_Maqueen"
//namespace Exansion_Microbit {
namespace Cover_Maqueen {
    export enum MotorNum {
        //% block="M1"
        M1 = 1,
        //% block="M2"
        M2 = 2
    }

    export enum MotorDir {
        //% block="Thuận"
        Forward = 1,
        //% block="Ngược"
        Reverse = 2
    }

    export enum ServoChannel {
        //% block="S1"
        S1 = 6,
        //% block="S2"
        S2 = 5,
        //% block="S3"
        S3 = 4
    }

    export enum LinePins {
        //% block="P0"
        P0 = 0,
        //% block="P1"
        P1 = 1,
        //% block="P2"
        P2 = 2
    }

    const PCA9685_ADDRESS = 0x40;
    const MODE1 = 0x00;
    const PRESCALE = 0xFE;
    const LED0_ON_L = 0x06;

    let initialized = false;

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(addr, buf);
    }

    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
    }

    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDRESS, MODE1, 0x00);
        let freq = 50;
        let prescaleval = 25000000 / 4096 / freq - 1;
        let oldmode = i2cread(PCA9685_ADDRESS, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10;
        i2cwrite(PCA9685_ADDRESS, MODE1, newmode);
        i2cwrite(PCA9685_ADDRESS, PRESCALE, prescaleval);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode);
        control.waitMicros(5000);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode | 0xa1);

        setPwm(0, 0, 4095);
        for (let idx = 1; idx < 16; idx++) {
            setPwm(idx, 0, 0);
        }

        // Kích hoạt chân nSLEEP (P9) để đánh thức IC DRV8833
        pins.digitalWritePin(DigitalPin.P9, 1);

        initialized = true;
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15) return;
        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf);
    }

    // ==========================================
    // NHÓM: CƠ CẤU CHẤP HÀNH (PCA9685)
    // ==========================================

    //% block="Servo PCA9685 |%channel| quay %degree độ"
    //% weight=99 degree.min=0 degree.max=180
    //% group="Cơ cấu chấp hành (PCA9685)"
    export function servoPCA9685(channel: ServoChannel, degree: number): void {
        if (!initialized) initPCA9685();
        let v_us = (degree * 1800 / 180 + 600);
        let value = v_us * 4096 / 20000;
        setPwm(channel, 0, value);
    }

    //% block="Động cơ %motor chạy %dir tốc độ %speed"
    //% weight=97 speed.min=0 speed.max=100
    //% group="Cơ cấu chấp hành (PCA9685)"
    export function motorControl(motor: MotorNum, dir: MotorDir, speed: number): void {
        if (!initialized) initPCA9685();
        let in1 = 0, in2 = 0;

        // Cập nhật chân theo sơ đồ Altium
        if (motor == MotorNum.M1) { in1 = 3; in2 = 2; }
        else if (motor == MotorNum.M2) { in1 = 0; in2 = 1; }

        if (speed > 100) speed = 100;
        if (speed < 0) speed = 0;

        let pwm_val = Math.round((speed * 4095) / 100);

        if (dir == MotorDir.Forward) {
            setPwm(in1, 0, pwm_val); setPwm(in2, 0, 0);
        } else {
            setPwm(in1, 0, 0); setPwm(in2, 0, pwm_val);
        }
    }

    //% block="Dừng động cơ %motor"
    //% weight=95 group="Cơ cấu chấp hành (PCA9685)"
    export function motorStop(motor: MotorNum): void {
        if (!initialized) initPCA9685();
        let in1 = (motor == MotorNum.M1) ? 3 : 0;
        let in2 = (motor == MotorNum.M1) ? 2 : 1;
        setPwm(in1, 0, 0); setPwm(in2, 0, 0);
    }

     // ==========================================
    // NHÓM: CẢM BIẾN
    // ==========================================

    //% block="đọc khoảng cách siêu âm (cm)"
    //% weight=89 group="Cảm biến"
    export function readUltrasonic(): number {
        let trig = DigitalPin.P13;
        let echo = DigitalPin.P14;

        pins.digitalWritePin(trig, 0); control.waitMicros(2);
        pins.digitalWritePin(trig, 1); control.waitMicros(10);
        pins.digitalWritePin(trig, 0);

        let data = pins.pulseIn(echo, PulseValue.High, 30000);
        if (data == 0) {
            pins.digitalWritePin(trig, 1); control.waitMicros(10);
            pins.digitalWritePin(trig, 0);
            data = pins.pulseIn(echo, PulseValue.High, 30000);
        }

        let distance = data / 58;
        return (distance <= 0 || distance > 400) ? 400 : Math.round(distance);
    }

    //% block="đọc giá trị số dò line chân %pin"
    //% weight=88 group="Cảm biến"
    export function readLineDigital(pin: LinePins): number {
        if (pin == LinePins.P0) {
            return pins.digitalReadPin(DigitalPin.P0);
        } else if (pin == LinePins.P1) {
            return pins.digitalReadPin(DigitalPin.P1);
        } else {
            return pins.digitalReadPin(DigitalPin.P2);
        }
    }

    //% block="đọc giá trị tương tự dò line chân %pin"
    //% weight=87 group="Cảm biến"
    export function readLineAnalog(pin: LinePins): number {
        if (pin == LinePins.P0) {
            return pins.analogReadPin(AnalogPin.P0);
        } else if (pin == LinePins.P1) {
            return pins.analogReadPin(AnalogPin.P1);
        } else {
            return pins.analogReadPin(AnalogPin.P2);
        }
    }
}

// ==========================================
// TAB 2: ĐIỀU KHIỂN LED WS2812 
// ==========================================
//% weight=90 color=#0078D7 icon="\uf0eb" block="WS2812"
namespace Expansion_WS2812 {
    let strips: neopixel.Strip[] = [];
    let _brightness = 100;

    function getStrip(pin: DigitalPin): neopixel.Strip {
        if (!strips[pin]) {
            strips[pin] = neopixel.create(pin, 4, NeoPixelMode.RGB);
            strips[pin].setBrightness(_brightness);
        }
        return strips[pin];
    }

    export enum NeoPixelColors {
        //% block="đỏ"
        Red = 0xFF0000,
        //% block="cam"
        Orange = 0xFFA500,
        //% block="vàng"
        Yellow = 0xFFFF00,
        //% block="xanh lá"
        Green = 0x00FF00,
        //% block="xanh dương"
        Blue = 0x0000FF,
        //% block="chàm"
        Indigo = 0x4b0082,
        //% block="tím"
        Violet = 0x8a2be2,
        //% block="tím hồng"
        Purple = 0xFF00FF,
        //% block="trắng"
        White = 0xFFFFFF,
        //% block="đen (tắt)"
        Black = 0x000000
    }

    //% block="chỉnh độ sáng LED RGB thành %brightness"
    //% brightness.min=0 brightness.max=255
    //% weight=100
    export function setBrightness(brightness: number): void {
        _brightness = brightness;
        for (let i = 0; i < strips.length; i++) {
            if (strips[i]) {
                strips[i].setBrightness(_brightness);
                strips[i].show();
            }
        }
    }

    //% block="chân %pin bật toàn bộ LED RGB màu %color"
    //% pin.defl=DigitalPin.P8
    //% weight=90
    export function showColor(pin: DigitalPin, color: NeoPixelColors): void {
        let s = getStrip(pin);
        s.showColor(color);
    }

    //% block="chân %pin dải từ bóng %start số lượng %count sáng màu %color"
    //% pin.defl=DigitalPin.P8
    //% weight=75
    export function showRangeColor(pin: DigitalPin, start: number, count: number, color: NeoPixelColors): void {
        let s = getStrip(pin);
        let range = s.range(start, count);
        range.showColor(color);
    }

    //% block="chân %pin bật hiệu ứng cầu vồng từ %startHue đến %endHue"
    //% pin.defl=DigitalPin.P8
    //% weight=60
    export function showRainbow(pin: DigitalPin, startHue: number, endHue: number): void {
        let s = getStrip(pin);
        s.showRainbow(startHue, endHue);
    }

    //% block="chân %pin tắt toàn bộ LED RGB"
    //% pin.defl=DigitalPin.P8
    //% weight=50
    export function clearAll(pin: DigitalPin): void {
        let s = getStrip(pin);
        s.clear();
        s.show();
    }
}

// ==========================================
// TAB 3: MẮT THU HỒNG NGOẠI IR 
// ==========================================
//% weight=85 color=#E3008C icon="\uf012" block="Hồng Ngoại IR"
namespace Expansion_IR {
    let irPin: DigitalPin;
    let lastCommand = -1;
    let irInitialized = false;

    let mark = 0;
    let space = 0;
    let bits = 0;
    let data = 0;
    let receiving = false;

    export enum IRKeys {
        //% block="Lên"
        Up = 0x18,
        //% block="Xuống"
        Down = 0x52,
        //% block="Trái"
        Left = 0x08,
        //% block="Phải"
        Right = 0x5A,
        //% block="OK"
        OK = 0x1C,
        //% block="Phím 1"
        Num1 = 0x45,
        //% block="Phím 2"
        Num2 = 0x46,
        //% block="Phím 3"
        Num3 = 0x47,
        //% block="Phím 4"
        Num4 = 0x44,
        //% block="Phím 5"
        Num5 = 0x40,
        //% block="Phím 6"
        Num6 = 0x43,
        //% block="Phím 7"
        Num7 = 0x07,
        //% block="Phím 8"
        Num8 = 0x15,
        //% block="Phím 9"
        Num9 = 0x09,
        //% block="Phím 0"
        Num0 = 0x19,
        //% block="* (Sao)"
        Star = 0x16,
        //% block="# (Thăng)"
        Hash = 0x0D,
    }

    //% block="Khởi tạo mắt thu IR tại chân %pin"
    //% pin.defl=DigitalPin.P15
    //% weight=100
    export function initIR(pin: DigitalPin): void {
        irPin = pin;
        pins.setPull(irPin, PinPullMode.PullUp);
        irInitialized = true;

        pins.onPulsed(irPin, PulseValue.Low, function () {
            mark = pins.pulseDuration();
        });

        pins.onPulsed(irPin, PulseValue.High, function () {
            space = pins.pulseDuration();

            if (mark > 8000 && mark < 10000 && space > 3000 && space < 5000) {
                bits = 0;
                data = 0;
                receiving = true;
            }
            else if (receiving) {
                if (space > 1000 && space < 2500) {
                    data |= (1 << bits);
                } else if (space > 200 && space < 1000) {
                    // Bit 0
                } else {
                    receiving = false;
                    return;
                }
                bits++;

                if (bits === 32) {
                    let command = (data >> 16) & 0xFF;
                    lastCommand = command;
                    receiving = false;
                }
            }
        });
    }

    //% block="Phím %key được bấm ?"
    //% weight=90
    export function isKeyPressed(key: IRKeys): boolean {
        if (!irInitialized) return false;
        if (lastCommand === key) {
            lastCommand = -1;
            return true;
        }
        return false;
    }

    //% block="Đọc mã HEX của phím"
    //% weight=80
    export function getIrCode(): number {
        if (!irInitialized) return -1;
        let current = lastCommand;
        lastCommand = -1;
        return current;
    }
}