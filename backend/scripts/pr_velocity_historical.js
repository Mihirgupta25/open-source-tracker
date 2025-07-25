const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';
const dbPath = path.join(__dirname, 'databases', 'pr_velocity.db');
const db = new Database(dbPath);

async function fetchClosedPRs(page = 1) {
  const url = `https://api.github.com/repos/${REPO}/pulls?state=closed&per_page=100&page=${page}`;
  const headers = GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};
  const res = await axios.get(url, { headers });
  return res.data;
}

function prExists(pr_number) {
  const row = db.prepare('SELECT 1 FROM pr_closures WHERE repo = ? AND pr_number = ?').get(REPO, pr_number);
  return !!row;
}

async function main() {
  let page = 1;
  let totalInserted = 0;
  while (true) {
    const prs = await fetchClosedPRs(page);
    if (!prs.length) break;
    for (const pr of prs) {
      if (!pr.closed_at || !pr.created_at) continue;
      if (prExists(pr.number)) continue;
      const opened = new Date(pr.created_at);
      const closed = new Date(pr.closed_at);
      const duration_hours = (closed - opened) / (1000 * 60 * 60);
      db.prepare('INSERT INTO pr_closures (repo, pr_number, opened_at, closed_at, duration_hours) VALUES (?, ?, ?, ?, ?)')
        .run(REPO, pr.number, pr.created_at, pr.closed_at, duration_hours);
      totalInserted++;
    }
    page++;
  }
  console.log(`Inserted ${totalInserted} PR closure records.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 