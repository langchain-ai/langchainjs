// Named constants with unique integer values
var C: Record<string, any> = {};
// Tokenizer States
var START   = C.START   = 0x11;
var TRUE1   = C.TRUE1   = 0x21;
var TRUE2   = C.TRUE2   = 0x22;
var TRUE3   = C.TRUE3   = 0x23;
var FALSE1  = C.FALSE1  = 0x31;
var FALSE2  = C.FALSE2  = 0x32;
var FALSE3  = C.FALSE3  = 0x33;
var FALSE4  = C.FALSE4  = 0x34;
var NULL1   = C.NULL1   = 0x41;
var NULL2   = C.NULL3   = 0x42;
var NULL3   = C.NULL2   = 0x43;
var NUMBER1 = C.NUMBER1 = 0x51;
var NUMBER2 = C.NUMBER2 = 0x52;
var NUMBER3 = C.NUMBER3 = 0x53;
var NUMBER4 = C.NUMBER4 = 0x54;
var NUMBER5 = C.NUMBER5 = 0x55;
var NUMBER6 = C.NUMBER6 = 0x56;
var NUMBER7 = C.NUMBER7 = 0x57;
var NUMBER8 = C.NUMBER8 = 0x58;
var STRING1 = C.STRING1 = 0x61;
var STRING2 = C.STRING2 = 0x62;
var STRING3 = C.STRING3 = 0x63;
var STRING4 = C.STRING4 = 0x64;
var STRING5 = C.STRING5 = 0x65;
var STRING6 = C.STRING6 = 0x66;

// Slow code to string converter (only used when throwing syntax errors)
function toknam(code: any) {
  var keys = Object.keys(C);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    if (C[key] === code) { return key; }
  }
  return code && ("0x" + code.toString(16));
}

export class SaxParser {
  callbacks: any;

  state = START;

  // for string parsing
  string: any = undefined; // string data
  unicode: any = undefined; // unicode escapes

  // For number parsing
  negative: any = undefined;
  magnatude: any = undefined;
  position: any = undefined;
  exponent: any = undefined;
  negativeExponent: any = undefined;

  constructor(callbacks: any) {
    this.callbacks = callbacks;
  }

  charError (buffer: any, i: number) {
    this.callbacks.onError(new Error("Unexpected " + JSON.stringify(String.fromCharCode(buffer[i])) + " at position " + i + " in state " + toknam(this.state)));
  }

  parse (buffer: any) {
    if (typeof buffer === "string") buffer = new Buffer(buffer);
    var n;
    for (var i = 0, l = buffer.length; i < l; i++) {
      switch (this.state) {
      case START:
        n = buffer[i];
        switch (n) {
        case 0x7b: // `{`
          this.callbacks.onStartObject();
          continue;
        case 0x7d: // `}`
          this.callbacks.onEndObject();
          continue;
        case 0x5b: // `[`
          this.callbacks.onStartArray();
          continue;
        case 0x5d: // `]`
          this.callbacks.onEndArray();
          continue;
        case 0x3a: // `:`
          this.callbacks.onColon();
          continue;
        case 0x2c: // `,`
          this.callbacks.onComma();
          continue;
        case 0x74: // `t`
          this.state = TRUE1;
          continue;
        case 0x66: // `f`
          this.state = FALSE1;
          continue;
        case 0x6e: // `n`
          this.state = NULL1;
          continue;
        case 0x22: // `"`
          this.string = "";
          this.state = STRING1;
          continue;
        case 0x2d: // `-`
          this.negative = true;
          this.state = NUMBER1;
          continue;
        case 0x30: // `0`
          this.magnatude = 0;
          this.state = NUMBER2;
          continue;
        }
        if (n > 0x30 && n < 0x40) { // 1-9
          this.magnatude = n - 0x30;
          this.state = NUMBER3;
          continue;
        }
        if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
          continue; // whitespace
        }
        this.charError(buffer, i);
      case STRING1: // After open quote
        n = buffer[i];
        switch (n) {
        case 0x22: // `"`
          this.callbacks.onString(this.string);
          this.string = undefined;
          this.state = START;
          continue;
        case 0x5c: // `\`
          this.state = STRING2;
          continue;
        }
        if (n >= 0x20) {
          this.string += String.fromCharCode(n);
          continue;
        }
        this.charError(buffer, i);
      case STRING2: // After backslash
        n = buffer[i];
        switch (n) {
        case 0x22: this.string += "\""; this.state = STRING1; continue;
        case 0x5c: this.string += "\\"; this.state = STRING1; continue;
        case 0x2f: this.string += "\/"; this.state = STRING1; continue;
        case 0x62: this.string += "\b"; this.state = STRING1; continue;
        case 0x66: this.string += "\f"; this.state = STRING1; continue;
        case 0x6e: this.string += "\n"; this.state = STRING1; continue;
        case 0x72: this.string += "\r"; this.state = STRING1; continue;
        case 0x74: this.string += "\t"; this.state = STRING1; continue;
        case 0x75: this.unicode = ""; this.state = STRING3; continue;
        }
        this.charError(buffer, i);
      case STRING3: case STRING4: case STRING5: case STRING6: // unicode hex codes
        n = buffer[i];
        // 0-9 A-F a-f
        if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
          this.unicode += String.fromCharCode(n);
          if (this.state++ === STRING6) {
            this.string += String.fromCharCode(parseInt(this.unicode, 16));
            this.unicode = undefined;
            this.state = STRING1;
          }
          continue;
        }
        this.charError(buffer, i);
      case NUMBER1: // after minus
        n = buffer[i];
        if (n === 0x30) { // `0`
          this.magnatude = 0;
          this.state = NUMBER2;
          continue;
        }
        if (n > 0x30 && n < 0x40) { // `1`-`9`
          this.magnatude = n - 0x30;
          this.state = NUMBER3;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER2: // * After initial zero
        switch (buffer[i]) {
        case 0x2e: // .
          this.position = 0.1; this.state = NUMBER4; continue;
        case 0x65: case 0x45: // e/E
          this.exponent = 0; this.state = NUMBER6; continue;
        }
        this.finish();
        i--; // rewind to re-check this char
        continue;
      case NUMBER3: // * After digit (before period)
        n = buffer[i];
        switch (n) {
        case 0x2e: // .
          this.position = 0.1; this.state = NUMBER4; continue;
        case 0x65: case 0x45: // e/E
          this.exponent = 0; this.state = NUMBER6; continue;
        }
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.magnatude = this.magnatude * 10 + (n - 0x30);
          continue;
        }
        this.finish();
        i--; // rewind to re-check
        continue;
      case NUMBER4: // After period
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.magnatude += this.position * (n - 0x30);
          this.position /= 10;
          this.state = NUMBER5;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER5: // * After digit (after period)
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.magnatude += this.position * (n - 0x30);
          this.position /= 10;
          continue;
        }
        if (n === 0x65 || n === 0x45) { // E/e
          this.exponent = 0;
          this.state = NUMBER6;
          continue;
        }
        this.finish();
        i--; // rewind
        continue;
      case NUMBER6: // After E
        n = buffer[i];
        if (n === 0x2b || n === 0x2d) { // +/-
          if (n === 0x2d) { this.negativeExponent = true; }
          this.state = NUMBER7;
          continue;
        }
        if (n >= 0x30 && n < 0x40) {
          this.exponent = this.exponent * 10 + (n - 0x30);
          this.state = NUMBER8;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER7: // After +/-
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.exponent = this.exponent * 10 + (n - 0x30);
          this.state = NUMBER8;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER8: // * After digit (after +/-)
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.exponent = this.exponent * 10 + (n - 0x30);
          continue;
        }
        this.finish();
        i--;
        continue;
      case TRUE1: // r
        if (buffer[i] === 0x72) {
          this.state = TRUE2;
          continue;
        }
        this.charError(buffer, i);
      case TRUE2: // u
        if (buffer[i] === 0x75) {
          this.state = TRUE3;
          continue;
        }
        this.charError(buffer, i);
      case TRUE3: // e
        if (buffer[i] === 0x65) {
          this.state = START;
          this.callbacks.onBoolean(true);
          continue;
        }
        this.charError(buffer, i);
      case FALSE1: // a
        if (buffer[i] === 0x61) {
          this.state = FALSE2;
          continue;
        }
        this.charError(buffer, i);
      case FALSE2: // l
        if (buffer[i] === 0x6c) {
          this.state = FALSE3;
          continue;
        }
        this.charError(buffer, i);
      case FALSE3: // s
        if (buffer[i] === 0x73) {
          this.state = FALSE4;
          continue;
        }
        this.charError(buffer, i);
      case FALSE4: // e
        if (buffer[i] === 0x65) {
          this.state = START;
          this.callbacks.onBoolean(false);
          continue;
        }
        this.charError(buffer, i);
      case NULL1: // u
        if (buffer[i] === 0x75) {
          this.state = NULL2;
          continue;
        }
        this.charError(buffer, i);
      case NULL2: // l
        if (buffer[i] === 0x6c) {
          this.state = NULL3;
          continue;
        }
        this.charError(buffer, i);
      case NULL3: // l
        if (buffer[i] === 0x6c) {
          this.state = START;
          this.callbacks.onNull();
          continue;
        }
        this.charError(buffer, i);
      }
    }
  }

  finish() {
    switch (this.state) {
    case NUMBER2: // * After initial zero
      this.callbacks.onNumber(0);
      this.state = START;
      this.magnatude = undefined;
      this.negative = undefined;
      break;
    case NUMBER3: // * After digit (before period)
      this.state = START;
      if (this.negative) {
        this.magnatude = -this.magnatude;
        this.negative = undefined;
      }
      this.callbacks.onNumber(this.magnatude);
      this.magnatude = undefined;
      break;
    case NUMBER5: // * After digit (after period)
      this.state = START;
      if (this.negative) {
        this.magnatude = -this.magnatude;
        this.negative = undefined;
      }
      this.callbacks.onNumber(this.negative ? -this.magnatude : this.magnatude);
      this.magnatude = undefined;
      this.position = undefined;
      break;
    case NUMBER8: // * After digit (after +/-)
      if (this.negativeExponent) {
        this.exponent = -this.exponent;
        this.negativeExponent = undefined;
      }
      this.magnatude *= Math.pow(10, this.exponent);
      this.exponent = undefined;
      if (this.negative) {
        this.magnatude = -this.magnatude;
        this.negative = undefined;
      }
      this.state = START;
      this.callbacks.onNumber(this.magnatude);
      this.magnatude = undefined;
      break;
    }
    if (this.state !== START) {
      this.callbacks.onError(new Error("Unexpected end of input stream"));
    }
  }
}
