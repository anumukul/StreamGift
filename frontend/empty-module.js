// Local stub for thread-stream to avoid Turbopack parsing test/fixture files
// Exports a benign no-op factory to satisfy requires during build.
function ThreadStreamStub() {
  return {
    write: () => {},
    end: () => {},
    on: () => {},
  };
}

module.exports = ThreadStreamStub;
module.exports.default = ThreadStreamStub;
