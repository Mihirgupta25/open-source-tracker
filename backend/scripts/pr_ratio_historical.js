const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';
const dbPath = path.join(__dirname, 'databases', 'pr_velocity.db');
const db = new Database(dbPath);

function getDateStringsForLastNDays(n) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates.reverse();
}

async function fetchPRCount(query) {
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}`;
  const headers = GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};
  const res = await axios.get(url, { headers });
  return res.data.total_count;
}

async function main() {
  for (let offset = 1; offset <= 3; offset++) {
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - offset);
    const date = dateObj.toISOString().slice(0, 10);
    // Merged PRs for this day
    const mergedQuery = `repo:${REPO} is:pr is:merged merged:${date}`;
    // Open PRs for this day: created on or before this day, not closed before this day
    const createdQuery = `repo:${REPO} is:pr created:<=${date}`;
    const closedQuery = `repo:${REPO} is:pr closed:<${date}`;
    const merged_count = await fetchPRCount(mergedQuery);
    const created_count = await fetchPRCount(createdQuery);
    const closed_count = await fetchPRCount(closedQuery);
    const open_count = created_count - closed_count;
    const ratio = open_count > 0 ? merged_count / open_count : 0;
    db.prepare('INSERT INTO pr_ratios (repo, date, merged_count, open_count, ratio) VALUES (?, ?, ?, ?, ?)')
      .run(REPO, date, merged_count, open_count, ratio);
    console.log(`Inserted for ${date}: merged=${merged_count}, open=${open_count}, ratio=${ratio}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 