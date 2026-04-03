class FlowContext {
  constructor(initial) {
    this.data = {};
    this.lastKey = undefined;

    if (initial && typeof initial === "object") {
      for (const [key, value] of Object.entries(initial)) {
        this.set(key, value);
      }
    }
  }

  set(key, value) {
    this.data[key] = value;
    this.lastKey = key;
  }

  get(key) {
    if (key) return this.data[key];
    if (this.lastKey) return this.data[this.lastKey];
    return undefined;
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  last() {
    return this.get();
  }

  toJSON() {
    return { ...this.data };
  }
}

module.exports = { FlowContext };
