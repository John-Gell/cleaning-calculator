const { useState, useCallback } = React;

const AirbnbCleaningCalculator = () => {
  const [listings, setListings] = useState([
    { id: 1, name: '', rate: 0, icalUrl: '', events: [] }
  ]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const addListing = () => {
    setListings([...listings, { 
      id: Date.now(), 
      name: '', 
      rate: 0, 
      icalUrl: '',
      events: []
    }]);
  };

  const updateListing = (id, field, value) => {
    setListings(listings.map(listing => 
      listing.id === id ? { ...listing, [field]: value } : listing
    ));
  };

  const removeListing = (id) => {
    setListings(listings.filter(listing => listing.id !== id));
  };

  const fetchICalData = async (listings) => {
    try {
      const urls = listings
        .filter(listing => listing.icalUrl && listing.name && listing.rate)
        .map(listing => ({
          url: listing.icalUrl,
          listingId: listing.id,
          listingName: listing.name
        }));

      if (urls.length === 0) {
        throw new Error('No valid listings with iCal URLs configured');
      }

      const response = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch iCal data');
      }

      const data = await response.json();
      return data.results;
    } catch (error) {
      console.error('Error fetching iCal data:', error);
      throw error;
    }
  };

  const calculateCleanings = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      // Fetch all iCal data from backend
      const icalResults = await fetchICalData(listings);
      
      let allCleanings = [];
      let errors = [];
      
      for (let result of icalResults) {
        if (!result.success) {
          errors.push(`${result.listingName}: ${result.error}`);
          continue;
        }
        
        const listing = listings.find(l => l.id === result.listingId);
        if (!listing) continue;
        
        // Filter events that end in the selected month
        const monthlyEvents = result.events.filter(event => {
          const eventEndDate = new Date(event.dtend);
          return eventEndDate >= startDate && eventEndDate <= endDate;
        });
        
        // Convert to cleaning records
const cleanings = monthlyEvents.map(event => ({
  listingName: result.listingName,
  cleaningDate: new Date(event.dtend),
  guestName: event.summary.replace(/^(Booking|Reservation|Stay)\s*-?\s*/i, '').trim(),
  amount: listing.rate,
  bookingId: event.uid || `${event.dtstart}-${event.dtend}`
}));
        
        allCleanings = [...allCleanings, ...cleanings];
      }
      
      // Show errors if any
      if (errors.length > 0) {
        console.warn('Some iCal feeds failed to load:', errors);
      }
      
      // Sort by date
      allCleanings.sort((a, b) => new Date(a.cleaningDate) - new Date(b.cleaningDate));
      
      const totalAmount = allCleanings.reduce((sum, cleaning) => sum + cleaning.amount, 0);
      
      setResults({
        cleanings: allCleanings,
        totalAmount,
        dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        month: selectedMonth,
        errors: errors.length > 0 ? errors : null
      });
    } catch (error) {
      console.error('Error calculating cleanings:', error);
      setResults({
        cleanings: [],
        totalAmount: 0,
        dateRange: '',
        month: selectedMonth,
        errors: [error.message]
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return React.createElement('div', { className: "max-w-6xl mx-auto p-6 bg-white min-h-screen" },
    // Header
    React.createElement('div', { className: "mb-8" },
      React.createElement('h1', { className: "text-3xl font-bold text-gray-900 mb-2" }, 'Airbnb Cleaning Calculator'),
      React.createElement('p', { className: "text-gray-600" }, 'Automate your monthly cleaning calculations from iCal feeds')
    ),

    // Configuration Panel
    React.createElement('div', { className: "bg-gray-50 rounded-lg p-6 mb-8" },
      React.createElement('h2', { className: "text-xl font-semibold mb-4" }, 'Listing Configuration'),
      
      ...listings.map((listing, index) =>
        React.createElement('div', { key: listing.id, className: "bg-white rounded-lg p-4 mb-4 border" },
          React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 'Listing Name'),
              React.createElement('input', {
                type: 'text',
                value: listing.name,
                onChange: (e) => updateListing(listing.id, 'name', e.target.value),
                placeholder: 'Downtown Apartment',
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 'Cleaning Rate ($)'),
              React.createElement('input', {
                type: 'number',
                value: listing.rate || '',
                onChange: (e) => updateListing(listing.id, 'rate', parseFloat(e.target.value) || 0),
                placeholder: '75',
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 'iCal URL'),
              React.createElement('input', {
                type: 'url',
                value: listing.icalUrl,
                onChange: (e) => updateListing(listing.id, 'icalUrl', e.target.value),
                placeholder: 'https://airbnb.com/calendar/ical/...',
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              })
            ),
            React.createElement('div', { className: "flex items-end" },
              listings.length > 1 && React.createElement('button', {
                onClick: () => removeListing(listing.id),
                className: "px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 mr-2"
              }, 'Remove')
            )
          )
        )
      ),
      
      React.createElement('button', {
        onClick: addListing,
        className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      }, 'Add Listing')
    ),

    // Month Selection and Calculate
    React.createElement('div', { className: "bg-gray-50 rounded-lg p-6 mb-8" },
      React.createElement('div', { className: "flex flex-col sm:flex-row items-center gap-4" },
        React.createElement('div', { className: "flex items-center" },
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mr-3" }, 'Calculate for Month:'),
          React.createElement('input', {
            type: 'month',
            value: selectedMonth,
            onChange: (e) => setSelectedMonth(e.target.value),
            className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          })
        ),
        
        React.createElement('button', {
          onClick: calculateCleanings,
          disabled: loading || listings.every(l => !l.name || !l.rate),
          className: "px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        }, loading ? 'Calculating...' : 'Calculate Cleanings')
      )
    ),

    // Results
    results && React.createElement('div', { className: "bg-white border rounded-lg overflow-hidden shadow-lg", id: "cleaning-report" },
      React.createElement('div', { className: "bg-gray-900 text-white p-6" },
        React.createElement('h2', { className: "text-2xl font-bold mb-2" }, 'Cleaning Report'),
        React.createElement('p', { className: "text-gray-300" }, `Period: ${results.dateRange}`)
      ),
      
      React.createElement('div', { className: "p-6" },
        results.errors && results.errors.length > 0 && React.createElement('div', { className: "mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded" },
          React.createElement('h4', { className: "font-semibold text-red-800 mb-2" }, 'Errors Loading Some Calendars:'),
          React.createElement('ul', { className: "text-red-700 text-sm space-y-1" },
            ...results.errors.map((error, index) =>
              React.createElement('li', { key: index }, `• ${error}`)
            )
          )
        ),
        
        results.cleanings.length === 0 ? 
          React.createElement('p', { className: "text-gray-500 text-center py-8" }, 'No cleanings found for the selected period.') :
          React.createElement('div', null,
            React.createElement('div', { className: "overflow-x-auto" },
              React.createElement('table', { className: "w-full border-collapse" },
                React.createElement('thead', null,
                  React.createElement('tr', { className: "border-b-2 border-gray-200" },
                    React.createElement('th', { className: "text-left py-3 px-4 font-semibold text-gray-700" }, 'Date'),
                    React.createElement('th', { className: "text-left py-3 px-4 font-semibold text-gray-700" }, 'Listing'),
                    React.createElement('th', { className: "text-left py-3 px-4 font-semibold text-gray-700" }, 'Guest'),
                    React.createElement('th', { className: "text-right py-3 px-4 font-semibold text-gray-700" }, 'Amount')
                  )
                ),
                React.createElement('tbody', null,
                  ...results.cleanings.map((cleaning, index) =>
                    React.createElement('tr', { key: index, className: "border-b border-gray-100 hover:bg-gray-50" },
                      React.createElement('td', { className: "py-3 px-4 text-gray-900" }, 
                        cleaning.cleaningDate.toLocaleDateString()
                      ),
                      React.createElement('td', { className: "py-3 px-4 text-gray-900 font-medium" }, 
                        cleaning.listingName
                      ),
                      React.createElement('td', { className: "py-3 px-4 text-gray-600" }, 
                        cleaning.guestName
                      ),
                      React.createElement('td', { className: "py-3 px-4 text-right text-gray-900 font-medium" }, 
                        formatCurrency(cleaning.amount)
                      )
                    )
                  )
                )
              )
            ),
            
            React.createElement('div', { className: "mt-6 pt-4 border-t-2 border-gray-200" },
              React.createElement('div', { className: "flex justify-between items-center" },
                React.createElement('span', { className: "text-lg font-semibold text-gray-700" },
                  `Total Cleanings: ${results.cleanings.length}`
                ),
                React.createElement('span', { className: "text-2xl font-bold text-green-600" },
                  `Total: ${formatCurrency(results.totalAmount)}`
                )
              )
            )
          )
      )
    ),

    // Instructions
    React.createElement('div', { className: "mt-8 bg-blue-50 rounded-lg p-6" },
      React.createElement('h3', { className: "text-lg font-semibold text-blue-900 mb-3" }, 'Usage Instructions'),
      React.createElement('div', { className: "text-blue-800 space-y-2" },
        React.createElement('p', null, '1. Configure each listing with its name, cleaning rate, and iCal URL'),
        React.createElement('p', null, '2. Select the month you want to calculate cleanings for'),
        React.createElement('p', null, '3. Click "Calculate Cleanings" to process all bookings'),
        React.createElement('p', null, '4. The report shows checkout dates (when cleaning occurs) and totals'),
        React.createElement('p', null, '5. Take a screenshot of the report for your records')
      ),
      
      React.createElement('div', { className: "mt-4 p-3 bg-blue-100 border-l-4 border-blue-500" },
        React.createElement('p', { className: "text-blue-800 text-sm" },
          React.createElement('strong', null, 'Production Ready: '),
          'This version uses a backend server to fetch iCal data, eliminating CORS restrictions. The app is now running locally and ready for deployment.'
        )
      )
    )
  );
};

// Render the app
ReactDOM.render(React.createElement(AirbnbCleaningCalculator), document.getElementById('root'));