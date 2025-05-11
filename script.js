// --- CONFIGURATION ---
const WINDY_API_KEY = 'YOUR_WINDY_API_KEY_HERE'; // Replace if using Windy
const USE_OPEN_METEO_FALLBACK = true; // True uses Open-Meteo if Windy key is placeholder or Windy fails

const TARGET_LAT = 40.6721;
const TARGET_LON = -74.0399;

const NOAA_STATIONS = {
    BATTERY_TIDES_WATER_TEMP: '8518750',
    ROBBINS_REEF_WIND: '8530973',
    NY_HARBOR_CURRENTS: 'n05010_6', 
    CURRENTS_BIN: '6' 
};

const NOAA_API_APP_NAME = 'NYCHarborSailingApp/1.0 (yourname@example.com)'; // Replace with your details

// --- UTILITY FUNCTIONS ---
function updateTextContent(elementId, text, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = (text !== undefined && text !== null && String(text).trim() !== '') ? String(text) : '--';
        if (isError) {
            element.classList.add('error-message');
        } else {
            element.classList.remove('error-message');
        }
    } else {
        console.warn(`Element with ID "${elementId}" not found.`);
    }
}

function formatTime(dateInput, timeZone = 'America/New_York') {
    if (!dateInput) return '--';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(date.getTime())) throw new Error("Invalid date object for time formatting: " + dateInput);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timeZone });
    } catch (e) {
        console.error("Error formatting time:", e.message, "Input:", dateInput);
        return '--';
    }
}

function formatDateUserFriendly(dateInput, timeZone = 'America/New_York') {
    if (!dateInput) return '--';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
         if (isNaN(date.getTime())) throw new Error("Invalid date object for date formatting: " + dateInput);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timeZone });
    } catch (e) {
        console.error("Error formatting date:", e.message, "Input:", dateInput);
        return '--';
    }
}

function degreesToCardinal(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return '--';
    const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N'];
    return cardinals[Math.round(parseFloat(deg) / 22.5) % 16]; 
}

// --- DATA FETCHING AND DISPLAY FUNCTIONS ---

// 1. Water Temperature
async function fetchWaterTemperature() {
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=<span class="math-inline">\{NOAA\_STATIONS\.BATTERY\_TIDES\_WATER\_TEMP\}&product\=water\_temperature&datum\=MLLW&units\=english&time\_zone\=lst\_ldt&format\=json&application\=</span>{encodeURIComponent(NOAA_API_APP_NAME)}`;
    console.log("Fetching Water Temp from:", url);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Water Temp. URL: ${url}`);
        const jsonData = await response.json();
        if (jsonData.data && jsonData.data.length > 0) {
            const waterTemp = parseFloat(jsonData.data[0].v).toFixed(1);
            updateTextContent('water-temp', waterTemp);
        } else {
            updateTextContent('water-temp', 'N/A');
        }
    } catch (error) {
        console.error("Error fetching water temperature:", error);
        updateTextContent('water-temp', 'Error', true);
    }
}

// 2. Tidal Information
async function fetchTidalPredictions() {
    let startDate = new Date(); startDate.setDate(startDate.getDate() - 1);
    let endDate = new Date(); endDate.setDate(endDate.getDate() + 2);
    const begin_date_str = `<span class="math-inline">\{startDate\.getFullYear\(\)\}</span>{('0' + (startDate.getMonth() + 1)).slice(-2)}${('0' + startDate.getDate()).slice(-2)}`;
    const end_date_str = `<span class="math-inline">\{endDate\.getFullYear\(\)\}</span>{('0' + (endDate.getMonth() + 1)).slice(-2)}${('0' + endDate.getDate()).slice(-2)}`;
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=<span class="math-inline">\{begin\_date\_str\}&end\_date\=</span>{end_date_str}&station=<span class="math-inline">\{NOAA\_STATIONS\.BATTERY\_TIDES\_WATER\_TEMP\}&product\=predictions&datum\=MLLW&units\=english&time\_zone\=lst\_ldt&format\=json&application\=</span>{encodeURIComponent(NOAA_API_APP_NAME)}`;
    console.log("Fetching Tidal Predictions from:", url);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Tides. URL: ${url}`);
        const jsonData = await response.json();
        // Log raw data before checking if predictions exist
        console.log("Raw NOAA Tide Predictions JSON:", JSON.stringify(jsonData, null, 2)); 
        
        if (jsonData.predictions && jsonData.predictions.length > 0) {
            processAndDisplayTides(jsonData.predictions);
        } else {
            console.warn("No tide predictions found in NOAA response or predictions array is empty.");
            ['tide-current-status', 'last-tide', 'next-tide', 'following-tide', 'summary-tidal-flow', 'summary-next-tide'].forEach(id => updateTextContent(id, 'N/A'));
        }
    } catch (error) {
        console.error("Error fetching tidal predictions:", error);
        ['tide-current-status', 'last-tide', 'next-tide', 'following-tide', 'summary-tidal-flow', 'summary-next-tide'].forEach(id => updateTextContent(id, 'Error', true));
    }
}

function processAndDisplayTides(predictions) {
    const now = new Date();
    let pTide = null; 
    let nTide = null; 
    let fTide = null; 

    const parsedPredictions = predictions.map(p => ({
        time: new Date(p.t),
        type: p.type, 
        value: parseFloat(p.v).toFixed(2)
    })).sort((a, b) => a.time - b.time);
    
    console.log("Parsed and Sorted Tide Predictions for UI:", 
        JSON.stringify(parsedPredictions.map(p => ({time: p.time.toISOString(), type: p.type, value: p.value})), null, 2)
    );

    // Find pTide: the last tide event strictly BEFORE 'now'
    const pastTides = parsedPredictions.filter(p => p.time < now);
    if (pastTides.length > 0) {
        pTide = pastTides[pastTides.length - 1]; 
    }

    // Find nTide: the first tide event AT or AFTER 'now'
    const futureTides = parsedPredictions.filter(p => p.time >= now);
    if (futureTides.length > 0) {
        nTide = futureTides[0]; 

        // Find fTide: the first tide in futureTides *after* nTide that has a DIFFERENT type
        for (let i = 1; i < futureTides.length; i++) {
            if (futureTides[i].type !== nTide.type) {
                fTide = futureTides[i];
                break; 
            }
        }
         // If fTide wasn't found (e.g., all remaining futureTides are same type as nTide, or only nTide is left)
        // and there's at least one more tide after nTide in the original parsed list, take it directly.
        // This covers the case where the *very next* tide is the one we want for fTide, regardless of type logic if data is clean.
        if (!fTide && futureTides.length > 1) {
             const nTideOriginalIndex = parsedPredictions.findIndex(p => p.time.getTime() === nTide.time.getTime());
             if (nTideOriginalIndex !== -1 && nTideOriginalIndex + 1 < parsedPredictions.length) {
                fTide = parsedPredictions[nTideOriginalIndex+1];
             }
        }
    }
    
    // Special handling if pTide is not found but nTide is (i.e., 'now' is before the first fetched tide)
    // Try to find a suitable pTide by looking backwards from nTide in the full parsedPredictions list
    if (!pTide && nTide) {
        const nTideIndex = parsedPredictions.findIndex(p => p.time.getTime() === nTide.time.getTime());
        if (nTideIndex > 0) {
            // Look for the first tide before nTide that is of a different type
            // This is a fallback, ideally the initial pastTides filter handles it.
            let foundAltPrevious = false;
            for (let i = nTideIndex - 1; i >= 0; i--) {
                if (parsedPredictions[i].type !== nTide.type) {
                    pTide = parsedPredictions[i];
                    foundAltPrevious = true;
                    break;
                }
            }
            if (!foundAltPrevious) { // If all previous are same type (unlikely), just take immediate previous
                pTide = parsedPredictions[nTide
