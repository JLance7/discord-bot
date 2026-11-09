const string = (name, description, extra = {}) => ({ name, description, type: 3, ...extra });
const subcommand = (name, description, options = []) => ({ name, description, type: 1, options });

const moods = ["Great", "Okay", "Low energy", "Stressed", "Need support"];
const settings = ["Any", "At home", "Outdoors"];
const choices = values => values.map(value => ({ name: value, value }));

const command = {
  name: "together",
  description: "A private little toolkit for the two of you",
  type: 1,
  options: [
    subcommand("date", "Pick a date idea", [string("setting", "Where to go", { choices: choices(settings) })]),
    subcommand("question", "Get a conversation starter"),
    subcommand("add", "Add an idea or task to your shared list", [
      string("item", "What should go on the list?", { required: true, min_length: 1, max_length: 90 }),
    ]),
    subcommand("list", "See the latest eight items on your shared list"),
    subcommand("done", "Remove a completed item from the list", [
      string("id", "Copy the ID shown next to the item", { required: true, min_length: 17, max_length: 20 }),
    ]),
    subcommand("checkin", "Share how you feel with your partner", [
      string("mood", "How are you feeling?", { required: true, choices: choices(moods) }),
      string("note", "Optional note your partner can read", { max_length: 150 }),
    ]),
    subcommand("moods", "Read your two latest check-ins"),
    subcommand("countdown", "See how long until your next special date"),
  ],
};

module.exports = { command, moods };
