const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running', timestamp: new Date().toISOString() });
});

// Fetch iCal data endpoint
app.post('/api/fetch-ical', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ 
        error: 'Invalid request. Expected array of URLs.' 
      });
    }

    const results = [];
    
    // Process each URL
    for (const urlData of urls) {
      const { url, listingId, listingName } = urlData;
      
      try {
        console.log(`Fetching iCal data for ${listingName}: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 10000, // 10 second timeout
          headers: {
            'User-Agent': 'Cleaning-Calculator/1.0'
          }
        });
        
        const icalData = response.data;
        const events = parseICalData(icalData);
        
        results.push({
          listingId,
          listingName,
          success: true,
          events,
          eventCount: events.length
        });
        
        console.log(`Successfully fetched ${events.length} events for ${listingName}`);
        
      } catch (error) {
        console.error(`Error fetching iCal for ${listingName}:`, error.message);
        
        results.push({
          listingId,
          listingName,
          success: false,
          error: error.message,
          events: []
        });
      }
    }
    
    res.json({ results });
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Parse iCal data function
function parseICalData(icalText) {
  const events = [];
  const lines = icalText.split(/\r?\n/).map(line => line.trim());
  let currentEvent = {};
  let inEvent = false;

  for (let line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT' && inEvent) {
      if (currentEvent.dtstart && currentEvent.dtend) {
        events.push({
          ...currentEvent,
          summary: currentEvent.summary || 'Unnamed Booking'
        });
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        currentEvent.dtstart = parseDateFromICAL(line);
      } else if (line.startsWith('DTEND')) {
        currentEvent.dtend = parseDateFromICAL(line);
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8).trim();
      } else if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4).trim();
      }
    }
  }

  return events;
}

// Parse date from iCal format
function parseDateFromICAL(line) {
  // Handle different date formats in iCal
  const dateMatch = line.match(/(\d{8})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    return new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(4, 6)) - 1,
      parseInt(dateStr.slice(6, 8))
    );
  }
  
  // Handle datetime format (YYYYMMDDTHHMMSSZ)
  const datetimeMatch = line.match(/(\d{8}T\d{6}Z?)/);
  if (datetimeMatch) {
    const datetimeStr = datetimeMatch[1];
    const dateStr = datetimeStr.slice(0, 8);
    return new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(4, 6)) - 1,
      parseInt(dateStr.slice(6, 8))
    );
  }
  
  return null;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`
🚀 Cleaning Calculator Server running on port ${PORT}
📊 API endpoints:
   - GET  /api/health
   - POST /api/fetch-ical
📁 Static files served from ./public/
  `);
});

module.exports = app;