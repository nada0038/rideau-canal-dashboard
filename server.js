const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static('public', {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Normalize Cosmos DB document for dashboard output
function normalizeDoc(raw) {
    if (!raw) return null;

    return {
        location: raw.location
            .toLowerCase()
            .replace(/'/g, "")
            .replace(/\s+/g, "-"),

        timestamp: raw.windowEnd || raw.timestamp,
        avgIceThickness: raw.avgIceThickness,
        avgSurfaceTemperature: raw.avgSurfaceTemperature,
        maxSnowAccumulation: raw.maxSnowAccumulation,
        avgExternalTemperature: raw.avgExternalTemperature,
        safetyStatus: raw.safetyStatus,
        readingCount: raw.readingCount
    };
}

// Cosmos DB setup
const cosmosClient = new CosmosClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT,
    key: process.env.COSMOS_DB_KEY
});

const databaseId = process.env.COSMOS_DB_DATABASE || "RideauCanalDB";
const containerId = process.env.COSMOS_DB_CONTAINER || "SensorAggregations";

let container;
try {
    const database = cosmosClient.database(databaseId);
    container = database.container(containerId);
    console.log(`Connected to Cosmos DB: ${databaseId}/${containerId}`);
} catch (err) {
    console.error("Failed to connect to Cosmos DB:", err.message);
}

// Fetch latest data for a location
async function getLatestData(locationKey) {
    if (!container) {
        console.error("Container not initialized");
        return null;
    }

    // Try both formats: deviceId format (dows-lake) and full name format (Dow's Lake)
    // Stream Analytics uses deviceId, but let's check both to be safe
    const locationVariants = [
        locationKey, // "dows-lake", "fifth-avenue", "nac"
        locationKey === "dows-lake" ? "Dow's Lake" : 
        locationKey === "fifth-avenue" ? "Fifth Avenue" : 
        locationKey === "nac" ? "NAC" : null
    ].filter(Boolean);

    for (const loc of locationVariants) {
        try {
            const querySpec = {
                query: "SELECT * FROM c WHERE c.location = @loc ORDER BY c.windowEnd DESC OFFSET 0 LIMIT 1",
                parameters: [{ name: "@loc", value: loc }]
            };

            const { resources } = await container.items.query(querySpec).fetchAll();
            if (resources.length > 0) {
                console.log(`Found data for location: ${loc} (searched as: ${locationKey})`);
                return normalizeDoc(resources[0]);
            }
        } catch (err) {
            console.error(`Error querying location ${loc}:`, err.message);
        }
    }

    // If no data found, try to see what locations actually exist
    try {
        const allLocationsQuery = {
            query: "SELECT DISTINCT c.location FROM c"
        };
        const { resources } = await container.items.query(allLocationsQuery).fetchAll();
        if (resources.length > 0) {
            console.log(`Available locations in Cosmos DB:`, resources.map(r => r.location));
        }
    } catch (err) {
        console.error("Error checking available locations:", err.message);
    }

    console.log(`No data found for location: ${locationKey}`);
    return null;
}

// GET /api/data - latest data for all locations
app.get("/api/data", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const locations = ["dows-lake", "fifth-avenue", "nac"];
    const result = {};

    for (const loc of locations) {
        const data = await getLatestData(loc);
        if (data) result[loc] = data;
    }

    res.json(result);
});

// GET /api/data/:location - latest data for a specific location
app.get("/api/data/:location", async (req, res) => {
    const data = await getLatestData(req.params.location);
    if (!data) return res.status(404).json({ error: "No data for location" });
    res.json(data);
});

// GET /api/history/:location - historical data for last hour
app.get("/api/history/:location", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (!container) {
        return res.status(500).json({ error: "Container not initialized" });
    }

    const hours = parseInt(req.query.hours) || 1;
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    // Try both location formats
    const locationKey = req.params.location;
    const locationVariants = [
        locationKey, // "dows-lake", "fifth-avenue", "nac"
        locationKey === "dows-lake" ? "Dow's Lake" : 
        locationKey === "fifth-avenue" ? "Fifth Avenue" : 
        locationKey === "nac" ? "NAC" : null
    ].filter(Boolean);

    let allResources = [];
    for (const loc of locationVariants) {
        try {
            const querySpec = {
                query:
                    "SELECT * FROM c WHERE c.location = @loc AND c.windowEnd >= @cut ORDER BY c.windowEnd ASC",
                parameters: [
                    { name: "@loc", value: loc },
                    { name: "@cut", value: cutoff.toISOString() }
                ]
            };
            const { resources } = await container.items.query(querySpec).fetchAll();
            if (resources.length > 0) {
                allResources = resources;
                break; // Use first successful query
            }
        } catch (err) {
            console.error(`Error querying history for ${loc}:`, err.message);
        }
    }

    res.json(allResources.map(normalizeDoc));
});

// System status endpoint
app.get("/api/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const locations = ["dows-lake", "fifth-avenue", "nac"];
    const locationData = {};
    let totalLocations = 0;
    let safeLocations = 0;
    let cautionLocations = 0;
    let unsafeLocations = 0;
    let latestTimestamp = null;

    for (const loc of locations) {
        const data = await getLatestData(loc);
        if (data) {
            locationData[loc] = data;
            totalLocations++;
            
            const status = (data.safetyStatus || "").toLowerCase();
            if (status === "safe") safeLocations++;
            else if (status === "caution") cautionLocations++;
            else unsafeLocations++;

            if (data.timestamp) {
                const ts = new Date(data.timestamp);
                if (!latestTimestamp || ts > latestTimestamp) {
                    latestTimestamp = ts;
                }
            }
        }
    }

    // Determine overall system status
    let systemStatus = "Unknown";
    if (totalLocations === 0) {
        systemStatus = "No Data";
    } else if (unsafeLocations > 0) {
        systemStatus = "Unsafe";
    } else if (cautionLocations > 0) {
        systemStatus = "Caution";
    } else if (safeLocations === totalLocations) {
        systemStatus = "Safe";
    }

    res.json({
        systemStatus,
        totalLocations,
        safeLocations,
        cautionLocations,
        unsafeLocations,
        lastUpdate: latestTimestamp ? latestTimestamp.toISOString() : null,
        locations: locationData
    });
});

// Debug endpoint to check Cosmos DB connection and data
app.get("/api/debug", async (req, res) => {
    if (!container) {
        return res.status(500).json({ 
            error: "Container not initialized",
            endpoint: process.env.COSMOS_DB_ENDPOINT,
            database: databaseId,
            container: containerId
        });
    }

    try {
        // Get all distinct locations
        const locationsQuery = {
            query: "SELECT DISTINCT c.location FROM c"
        };
        const { resources: locations } = await container.items.query(locationsQuery).fetchAll();

        // Get latest document from each location
        const latestDocs = {};
        for (const loc of locations) {
            const locationName = loc.location;
            const querySpec = {
                query: "SELECT TOP 1 * FROM c WHERE c.location = @loc ORDER BY c.windowEnd DESC",
                parameters: [{ name: "@loc", value: locationName }]
            };
            const { resources } = await container.items.query(querySpec).fetchAll();
            if (resources.length > 0) {
                latestDocs[locationName] = {
                    raw: resources[0],
                    normalized: normalizeDoc(resources[0])
                };
            }
        }

        // Get total document count
        const countQuery = {
            query: "SELECT VALUE COUNT(1) FROM c"
        };
        const { resources: countResult } = await container.items.query(countQuery).fetchAll();
        const totalCount = countResult.length > 0 ? countResult[0] : 0;

        res.json({
            connected: true,
            endpoint: process.env.COSMOS_DB_ENDPOINT ? "Set" : "Missing",
            database: databaseId,
            container: containerId,
            totalDocuments: totalCount,
            availableLocations: locations.map(l => l.location),
            latestDocuments: latestDocs
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

// Root page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
