export class Input {
  constructor(target = window) {
    this.keys = new Set();
    target.addEventListener('keydown', e => this.keys.add(e.key));
    target.addEventListener('keyup', e => this.keys.delete(e.key));
  }

  isKeyDown(key) {
    return this.keys.has(key);
  }
}