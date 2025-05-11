// --- CONFIGURATION ---
// IMPORTANT: REPLACE 'YOUR_WINDY_API_KEY_HERE' with your actual Windy API key
// If you don't have one, get it from https://api.windy.com or set USE_OPEN_METEO_FALLBACK to true
const WINDY_API_KEY = 'YOUR_WINDY_API_KEY_HERE';
const USE_OPEN_METEO_FALLBACK = true; // Set to true if you don't have/want to use a Windy key, or if Windy fails

const TARGET_LAT = 40.6721;
const TARGET_LON = -74.0399;

const NOAA_STATIONS = {
    BATTERY_TIDES_WATER_TEMP: '8518750',
    ROBBINS_REEF_WIND: '8530973',
    NY_HARBOR_CURRENTS: 'n05010', // Station ID for Gowanus Flats area for currents
    CURRENTS_BIN: '6' // Specific bin for the currents station (e.g., '6' for 28ft depth)
};

// Be a good internet citizen: replace with your app name or domain if you deploy this publicly
const NOAA_API_APP_NAME = 'NYCHarborSailingConditionsApp/1.0 (yourname@example.com)';

// --- UTILITY FUNCTIONS ---
function updateTextContent(elementId, text, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = (text !== undefined && text !== null && text !== '') ? text : '--';
        if (isError) {
            element.classList.add('error-message');
        } else {
            element.classList.remove('error-message');
        }
    } else {
        console.warn(`Element with ID "${elementId}" not found.`);
    }
}

function formatTime(dateStringOrObject, timeZone = 'America/New_York') {
    if (!dateStringOrObject) return '--';
    try {
        const date = typeof dateStringOrObject === 'string' ? new Date(dateStringOrObject) : dateStringOrObject;
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timeZone });
    } catch (e) {
        console.error("Error formatting time:", e, "Input:", dateStringOrObject);
        return '--';
    }
}

function formatDateUserFriendly(dateStringOrObject, timeZone = 'America/New_York') {
     if (!dateStringOrObject) return '--';
    try {
        const date = typeof dateStringOrObject === 'string' ? new Date(dateStringOrObject) : dateStringOrObject;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timeZone });
    } catch (e) {
        console.error("Error formatting date:", e, "Input:", dateStringOrObject);
        return '--';
    }
}

function degreesToCardinal(deg) {
    if (deg === null || deg === undefined) return '--';
    const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N'];
    return cardinals[Math.round(deg / 22.5)];
}


// --- DATA FETCHING AND DISPLAY FUNCTIONS ---

// 1. Water Temperature
async function fetchWaterTemperature() {
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${NOAA_STATIONS.BATTERY_TIDES_WATER_TEMP}&product=water_temperature&datum=MLLW&units=english&time_zone=lst_ldt&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Water Temp`);
        const jsonData = await response.json();
        if (jsonData.data && jsonData.data.length > 0) {
            const waterTemp = parseFloat(jsonData.data[0].v).toFixed(1);
            updateTextContent('water-temp', waterTemp);
        } else {
            updateTextContent('water-temp', 'N/A');
        }
    } catch (error) {
        console.error("Error fetching water temperature:", error);
        updateTextContent('water-temp', 'Error loading data', true);
    }
}

// 2. Tidal Information
async function fetchTidalPredictions() {
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // yesterday
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + 2);   // day after tomorrow

    const begin_date_str = `${startDate.getFullYear()}${('0' + (startDate.getMonth() + 1)).slice(-2)}${('0' + startDate.getDate()).slice(-2)}`;
    const end_date_str = `${endDate.getFullYear()}${('0' + (endDate.getMonth() + 1)).slice(-2)}${('0' + endDate.getDate()).slice(-2)}`;

    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${begin_date_str}&end_date=${end_date_str}&station=${NOAA_STATIONS.BATTERY_TIDES_WATER_TEMP}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Tides`);
        const jsonData = await response.json();
        if (jsonData.predictions && jsonData.predictions.length > 0) {
            processAndDisplayTides(jsonData.predictions);
        } else {
            ['tide-current-status', 'last-tide', 'next-tide', 'following-tide', 'summary-tidal-flow', 'summary-next-tide'].forEach(id => updateTextContent(id, 'N/A'));
        }
    } catch (error) {
        console.error("Error fetching tidal predictions:", error);
        ['tide-current-status', 'last-tide', 'next-tide', 'following-tide', 'summary-tidal-flow', 'summary-next-tide'].forEach(id => updateTextContent(id, 'Error loading data', true));
    }
}

function processAndDisplayTides(predictions) {
    const now = new Date();
    let lastTide = null;
    let nextTide = null;
    let followingTide = null;

    // Convert prediction times to Date objects for comparison
    const parsedPredictions = predictions.map(p => ({
        time: new Date(p.t), // Format: "YYYY-MM-DD HH:MM"
        type: p.type, // "H" or "L"
        value: parseFloat(p.v).toFixed(2)
    })).sort((a, b) => a.time - b.time); // Ensure they are sorted by time

    for (let i = 0; i < parsedPredictions.length; i++) {
        if (parsedPredictions[i].time < now) {
            lastTide = parsedPredictions[i];
        } else if (!nextTide) {
            nextTide = parsedPredictions[i];
            if (i + 1 < parsedPredictions.length) {
                followingTide = parsedPredictions[i+1];
            }
            break; 
        }
    }
    
    // Fallback if 'now' is before the first prediction or after the last
    if (!nextTide && parsedPredictions.length > 0) { // If now is after all predictions
        lastTide = parsedPredictions[parsedPredictions.length -1];
        // Attempt to find next from earlier data if possible, or mark as N/A
    }
    if (!lastTide && nextTide) { // If now is before all predictions
        // This case implies 'lastTide' needs to be from even earlier data not fetched, or N/A
    }


    let currentStatus = "Approaching Slack";
    let summaryTidalFlow = "Calculating...";

    if (lastTide && nextTide) {
        if (nextTide.type === "H") {
            currentStatus = "Flooding (Rising)";
            summaryTidalFlow = "Flooding";
        } else if (nextTide.type === "L") {
            currentStatus = "Ebbing (Falling)";
            summaryTidalFlow = "Ebbing";
        }

        // Check for slack (approximate: within ~30 mins of a tide event)
        const timeToNextTide = (nextTide.time - now) / (1000 * 60); // in minutes
        const timeFromLastTide = (now - lastTide.time) / (1000 * 60); // in minutes

        if (timeToNextTide <= 30 || timeFromLastTide <= 30) {
            currentStatus = `Slack, turning towards ${nextTide.type === "H" ? "High" : "Low"}`;
            summaryTidalFlow = `Slack near ${lastTide.type === "H" ? "High" : "Low"}`;
        }
    } else {
        currentStatus = "Tide data incomplete";
        summaryTidalFlow = "Tide data incomplete";
    }
    

    updateTextContent('tide-current-status', currentStatus);
    updateTextContent('summary-tidal-flow', summaryTidalFlow);

    if (lastTide) {
        updateTextContent('last-tide', `${lastTide.type === "H" ? "High" : "Low"} at ${formatTime(lastTide.time)} (${lastTide.value} ft)`);
    } else {
        updateTextContent('last-tide', 'N/A (data range)');
    }

    if (nextTide) {
        updateTextContent('next-tide', `${nextTide.type === "H" ? "High" : "Low"} at ${formatTime(nextTide.time)} (${nextTide.value} ft)`);
        updateTextContent('summary-next-tide', `${nextTide.type === "H" ? "High" : "Low"} at ${formatTime(nextTide.time)}`);
    } else {
        updateTextContent('next-tide', 'N/A (data range)');
        updateTextContent('summary-next-tide', 'N/A');
    }
    
    if (followingTide) {
        updateTextContent('following-tide', `${followingTide.type === "H" ? "High" : "Low"} at ${formatTime(followingTide.time)} (${followingTide.value} ft)`);
    } else {
        updateTextContent('following-tide', 'N/A (data range)');
    }
}


// 3. Current Estimate
async function fetchCurrentData() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${('0' + (today.getMonth() + 1)).slice(-2)}${('0' + today.getDate()).slice(-2)}`;
    
    // This URL structure is based on direct NOAA currents portal inspection
    const url = `https://api.tidesandcurrents.noaa.gov/currents/data/${NOAA_STATIONS.NY_HARBOR_CURRENTS}?bin=${NOAA_STATIONS.CURRENTS_BIN}&date=${dateStr}&units=english&time_zone=LST_LDT&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Currents`);
        const jsonData = await response.json();

        if (jsonData.data && jsonData.data.length > 0) {
            // Find the prediction closest to the current time
            const now = new Date();
            let closestPrediction = jsonData.data[0];
            let minDiff = Math.abs(now - new Date(closestPrediction.Time));

            for (let i = 1; i < jsonData.data.length; i++) {
                const predTime = new Date(jsonData.data[i].Time);
                const diff = Math.abs(now - predTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPrediction = jsonData.data[i];
                }
            }
            
            const speed = parseFloat(closestPrediction.Speed).toFixed(1);
            const direction = parseFloat(closestPrediction.Dir).toFixed(0);
            const directionType = parseFloat(closestPrediction.Speed) > 0 ? "Flood" : (parseFloat(closestPrediction.Speed) < 0 ? "Ebb" : "Slack");

            updateTextContent('current-time-prediction', formatTime(closestPrediction.Time));
            updateTextContent('current-speed', `${Math.abs(speed)}`); // Show absolute speed
            updateTextContent('current-direction', `${direction}° (${degreesToCardinal(direction)})`);
            updateTextContent('current-direction-type', directionType);

        } else {
            ['current-time-prediction', 'current-speed', 'current-direction', 'current-direction-type'].forEach(id => updateTextContent(id, 'N/A'));
        }
    } catch (error) {
        console.error("Error fetching current data:", error);
        ['current-time-prediction', 'current-speed', 'current-direction', 'current-direction-type'].forEach(id => updateTextContent(id, 'Error loading data', true));
    }
}


// 4. Real-time Wind (Robbins Reef)
async function fetchRealtimeWind() {
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${NOAA_STATIONS.ROBBINS_REEF_WIND}&product=wind&units=english&time_zone=lst_ldt&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Realtime Wind`);
        const jsonData = await response.json();

        if (jsonData.data && jsonData.data.length > 0) {
            const windData = jsonData.data[0];
            const speed = parseFloat(windData.s).toFixed(1);
            const gusts = parseFloat(windData.g).toFixed(1);
            const direction = parseFloat(windData.d).toFixed(0);
            const time = formatTime(windData.t);

            updateTextContent('robbins-wind-speed', speed);
            updateTextContent('robbins-wind-gusts', gusts === '0.0' ? 'N/A' : gusts); // NOAA often reports 0.0 for no gusts
            updateTextContent('robbins-wind-direction', direction);
            updateTextContent('robbins-wind-cardinal', degreesToCardinal(direction));
            updateTextContent('robbins-wind-time', time);

            updateTextContent('summary-realtime-wind', `${speed} kts from ${degreesToCardinal(direction)} (gusts ${gusts === '0.0' ? 'N/A' : gusts} kts)`);
        } else {
            ['robbins-wind-speed', 'robbins-wind-gusts', 'robbins-wind-direction', 'robbins-wind-cardinal', 'robbins-wind-time', 'summary-realtime-wind'].forEach(id => updateTextContent(id, 'N/A'));
        }
    } catch (error) {
        console.error("Error fetching real-time wind:", error);
        ['robbins-wind-speed', 'robbins-wind-gusts', 'robbins-wind-direction', 'robbins-wind-cardinal', 'robbins-wind-time', 'summary-realtime-wind'].forEach(id => updateTextContent(id, 'Error loading data', true));
    }
}

// 5. Wind Forecast
async function fetchWindForecast() {
    let windyAttempted = false;
    // Try Windy first if API key is provided
    if (WINDY_API_KEY && WINDY_API_KEY !== 'YOUR_WINDY_API_KEY_HERE') {
        windyAttempted = true;
        const windyUrl = `https://api.windy.com/api/point-forecast/v2/json?lat=${TARGET_LAT}&lon=${TARGET_LON}&model=gfs&parameters=wind,gust&key=${WINDY_API_KEY}`;
        // Note: Windy's "wind" parameter often returns an object with u-wind and v-wind components.
        // You might need a different parameter or to calculate speed/direction.
        // For simplicity, I'll assume 'wind_speed-surface' and 'wind_direction-surface', 'wind_gust-surface' might be available with some models or specific parameter requests.
        // Let's try a common structure, but this might need adjustment based on Windy's exact API response for the "parameters=wind,gust"
        // A better request for Windy might be specifying exact parameters like:
        // parameters=wind_u,wind_v,gust (then calculate speed and direction)
        // OR parameters=windspeed,winddirection,gust if the model supports it directly.
        // For this example, I'll proceed assuming a simplified response for wind speed, direction, and gust.

        // Simpler Windy request focusing on GFS model which usually has direct outputs.
        // Check Windy API documentation for precise parameter names for wind speed, direction, gusts.
        // Example: `https://api.windy.com/api/point-forecast/v2?lat=${TARGET_LAT}&lon=${TARGET_LON}&model=gfs&parameters=wind,gusts&levels=surface&key=${WINDY_API_KEY}`
        // The response structure from Windy needs to be handled carefully.
        // For now, I'll use Open-Meteo as it's more predictable without an API key and direct for this example.
        // If you want to use Windy, you'll need to inspect its JSON output and adjust parsing logic.
        // The following is a placeholder for Windy logic:
        /* try {
            const response = await fetch(windyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} from Windy`);
            const jsonData = await response.json();
            // ---- IMPORTANT: PARSING LOGIC FOR WINDY ----
            // This part is highly dependent on the actual JSON structure returned by Windy API
            // For example, if it returns arrays for 'wind_speed-surface', 'wind_direction-surface', 'gust-surface':
            // const hours = jsonData.ts; // Timestamps
            // const windSpeeds = jsonData['wind_speed-surface']; 
            // const windDirections = jsonData['wind_direction-surface'];
            // const windGusts = jsonData['gust-surface'];
            // processAndDisplayWindForecast(hours, windSpeeds, windDirections, windGusts, "Windy.com");
            // For now, we'll bypass this detailed parsing and show a message.
            console.log("Windy JSON Data:", jsonData); // Log to see structure
            updateTextContent('wind-forecast-hourly', "Windy data received. Parsing logic needs to be implemented based on its structure.", true);
            // Assume you have a function to display this data similar to Open-Meteo one.
            // For the summary section:
            // updateTextContent('summary-current-wind-forecast', `[Windy Speed] kts from [Windy Dir] (gusts [Windy Gust])`);
            return; // Exit if Windy succeeded
        } catch (error) {
            console.error("Error fetching Wind Forecast from Windy:", error);
            if (!USE_OPEN_METEO_FALLBACK) {
                 updateTextContent('wind-forecast-hourly', 'Error loading Windy forecast.', true);
                 updateTextContent('summary-current-wind-forecast', 'Error');
                 return;
            }
            console.log("Falling back to Open-Meteo for wind forecast.");
        }
        */
    }

    // Fallback to Open-Meteo or if Windy is not configured/fails
    if (USE_OPEN_METEO_FALLBACK || !windyAttempted || (windyAttempted && USE_OPEN_METEO_FALLBACK)) {
        // Using knots for windspeed (windspeed_unit=kn)
        // Added temperature_2m for illustration if needed later, remove if not.
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${TARGET_LAT}&longitude=${TARGET_LON}&hourly=windspeed_10m,winddirection_10m,windgusts_10m&windspeed_unit=kn&timeformat=iso8601&timezone=America/New_York&forecast_days=3`;
        try {
            const response = await fetch(openMeteoUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} from Open-Meteo`);
            const jsonData = await response.json();
            
            if (jsonData.hourly && jsonData.hourly.time) {
                processAndDisplayOpenMeteoForecast(jsonData.hourly, "Open-Meteo");
            } else {
                updateTextContent('wind-forecast-hourly', 'No Open-Meteo forecast data available.', true);
                 updateTextContent('summary-current-wind-forecast', 'N/A');
            }
        } catch (error) {
            console.error("Error fetching Wind Forecast from Open-Meteo:", error);
            updateTextContent('wind-forecast-hourly', 'Error loading forecast data.', true);
            updateTextContent('summary-current-wind-forecast', 'Error');
        }
    }
}

function processAndDisplayOpenMeteoForecast(hourlyData, source) {
    const forecastContainer = document.getElementById('wind-forecast-hourly');
    forecastContainer.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    thead.innerHTML = `
        <tr>
            <th>Time (${formatDateUserFriendly(new Date(hourlyData.time[0]))})</th>
            <th>Wind (kts)</th>
            <th>Gusts (kts)</th>
            <th>Direction</th>
        </tr>
    `;
    table.appendChild(thead);

    const now = new Date();
    let currentHourForecastSet = false;

    // Display for next 24-48 hours, or as available
    const displayHours = Math.min(hourlyData.time.length, 48); 

    for (let i = 0; i < displayHours; i++) {
        const time = new Date(hourlyData.time[i]);
        const speed = hourlyData.windspeed_10m[i].toFixed(1);
        const direction = hourlyData.winddirection_10m[i].toFixed(0);
        const gusts = hourlyData.windgusts_10m[i].toFixed(1);

        const row = tbody.insertRow();
        row.insertCell().textContent = formatTime(time);
        row.insertCell().textContent = speed;
        row.insertCell().textContent = gusts;
        row.insertCell().textContent = `${direction}° (${degreesToCardinal(direction)})`;

        // Update summary for the current or next closest hour
        if (!currentHourForecastSet && time >= now) {
            updateTextContent('summary-current-wind-forecast', `${speed} kts from ${degreesToCardinal(direction)} (gusts ${gusts} kts)`);
            currentHourForecastSet = true;
        }
    }
    table.appendChild(tbody);
    forecastContainer.appendChild(table);
    const attribution = document.createElement('p');
    attribution.innerHTML = `<small>Forecast from ${source}. Displaying next ~${displayHours / 24} days.</small>`;
    forecastContainer.appendChild(attribution);

    if (!currentHourForecastSet && hourlyData.time.length > 0) { // If all times are in the past, show the last one
        const lastIdx = hourlyData.time.length -1;
        const speed = hourlyData.windspeed_10m[lastIdx].toFixed(1);
        const direction = hourlyData.winddirection_10m[lastIdx].toFixed(0);
        const gusts = hourlyData.windgusts_10m[lastIdx].toFixed(1);
        updateTextContent('summary-current-wind-forecast', `(Past) ${speed} kts from ${degreesToCardinal(direction)} (gusts ${gusts} kts)`);
    }
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    updateTextContent('last-updated', `${formatDateUserFriendly(now)} ${formatTime(now)}`);
    updateTextContent('current-year', now.getFullYear());

    const latLonText = `(${TARGET_LAT.toFixed(4)}° N, ${TARGET_LON.toFixed(4)}° W)`;
    updateTextContent('current-lat-lon-header', latLonText);
    updateTextContent('current-lat-lon-body', latLonText);
    updateTextContent('forecast-lat-lon-body', latLonText);

    // Fetch all data
    fetchWaterTemperature();
    fetchTidalPredictions();
    fetchCurrentData();
    fetchRealtimeWind();
    fetchWindForecast(); 

    // Auto-refresh data every 15 minutes (900000 milliseconds)
    setInterval(() => {
        const nowRefresh = new Date();
        updateTextContent('last-updated', `${formatDateUserFriendly(nowRefresh)} ${formatTime(nowRefresh)}`);
        fetchWaterTemperature();
        fetchTidalPredictions();
        fetchCurrentData();
        fetchRealtimeWind();
        fetchWindForecast();
    }, 900000);
});
