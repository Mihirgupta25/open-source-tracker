# Open Source Growth Tracker

A modern web app to track GitHub repository traction metrics, including star growth and pull request velocity, with a beautiful and intuitive UI.

---

## Features

- **Tabbed Interface**
  - **Star Growth Tab:** Visualizes the historical growth in GitHub stars for the Promptfoo repository.
  - **Pull Request Velocity Tab:** Visualizes the ratio of merged to open pull requests for Promptfoo, helping you understand PR workflow efficiency.
  - **Real Time Statistics Tab:** Instantly fetch and view the latest star count for any GitHub repository by pasting its URL.
- **Modern, Colorful UI**
  - Responsive design, card-based layout, and clear axis labeling.
  - Left-aligned, descriptive headers and explanations for each graph.
- **Tooltips and Axis Formatting**
  - Hover for detailed data; axes are clearly labeled and formatted for readability.
- **Automated Data Collection**
  - Background scripts collect star and PR data at regular intervals and store it in SQLite databases.
- **Manual and Automated Data Entry**
  - Easily add or update PR velocity data for any day using scripts or manual SQL.
- **Duplicate Data Handling**
  - Scripts and queries ensure no duplicate entries for the same day.
- **Customizable Data Collection Intervals**
  - Choose between 10 minutes, hourly, or 3-hour intervals for star tracking.

---

## Screenshots

### 📊 Promptfoo Tab - Repository Analytics Dashboard

The main dashboard showing comprehensive metrics for the Promptfoo repository:

![Promptfoo Dashboard](https://i.imgur.com/example1.png)

**Features shown:**
- **Star Growth Chart:** Tracks repository popularity over time (7,698 → 7,710 stars)
- **Pull Request Velocity:** Shows merged vs open PR ratio trends
- **Issue Health:** Displays closed vs open issue ratios
- **Modern UI:** Clean card-based layout with responsive design

### 🔍 Real Time Statistics Tab - Live Repository Lookup

Instant access to any GitHub repository's current metrics:

![Real Time Statistics](https://i.imgur.com/example2.png)

**Features shown:**
- **Live Star Count:** Fetch current star count for any repository
- **URL Input:** Support for both `owner/repo` and full GitHub URLs
- **Instant Results:** Real-time API integration with GitHub
- **Clean Interface:** Minimalist design with clear call-to-action

> **Note:** Screenshots show the optimized UI with reduced whitespace and improved content density for better user experience.

---

## How to Use

### 1. Star Growth Tab
- View a line graph showing the historical star count for the Promptfoo repository.
- Each point represents the total number of stars at a specific time.
- Description below the title explains the graph's purpose.

### 2. Pull Request Velocity Tab
- View a line graph showing the ratio of merged to open PRs for Promptfoo.
- Each point represents the ratio on a specific day.
- Description below the title explains the graph's purpose.
- X-axis ticks are formatted as "Month Day" (e.g., "July 25").

### 3. Real Time Statistics Tab
- Enter any GitHub repository URL (e.g., `https://github.com/facebook/react`) in the input box.
- Click "Fetch Stars" to instantly see the current star count for that repository.
- Section is clearly labeled "Star Count" for clarity.

---

## Quick Start

Want to get the app running in under 1 minute? Follow these steps:

1. **Clone and start:**
   ```bash
   git clone https://github.com/Mihirgupta25/open-source-tracker.git
   cd open-source-tracker
   ./start.sh
   ```

2. **Open your browser:**
   - Go to `http://localhost:3000`
   - That's it! The app automatically handles everything else

**What you'll see:**
- Star Growth graph for Promptfoo
- Pull Request Velocity metrics  
- Issue Health tracking
- Real-time star count fetching

> **Note:** For better performance, add a GitHub token to `backend/.env` (see detailed setup below).

**Alternative:** If you prefer manual control, use `npm start` after running `bash setup.sh`.

**Troubleshooting:** If you get a "concurrently: command not found" error, run `npm install` in the root directory to install the required dependencies.

---

## Detailed Setup

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mihirgupta25/open-source-tracker.git
   cd open-source-tracker
   ```

2. **Install dependencies:**
   ```bash
   # Option 1: Use the setup script (recommended)
   bash setup.sh
   
   # Option 2: Manual installation
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

3. **Set up environment variables:**
   - In `backend/.env`, add your GitHub token for higher API rate limits:
     ```
     GITHUB_TOKEN=your_github_token_here
     ```

4. **Start the backend:**
   ```bash
   cd backend
   node index.js
   ```

5. **Start the frontend:**
   ```bash
   cd frontend
   npm start
   ```

6. **(Optional) Start background data collectors:**
   - For star growth every 3 hours:
     ```bash
     node backend/scripts/star_tracker_3hr.js &
     ```
   - For PR velocity daily collection:
     ```bash
     node backend/scripts/pr_velocity_daily.js &
     ```

---

## Project Structure

```
open-source-tracker/
  backend/
    databases/
      star_growth.db
      pr_velocity.db
    scripts/
      star_tracker_3hr.js
      pr_velocity_daily.js
      pr_ratio_historical.js
      pr_velocity_historical.js
    index.js
    ...
  frontend/
    src/
      App.js
      App.css
      ...
    public/
    README.md
  ...
```

---

## Data Collection & Scripts

### Star Growth
- **Script:** `backend/scripts/star_tracker_3hr.js`
- **Interval:** Every 3 hours (customizable)
- **Database:** `backend/databases/star_growth.db`
- **Table:** `stars` (fields: id, repo, timestamp, count)
- **How it works:**
  - Fetches the current star count for Promptfoo from the GitHub API.
  - Inserts a new row with the timestamp and star count.

### Pull Request Velocity
- **Daily Collection:** `backend/scripts/pr_velocity_daily.js`
  - **Interval:** Every 24 hours at 12:00 PM PST
  - **Database:** `backend/databases/pr_velocity.db`
  - **Table:** `pr_ratios` (fields: id, repo, date, merged_count, open_count, ratio)
  - **How it works:**
    - Automatically fetches merged and open PR counts for the current day.
    - Calculates the ratio and inserts it into the database.
    - Runs continuously every 24 hours.
- **Historical Scripts:**
  - `backend/scripts/pr_ratio_historical.js` - For manual historical data collection
  - `backend/scripts/pr_velocity_historical.js` - For historical PR data
- **Manual Entry:**
  - You can insert a row directly using SQLite for custom or test data.

### Real Time Statistics
- **API Endpoint:** `/api/stars?repo=owner/repo`
- **How it works:**
  - Fetches the current star count for any GitHub repository using the GitHub API.
  - Displays the result instantly in the UI.

---

## Customization

- **Change Data Collection Interval:**
  - Edit the `INTERVAL_MINUTES` variable in `backend/scripts/star_tracker_3hr.js` or create a new script for a different interval.
- **Track a Different Repository:**
  - Change the `REPO` variable in the scripts to the desired `owner/repo`.
- **Add More Metrics:**
  - Extend the backend and frontend to track forks, issues, or other GitHub statistics.
- **UI Customization:**
  - Modify `frontend/src/App.css` for colors, spacing, and layout.

---

## Technologies Used

- **Frontend:** React, Recharts, CSS
- **Backend:** Node.js, Express, better-sqlite3, Axios
- **Database:** SQLite

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License

MIT

## Troubleshooting

**Missing Module Errors (e.g., 'better-sqlite3')**

If you see an error like `Error: Cannot find module 'better-sqlite3'` or any other missing dependency error, make sure you have run:

```bash
cd backend
npm install
cd ../frontend
npm install
```

This will install all required dependencies for both backend and frontend. If you still have issues, try deleting the `node_modules` folder and `package-lock.json` in the affected directory and run `npm install` again.

**AWS DynamoDB Console Shows 0 Items**

If you're using the AWS deployment and the DynamoDB console shows 0 items even though your application is working correctly:

1. **Verify the correct region**: Make sure you're viewing DynamoDB in the **us-east-1** region (US East - N. Virginia)
2. **Use the Explore table data feature**:
   - Go to DynamoDB in us-east-1
   - Click on any table name (e.g., `dev-star-growth`)
   - Click the **"Explore table data"** tab
   - Click **"Run scan"** to see all items
3. **Alternative method**:
   - In the table details, click the **"Items"** tab
   - Click **"Create item"** or **"Scan"** to view existing items

This is a common DynamoDB console display issue due to eventual consistency and caching. Your data is actually there and your application will work correctly even if the console shows 0 items in the table overview.
