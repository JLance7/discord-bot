const { readFileSync, renameSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

function makeLocalStore(guild, directory = __dirname) {
  const file = join(directory, `fred-${guild}.json`);
  function read() {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { list: {}, moods: {} };
    }
  }

  function update(change) {
    // Each write finishes before the next command can read or change the file.
    const data = read();
    const result = change(data);
    writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n");
    renameSync(file + ".tmp", file);
    return result;
  }

  return {
    add(id, text) {
      return update(data => {
        if (!Object.hasOwn(data.list, id)) data.list[id] = { text };
      });
    },
    list() {
      return Object.entries(read().list)
        .filter(([, item]) => !item.done)
        .sort(([left], [right]) => BigInt(left) > BigInt(right) ? -1 : 1)
        .slice(0, 8)
        .map(([id, item]) => ({ id, text: item.text }));
    },
    done(id) {
      return update(data => {
        if (!data.list[id] || data.list[id].done) return false;
        data.list[id] = { done: true };
        return true;
      });
    },
    checkin(userId, id, mood, note) {
      return update(data => {
        const previous = data.moods[userId];
        if (!previous || BigInt(id) > BigInt(previous.id)) data.moods[userId] = { id, mood, note };
      });
    },
    moods() {
      return Object.entries(read().moods).map(([userId, { mood, note }]) => ({ userId, mood, note }));
    },
  };
}

module.exports = { makeLocalStore };
