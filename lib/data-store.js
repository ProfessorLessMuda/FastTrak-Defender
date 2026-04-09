const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = [];
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
    } catch {
      this.data = [];
      this.save();
    }
  }

  save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getAll() {
    this.load();
    return this.data;
  }

  getById(id) {
    this.load();
    return this.data.find(item => item.id === id) || null;
  }

  query(filter) {
    this.load();
    return this.data.filter(item => {
      return Object.entries(filter).every(([key, val]) => item[key] === val);
    });
  }

  add(item) {
    this.load();
    if (!item.id) item.id = uuidv4();
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    this.data.push(item);
    this.save();
    return item;
  }

  update(id, updates) {
    this.load();
    const idx = this.data.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.data[idx] = { ...this.data[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.data[idx];
  }

  remove(id) {
    this.load();
    const idx = this.data.findIndex(item => item.id === id);
    if (idx === -1) return false;
    this.data.splice(idx, 1);
    this.save();
    return true;
  }
}

module.exports = DataStore;
