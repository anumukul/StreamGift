// Pino stub for browser builds
// This prevents Turbopack from trying to bundle pino's Node.js dependencies

const noop = () => {};

const pinoStub = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  child: () => pinoStub,
  level: 'silent',
};

export default function pino() {
  return pinoStub;
}
