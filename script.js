// --- CONFIGURATION ---
const WINDY_API_KEY = 'YOUR_WINDY_API_KEY_HERE'; // Replace if using Windy
const USE_OPEN_METEO_FALLBACK = true; // True uses Open-Meteo if Windy key is placeholder or Windy fails

const TARGET_LAT = 40.6721;
const TARGET_LON = -74.0399;

const NOAA_STATIONS = {
    BATTERY_TIDES_WATER_TEMP: '8518750',
    ROBBINS_REEF_WIND: '8530973',
    NY_HARBOR_CURRENTS: 'n05010_6', // Using the specific station ID for Gowanus Flats area
    CURRENTS_BIN: '6' // Specific bin for the currents station (e.g., '6' for depth 28ft)
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
        if (isNaN(date.getTime())) throw new Error("Invalid date object for time formatting");
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timeZone });
    } catch (e) {
        console.error("Error formatting time:", e, "Input:", dateInput);
        return '--';
    }
}

function formatDateUserFriendly(dateInput, timeZone = 'America/New_York') {
    if (!dateInput) return '--';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
         if (isNaN(date.getTime())) throw new Error("Invalid date object for date formatting");
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timeZone });
    } catch (e) {
        console.error("Error formatting date:", e, "Input:", dateInput);
        return '--';
    }
}

function degreesToCardinal(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return '--';
    const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N'];
    return cardinals[Math.round(parseFloat(deg) / 22.5) % 16]; // Ensure it wraps correctly
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
        updateTextContent('water-temp', 'Error', true);
    }
}

// 2. Tidal Information
async function fetchTidalPredictions() {
    let startDate = new Date(); startDate.setDate(startDate.getDate() - 1);
    let endDate = new Date(); endDate.setDate(endDate.getDate() + 2);
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
        ['tide-current-status', 'last-tide', 'next-tide', 'following-tide', 'summary-tidal-flow', 'summary-next-tide'].forEach(id => updateTextContent(id, 'Error', true));
    }
}

function processAndDisplayTides(predictions) {
    const now = new Date();
    let previousTide = null;
    let nextTide = null;
    let followingTide = null;

    const parsedPredictions = predictions.map(p => ({
        time: new Date(p.t), 
        type: p.type, 
        value: parseFloat(p.v).toFixed(2)
    })).sort((a, b) => a.time - b.time);

    let foundNextTide = false;
    for (let i = 0; i < parsedPredictions.length; i++) {
        const currentPrediction = parsedPredictions[i];
        if (currentPrediction.time < now) {
            previousTide = currentPrediction; 
        } else if (!foundNextTide) {
            nextTide = currentPrediction;
            foundNextTide = true;
            if (i + 1 < parsedPredictions.length) {
                followingTide = parsedPredictions[i+1];
            }
        }
        if (foundNextTide && followingTide) break; // Optimization: if we have next and following, we can stop if previous is also set.
    }
    
    let currentStatusText = "Calculating...";
    let summaryTidalFlowText = "Calculating...";

    if (previousTide && nextTide) {
        if (nextTide.type === "H") { 
            currentStatusText = "Flooding (Rising)"; summaryTidalFlowText = "Flooding";
        } else { 
            currentStatusText = "Ebbing (Falling)"; summaryTidalFlowText = "Ebbing";
        }
        const minutesToNextTide = (nextTide.time - now) / (1000 * 60);
        const minutesFromPreviousTide = (now - previousTide.time) / (1000 * 60);

        if ((minutesToNextTide <= 30 && minutesToNextTide >= 0) || (minutesFromPreviousTide <= 30 && minutesFromPreviousTide >=0 )) {
             let turningTo = nextTide.type === "H" ? "High" : "Low";
             let near = previousTide.type === "H" ? "High" : "Low";
             if (minutesToNextTide <= 30 && minutesToNextTide >= 0) { 
                currentStatusText = `Slack, turning towards ${turningTo}`; summaryTidalFlowText = `Slack, -> ${turningTo}`;
             } else if (minutesFromPreviousTide <=30 && minutesFromPreviousTide >= 0){ 
                currentStatusText = `Slack, just after ${near}`; summaryTidalFlowText = `Slack, after ${near}`;
             }
        }
    } else if (nextTide) { 
        currentStatusText = `Approaching ${nextTide.type === "H" ? "High" : "Low"} Tide`;
        summaryTidalFlowText = `Approaching ${nextTide.type === "H" ? "High" : "Low"}`;
    } else if (previousTide) { 
        currentStatusText = `Currently after ${previousTide.type === "H" ? "High" : "Low"} Tide`;
        summaryTidalFlowText = `After ${previousTide.type === "H" ? "High" : "Low"}`;
    } else {
        currentStatusText = "Tide data out of range"; summaryTidalFlowText = "Tide data out of range";
    }

    updateTextContent('tide-current-status', currentStatusText);
    updateTextContent('summary-tidal-flow', summaryTidalFlowText);
    updateTextContent('last-tide', previousTide ? `${previousTide.type === "H" ? "High" : "Low"} at ${formatTime(previousTide.time)} (${previousTide.value} ft)` : 'N/A');
    updateTextContent('next-tide', nextTide ? `${nextTide.type === "H" ? "High" : "Low"} at ${formatTime(nextTide.time)} (${nextTide.value} ft)` : 'N/A');
    updateTextContent('summary-next-tide', nextTide ? `${nextTide.type === "H" ? "High" : "Low"} at ${formatTime(nextTide.time)}` : 'N/A');
    updateTextContent('following-tide', followingTide ? `${followingTide.type === "H" ? "High" : "Low"} at ${formatTime(followingTide.time)} (${followingTide.value} ft)` : 'N/A');
}

// 3. Current Estimate
async function fetchCurrentData() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${('0' + (today.getMonth() + 1)).slice(-2)}${('0' + today.getDate()).slice(-2)}`;
    const url = `https://api.tidesandcurrents.noaa.gov/currents/data/${NOAA_STATIONS.NY_HARBOR_CURRENTS}?bin=${NOAA_STATIONS.CURRENTS_BIN}&date=${dateStr}&units=english&time_zone=LST_LDT&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;
    console.log("Fetching currents from:", url); // For debugging

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Currents. URL: ${url}`);
        const jsonData = await response.json();
        console.log("Currents JSON Data:", jsonData); // For debugging

        if (jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
            const now = new Date();
            let closestPrediction = null;
            let minDiff = Infinity;

            // NOAA currents/data Time is "YYYY-MM-DD HH:MM", so it's already a full date string
            jsonData.data.forEach(pred => {
                const predTime = new Date(pred.Time); // NOAA "Time" field is usually a full ISO-like string
                if (isNaN(predTime.getTime())) {
                    console.warn("Invalid date in current prediction:", pred.Time);
                    return; // Skip invalid date
                }
                const diff = Math.abs(now - predTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPrediction = pred;
                }
            });
            
            if (closestPrediction) {
                const speed = parseFloat(closestPrediction.Speed).toFixed(1);
                const direction = parseFloat(closestPrediction.Dir).toFixed(0);
                // Determine Flood/Ebb based on Speed sign; 0 is Slack
                // Note: The actual definition of Flood/Ebb direction depends on the station's orientation.
                // For NY Harbor, positive speed is often Flood (incoming), negative is Ebb (outgoing).
                let directionType = "Slack";
                if (parseFloat(speed) > 0.1) directionType = "Flood"; // Using a small threshold for slack
                else if (parseFloat(speed) < -0.1) directionType = "Ebb";

                updateTextContent('current-time-prediction', formatTime(closestPrediction.Time));
                updateTextContent('current-speed', `${Math.abs(speed)}`);
                updateTextContent('current-direction', `${direction}° (${degreesToCardinal(direction)})`);
                updateTextContent('current-direction-type', directionType);
            } else {
                 ['current-time-prediction', 'current-speed', 'current-direction', 'current-direction-type'].forEach(id => updateTextContent(id, 'No valid prediction found'));
            }
        } else {
            console.warn("No data or unexpected format in currents response:", jsonData);
            ['current-time-prediction', 'current-speed', 'current-direction', 'current-direction-type'].forEach(id => updateTextContent(id, 'N/A'));
        }
    } catch (error) {
        console.error("Error fetching current data:", error);
        ['current-time-prediction', 'current-speed', 'current-direction', 'current-direction-type'].forEach(id => updateTextContent(id, 'Error', true));
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
            const direction = parseFloat(windData.d); // Keep as number for degreesToCardinal
            const time = formatTime(windData.t);

            updateTextContent('robbins-wind-speed', speed);
            updateTextContent('robbins-wind-gusts', gusts === '0.0' || gusts === '0' ? 'N/A' : gusts);
            updateTextContent('robbins-wind-direction', isNaN(direction) ? '--' : direction.toFixed(0));
            updateTextContent('robbins-wind-cardinal', degreesToCardinal(direction));
            updateTextContent('robbins-wind-time', time);
            updateTextContent('summary-realtime-wind', `${speed} kts ${degreesToCardinal(direction)} (gusts ${gusts === '0.0' || gusts === '0' ? 'N/A' : gusts} kts)`);
        } else {
            ['robbins-wind-speed', 'robbins-wind-gusts', 'robbins-wind-direction', 'robbins-wind-cardinal', 'robbins-wind-time', 'summary-realtime-wind'].forEach(id => updateTextContent(id, 'N/A'));
        }
    } catch (error) {
        console.error("Error fetching real-time wind:", error);
         ['robbins-wind-speed', 'robbins-wind-gusts', 'robbins-wind-direction', 'robbins-wind-cardinal', 'robbins-wind-time', 'summary-realtime-wind'].forEach(id => updateTextContent(id, 'Error', true));
    }
}

// 5. Wind Forecast
async function fetchWindForecast() {
    // Using Open-Meteo with filtering
    const now = new Date();
    const startTime = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    const endTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);   // 6 hours from now

    // Format for Open-Meteo 'start_date' and 'end_date' parameters (YYYY-MM-DD)
    const startDateOpenMeteo = `${startTime.getFullYear()}-${('0' + (startTime.getMonth() + 1)).slice(-2)}-${('0' + startTime.getDate()).slice(-2)}`;
    const endDateOpenMeteo = `${endTime.getFullYear()}-${('0' + (endTime.getMonth() + 1)).slice(-2)}-${('0' + endTime.getDate()).slice(-2)}`;

    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${TARGET_LAT}&longitude=${TARGET_LON}&hourly=windspeed_10m,winddirection_10m,windgusts_10m&windspeed_unit=kn&timeformat=iso8601&timezone=America/New_York&start_date=${startDateOpenMeteo}&end_date=${endDateOpenMeteo}`;
    
    try {
        const response = await fetch(openMeteoUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} from Open-Meteo`);
        const jsonData = await response.json();
        if (jsonData.hourly && jsonData.hourly.time && jsonData.hourly.time.length > 0) {
            processAndDisplayOpenMeteoForecast(jsonData.hourly, "Open-Meteo");
        } else {
            updateTextContent('wind-forecast-hourly', 'No Open-Meteo forecast data for the selected window.', true);
            updateTextContent('summary-current-wind-forecast', 'N/A');
        }
    } catch (error) {
        console.error("Error fetching Wind Forecast from Open-Meteo:", error);
        updateTextContent('wind-forecast-hourly', 'Error loading forecast.', true);
        updateTextContent('summary-current-wind-forecast', 'Error');
    }
}

function processAndDisplayOpenMeteoForecast(hourlyData, source) {
    const forecastContainer = document.getElementById('wind-forecast-hourly');
    forecastContainer.innerHTML = ''; 

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const now = new Date();

    // Determine the current day for the header (can span two days with -3 to +6 hours)
    const firstForecastTime = new Date(hourlyData.time[0]);
    const lastForecastTime = new Date(hourlyData.time[hourlyData.time.length -1]);
    let headerDateText = formatDateUserFriendly(firstForecastTime);
    if (formatDateUserFriendly(firstForecastTime) !== formatDateUserFriendly(lastForecastTime)) {
        headerDateText += ` - ${formatDateUserFriendly(lastForecastTime)}`;
    }


    thead.innerHTML = `<tr><th>Time (${headerDateText})</th><th>Wind (kts)</th><th>Gusts (kts)</th><th>Direction</th></tr>`;
    table.appendChild(thead);

    let currentHourForecastSet = false;
    const timeWindowStart = now.getTime() - 3 * 60 * 60 * 1000;
    const timeWindowEnd = now.getTime() + 6 * 60 * 60 * 1000;

    for (let i = 0; i < hourlyData.time.length; i++) {
        const time = new Date(hourlyData.time[i]);

        // Filter for -3 to +6 hours (Open-Meteo API now does this with start/end_date, but good to double check)
        // This client-side filter becomes less critical if API correctly filters, but useful for display logic
        if (time.getTime() < timeWindowStart || time.getTime() > timeWindowEnd) {
            // continue; // Data should already be filtered by API call, but this is a safeguard
        }

        const speed = hourlyData.windspeed_10m[i] !== null ? parseFloat(hourlyData.windspeed_10m[i]).toFixed(1) : '--';
        const direction = hourlyData.winddirection_10m[i] !== null ? parseFloat(hourlyData.winddirection_10m[i]).toFixed(0) : '--';
        const gusts = hourlyData.windgusts_10m[i] !== null ? parseFloat(hourlyData.windgusts_10m[i]).toFixed(1) : '--';

        const row = tbody.insertRow();
        if (time < now) {
            row.classList.add('past-hour');
        }
        // Highlight the row closest to current hour or first future hour
        if (!currentHourForecastSet && time >= now) {
             row.classList.add('current-hour-highlight');
        }

        row.insertCell().textContent = formatTime(time);
        row.insertCell().textContent = speed;
        row.insertCell().textContent = gusts;
        row.insertCell().textContent = `${isNaN(parseFloat(direction)) ? '--' : direction}° (${degreesToCardinal(parseFloat(direction))})`;

        if (!currentHourForecastSet && time >= now) {
            updateTextContent('summary-current-wind-forecast', `${speed} kts ${degreesToCardinal(parseFloat(direction))} (gusts ${gusts} kts)`);
            currentHourForecastSet = true;
        }
    }
    table.appendChild(tbody);
    forecastContainer.appendChild(table);
    
    const attribution = document.createElement('p');
    attribution.innerHTML = `<small>Forecast from ${source}. Showing -3hrs to +6hrs approx.</small>`;
    forecastContainer.appendChild(attribution);

    if (!currentHourForecastSet && hourlyData.time.length > 0) { 
        const closestPastIdx = hourlyData.time.length - 1; // Show last available if all are past
        const speed = parseFloat(hourlyData.windspeed_10m[closestPastIdx]).toFixed(1);
        const direction = parseFloat(hourlyData.winddirection_10m[closestPastIdx]);
        const gusts = parseFloat(hourlyData.windgusts_10m[closestPastIdx]).toFixed(1);
        updateTextContent('summary-current-wind-forecast', `(Recent) ${speed} kts ${degreesToCardinal(direction)} (gusts ${gusts} kts)`);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    updateTextContent('last-updated', `${formatDateUserFriendly(now)} ${formatTime(now)}`);
    updateTextContent('current-year', now.getFullYear());
    const latLonText = `(${TARGET_LAT.toFixed(4)}°N, ${TARGET_LON.toFixed(4)}°W)`;
    updateTextContent('current-lat-lon-header', latLonText);
    updateTextContent('current-lat-lon-body', latLonText);
    updateTextContent('forecast-lat-lon-body', latLonText);

    functionfetchAllData(); // Initial fetch

    setInterval(fetchAllData, 15 * 60 * 1000); // Refresh every 15 minutes
});

function fetchAllData() {
    const now = new Date();
    updateTextContent('last-updated', `${formatDateUserFriendly(now)} ${formatTime(now)}`);
    
    fetchWaterTemperature();
    fetchTidalPredictions();
    fetchCurrentData();
    fetchRealtimeWind();
    fetchWindForecast(); 
}
