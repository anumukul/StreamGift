// Minimal stub to replace `thread-stream` during client/server bundling.
// Exports a no-op constructor and harmless defaults so imports don't trigger
// parsing of package test files during Next/Turbopack build.
class ThreadStreamStub {
  constructor() {}
}

module.exports = ThreadStreamStub;
