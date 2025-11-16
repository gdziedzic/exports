/**
 * DevChef Global State Management
 * Manages shared state between app shell and loaded tools
 */

export const context = {
  input: "",
  output: "",
  onInputChanged: null,

  setInput(val) {
    this.input = val;
    // Update input textarea if it exists
    const inputEl = document.querySelector("#input");
    if (inputEl && inputEl.value !== val) {
      inputEl.value = val;
    }
    // Notify tool of input change
    if (this.onInputChanged) {
      this.onInputChanged(val);
    }
  },

  setOutput(val) {
    this.output = val;
    // Update output textarea if it exists
    const outputEl = document.querySelector("#output");
    if (outputEl) {
      outputEl.value = val;
    }
  },

  getInput() {
    return this.input;
  },

  getOutput() {
    return this.output;
  }
};
