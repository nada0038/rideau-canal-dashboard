# Rideau Canal Monitoring Dashboard

A simple, real-time web dashboard that displays live ice condition data from the Rideau Canal Skateway. This dashboard shows sensor readings from three locations (Dow's Lake, Fifth Avenue, and NAC) and helps monitor safety conditions for skaters.

## What This Dashboard Does

This dashboard connects to Azure Cosmos DB to fetch real-time sensor data and displays it in an easy-to-read format. It automatically refreshes every 30 seconds to show the latest ice conditions, safety status, and historical trends.

### Key Features

- **Live Data Display**: Shows current sensor readings from all three locations
- **Safety Status Badges**: Color-coded indicators (Safe/Caution/Unsafe) based on ice conditions
- **Auto-Refresh**: Updates automatically every 30 seconds without page reload
- **Historical Charts**: Visualizes trends over the last hour using Chart.js
- **System Overview**: Summary of all locations at a glance

## Technologies Used

- **Backend**: Node.js with Express.js
- **Database**: Azure Cosmos DB (SQL API)
- **Frontend**: HTML, CSS, and vanilla JavaScript
- **Charts**: Chart.js for data visualization
- **Deployment**: Azure App Service

## Prerequisites

Before you start, make sure you have:

- Node.js (version 14 or higher) installed
- npm (comes with Node.js)
- An Azure Cosmos DB account with:
  - Database: `RideauCanalDB`
  - Container: `SensorAggregations`
  - Partition Key: `/location`

## Installation

### Step 1: Clone or Download This Repository

```bash
git clone https://github.com/yourusername/rideau-canal-dashboard.git
cd rideau-canal-dashboard
```

### Step 2: Install Dependencies

This will install all the required packages (Express, Azure Cosmos SDK, etc.):

```bash
npm install
```

### Step 3: Set Up Environment Variables

Create a `.env` file in the root directory. You can copy the example:

```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# Or create it manually
```

Then edit the `.env` file and add your Azure Cosmos DB credentials:

```env
COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_DB_KEY=your-primary-key-here
COSMOS_DB_DATABASE=RideauCanalDB
COSMOS_DB_CONTAINER=SensorAggregations
PORT=3000
```

**Where to find these values:**
1. Go to Azure Portal → Your Cosmos DB account
2. Click "Keys" in the left menu
3. Copy the "URI" (this is your endpoint)
4. Copy the "PRIMARY KEY" (this is your key)

⚠️ **Important**: Never commit your `.env` file to Git! It's already in `.gitignore`.

### Step 4: Start the Server

```bash
npm start
```

Or if you want auto-restart during development:

```bash
npm run dev
```

The dashboard will be available at: `http://localhost:3000`

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `COSMOS_DB_ENDPOINT` | Your Cosmos DB account URI | `https://your-account.documents.azure.com:443/` |
| `COSMOS_DB_KEY` | Your Cosmos DB primary key | `your-key-here` |
| `COSMOS_DB_DATABASE` | Database name | `RideauCanalDB` |
| `COSMOS_DB_CONTAINER` | Container name | `SensorAggregations` |
| `PORT` | Server port (optional) | `3000` |

## API Endpoints

The dashboard provides several API endpoints for fetching data:

### 1. Get Latest Data for All Locations

**GET** `/api/data`

Returns the most recent aggregated data for all three locations.

**Response Example:**
```json
{
  "dows-lake": {
    "location": "dows-lake",
    "timestamp": "2025-01-15T10:30:00Z",
    "avgIceThickness": 32.5,
    "avgSurfaceTemperature": -3.2,
    "maxSnowAccumulation": 5.1,
    "avgExternalTemperature": -8.5,
    "safetyStatus": "Safe",
    "readingCount": 30
  },
  "fifth-avenue": { ... },
  "nac": { ... }
}
```

### 2. Get Latest Data for Specific Location

**GET** `/api/data/:location`

Returns the most recent data for a specific location.

**Parameters:**
- `location`: One of `dows-lake`, `fifth-avenue`, or `nac`

**Example:**
```
GET /api/data/dows-lake
```

### 3. Get Historical Data

**GET** `/api/history/:location?hours=1`

Returns historical data for a location over a specified time period.

**Parameters:**
- `location`: One of `dows-lake`, `fifth-avenue`, or `nac`
- `hours` (query parameter): Number of hours to retrieve (default: 1)

**Example:**
```
GET /api/history/dows-lake?hours=1
```

**Response:** Array of data points with timestamps

### 4. Get System Status

**GET** `/api/status`

Returns overall system status summary.

**Response Example:**
```json
{
  "totalLocations": 3,
  "safeLocations": 2,
  "cautionLocations": 1,
  "unsafeLocations": 0,
  "lastUpdate": "2025-01-15T10:30:00Z",
  "systemStatus": "Caution"
}
```

### 5. Health Check

**GET** `/api/health`

Simple health check endpoint to verify the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Deployment to Azure App Service

Deploying this dashboard to Azure App Service is straightforward:

### Step 1: Create Azure App Service

1. Go to Azure Portal
2. Create a new "Web App" resource
3. Choose Node.js as the runtime stack
4. Select your subscription and resource group

### Step 2: Configure Environment Variables

In your Azure App Service:
1. Go to **Configuration** → **Application settings**
2. Add each environment variable from your `.env` file:
   - `COSMOS_DB_ENDPOINT`
   - `COSMOS_DB_KEY`
   - `COSMOS_DB_DATABASE`
   - `COSMOS_DB_CONTAINER`
   - `PORT` (optional, Azure will set this automatically)

### Step 3: Deploy Your Code

You can deploy using:
- **GitHub Actions** (recommended)
- **Azure CLI**
- **VS Code Azure Extension**
- **FTP/Deployment Center**

### Step 4: Verify Deployment

Once deployed, visit your App Service URL to see the dashboard live!

## Dashboard Features Explained

### Real-time Updates

The dashboard automatically fetches new data every 30 seconds using JavaScript's `setInterval`. No page refresh needed!

### Safety Status Indicators

Each location card shows a color-coded badge:
- 🟢 **Safe**: Ice ≥ 30cm AND Surface Temp ≤ -2°C
- 🟡 **Caution**: Ice ≥ 25cm AND Surface Temp ≤ 0°C
- 🔴 **Unsafe**: All other conditions

### Historical Trend Charts

Two charts display trends over the last hour:
- **Ice Thickness Chart**: Shows how ice thickness changes over time
- **Surface Temperature Chart**: Shows temperature variations

### Location Cards

Each location displays:
- Location name
- Safety status badge
- Average ice thickness (cm)
- Average surface temperature (°C)
- Maximum snow accumulation (cm)
- Average external temperature (°C)
- Last update timestamp

## Project Structure

```
rideau-canal-dashboard/
├── public/
│   ├── index.html          # Main dashboard HTML
│   ├── styles.css          # Dashboard styling
│   └── app.js              # Frontend JavaScript logic
├── server.js               # Express server and API routes
├── package.json            # Node.js dependencies
├── package-lock.json       # Dependency lock file
├── .env.example           # Example environment variables
└── .gitignore             # Git ignore rules
```

## Troubleshooting

### Dashboard Shows "No Data Available"

**Possible causes:**
- Cosmos DB doesn't have data yet
- Stream Analytics job isn't running
- Sensor simulator isn't sending data
- Wrong database/container names in `.env`

**Solutions:**
1. Check Azure Portal → Cosmos DB → Data Explorer to see if data exists
2. Verify your Stream Analytics job is running
3. Make sure your sensor simulator is running
4. Double-check your `.env` file values

### Charts Not Displaying

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify Chart.js is loading (check Network tab)
3. Make sure `/api/history/:location` endpoint returns data
4. Check that data format matches what charts expect

### Auto-refresh Not Working

**Solutions:**
1. Open browser console (F12) and check for errors
2. Verify the server is running and accessible
3. Check Network tab to see if API calls are failing
4. Make sure `setInterval` is set correctly (30 seconds = 30000ms)

### CORS Errors

If you see CORS errors, make sure:
- The `cors` package is installed (`npm install`)
- CORS middleware is enabled in `server.js` (it should be)

### Cannot Connect to Cosmos DB

**Solutions:**
1. Verify your Cosmos DB credentials in `.env`
2. Check Cosmos DB firewall rules (may need to allow Azure services)
3. Verify database and container names are correct
4. Check that your Cosmos DB account is active

## Code Overview

### Backend (`server.js`)

The server handles:
- Connecting to Azure Cosmos DB
- Fetching latest data for each location
- Retrieving historical data for charts
- Calculating system status
- Serving the dashboard HTML

### Frontend (`public/app.js`)

The frontend handles:
- Fetching data from API endpoints
- Updating the UI with new data
- Creating and updating Chart.js visualizations
- Auto-refresh functionality
- Formatting timestamps and data for display

## Next Steps

Once your dashboard is running:
1. Make sure your sensor simulator is sending data
2. Verify Stream Analytics is processing data
3. Check that data is appearing in Cosmos DB
4. Watch your dashboard update in real-time!

## Support

If you run into issues:
1. Check the troubleshooting section above
2. Review the browser console for errors
3. Check server logs for backend errors
4. Verify all Azure services are running correctly

---

**Note**: This dashboard is part of the CST8916 Final Project. Make sure your sensor simulator and Stream Analytics job are running for data to appear!

