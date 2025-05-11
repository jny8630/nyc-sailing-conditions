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
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${NOAA_STATIONS.BATTERY_TIDES_WATER_TEMP}&product=water_temperature&datum=MLLW&units=english&time_zone=lst_ldt&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;
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
    const begin_date_str = `${startDate.getFullYear()}${('0' + (startDate.getMonth() + 1)).slice(-2)}${('0' + startDate.getDate()).slice(-2)}`;
    const end_date_str = `${endDate.getFullYear()}${('0' + (endDate.getMonth() + 1)).slice(-2)}${('0' + endDate.getDate()).slice(-2)}`;
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${begin_date_str}&end_date=${end_date_str}&station=${NOAA_STATIONS.BATTERY_TIDES_WATER_TEMP}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;
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
                pTide = parsedPredictions[nTideIndex - 1];
            }
        }
    }


    console.log("Selected Previous Tide:", pTide ? {time: pTide.time.toISOString(), type: pTide.type, value: pTide.value} : "None or out of range");
    console.log("Selected Next Tide:", nTide ? {time: nTide.time.toISOString(), type: nTide.type, value: nTide.value} : "None or out of range");
    console.log("Selected Following Tide:", fTide ? {time: fTide.time.toISOString(), type: fTide.type, value: fTide.value} : "None or out of range");
    
    let currentStatusText = "Calculating...";
    let summaryTidalFlowText = "Calculating...";

    if (pTide && nTide) { 
        if (nTide.type === "H") { 
            currentStatusText = "Flooding (Rising)"; summaryTidalFlowText = "Flooding";
        } else if (nTide.type === "L") { 
            currentStatusText = "Ebbing (Falling)"; summaryTidalFlowText = "Ebbing";
        } else { 
            currentStatusText = "Between tides"; summaryTidalFlowText = "Turning";
        }

        const minutesToNextTide = (nTide.time - now) / (1000 * 60);
        const minutesFromPreviousTide = (now - pTide.time) / (1000 * 60);

        if ((minutesToNextTide >= 0 && minutesToNextTide <= 30) || (minutesFromPreviousTide >=0 && minutesFromPreviousTide <= 30) ) {
            let nearTideTypeForSlack = (minutesToNextTide <= 30 && minutesToNextTide >=0 && nTide) ? nTide.type : (pTide ? pTide.type : "");
            let action = (minutesToNextTide <= 30 && minutesToNextTide >=0) ? "turning towards" : "just after";
            if (nearTideTypeForSlack) {
                currentStatusText = `Slack, ${action} ${nearTideTypeForSlack === "H" ? "High" : "Low"}`;
                summaryTidalFlowText = `Slack, ${action[0] === 't' ? '->' : 'after'} ${nearTideTypeForSlack === "H" ? "High" : "Low"}`;
            } else {
                currentStatusText = "Slack"; summaryTidalFlowText = "Slack";
            }
        }
    } else if (nTide) { 
        currentStatusText = `Approaching ${nTide.type === "H" ? "High" : "Low"} Tide`;
        summaryTidalFlowText = `Approaching ${nTide.type === "H" ? "High" : "Low"}`;
    } else if (pTide) { 
        currentStatusText = `Currently after ${pTide.type === "H" ? "High" : "Low"} Tide`;
        summaryTidalFlowText = `After ${pTide.type === "H" ? "High" : "Low"}`;
    } else {
        currentStatusText = "Tide data unavailable"; summaryTidalFlowText = "Tide data unavailable";
    }

    updateTextContent('tide-current-status', currentStatusText);
    updateTextContent('summary-tidal-flow', summaryTidalFlowText);
    updateTextContent('last-tide', pTide ? `${pTide.type === "H" ? "High" : "Low"} at ${formatTime(pTide.time)} (${pTide.value} ft)` : 'N/A');
    updateTextContent('next-tide', nTide ? `${nTide.type === "H" ? "High" : "Low"} at ${formatTime(nTide.time)} (${nTide.value} ft)` : 'N/A');
    updateTextContent('summary-next-tide', nTide ? `${nTide.type === "H" ? "High" : "Low"} at ${formatTime(nTide.time)}` : 'N/A');
    updateTextContent('following-tide', fTide ? `${fTide.type === "H" ? "High" : "Low"} at ${formatTime(fTide.time)} (${fTide.value} ft)` : 'N/A');
}


// 3. Current Estimate
async function fetchCurrentData() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${('0' + (today.getMonth() + 1)).slice(-2)}${('0' + today.getDate()).slice(-2)}`;
    const url = `https://api.tidesandcurrents.noaa.gov/currents/data/${NOAA_STATIONS.NY_HARBOR_CURRENTS}?bin=${NOAA_STATIONS.CURRENTS_BIN}&date=${dateStr}&units=english&time_zone=LST_LDT&format=json&application=${encodeURIComponent(NOAA_API_APP_NAME)}`;
    console.log("Fetching currents from:", url);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Currents. URL: ${url}`);
        const jsonData = await response.json();
        console.log("Currents JSON Data:", jsonData); 

        if (jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
            const now = new Date();
            let closestPrediction = null;
            let minDiff = Infinity;

            jsonData.data.forEach(pred => {
                const predTime = new Date(pred.Time); 
                if (isNaN(predTime.getTime())) {
                    console.warn("Invalid date in current prediction:", pred.Time);
                    return; 
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
                let directionType = "Slack";
                if (parseFloat(speed) > 0.1) directionType = "Flood"; 
                else if (parseFloat(speed) < -0.1) directionType = "Ebb";

                updateTextContent('current-time-prediction', formatTime(closestPrediction.Time));
                updateTextContent('current-speed', `${Math.abs(speed)}`);
                updateTextContent('current-direction', `${isNaN(direction) ? '--' : direction}° (${degreesToCardinal(direction)})`);
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
    console.log("Fetching Realtime Wind from:", url);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for Realtime Wind. URL: ${url}`);
        const jsonData = await response.json();
        if (jsonData.data && jsonData.data.length > 0) {
            const windData = jsonData.data[0];
            const speed = parseFloat(windData.s).toFixed(1);
            const gusts = parseFloat(windData.g).toFixed(1);
            const direction = parseFloat(windData.d); 
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
    const now = new Date();
    const startTime = new Date(now.getTime() - 3 * 60 * 60 * 1000); 
    const endTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);   
    const startDateOpenMeteo = `${startTime.getFullYear()}-${('0' + (startTime.getMonth() + 1)).slice(-2)}-${('0' + startTime.getDate()).slice(-2)}`;
    const endDateOpenMeteo = `${endTime.getFullYear()}-${('0' + (endTime.getMonth() + 1)).slice(-2)}-${('0' + endTime.getDate()).slice(-2)}`;
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${TARGET_LAT}&longitude=${TARGET_LON}&hourly=windspeed_10m,winddirection_10m,windgusts_10m&windspeed_unit=kn&timeformat=iso8601&timezone=America/New_York&start_date=${startDateOpenMeteo}&end_date=${endDateOpenMeteo}`;
    console.log("Fetching Wind Forecast from:", openMeteoUrl);
    try {
        const response = await fetch(openMeteoUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} from Open-Meteo. URL: ${openMeteoUrl}`);
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
    const firstForecastTime = new Date(hourlyData.time[0]);
    const lastForecastTime = new Date(hourlyData.time[hourlyData.time.length -1]);
    let headerDateText = formatDateUserFriendly(firstForecastTime);
    if (formatDateUserFriendly(firstForecastTime) !== formatDateUserFriendly(lastForecastTime)) {
        headerDateText += ` - ${formatDateUserFriendly(lastForecastTime)}`;
    }
    thead.innerHTML = `<tr><th>Time (${headerDateText})</th><th>Wind (kts)</th><th>Gusts (kts)</th><th>Direction</th></tr>`;
    table.appendChild(thead);

    let currentHourForecastSet = false;

    for (let i = 0; i < hourlyData.time.length; i++) {
        const time = new Date(hourlyData.time[i]);
        const speed = hourlyData.windspeed_10m[i] !== null ? parseFloat(hourlyData.windspeed_10m[i]).toFixed(1) : '--';
        const directionVal = hourlyData.winddirection_10m[i] !== null ? parseFloat(hourlyData.winddirection_10m[i]) : NaN;
        const gusts = hourlyData.windgusts_10m[i] !== null ? parseFloat(hourlyData.windgusts_10m[i]).toFixed(1) : '--';

        const row = tbody.insertRow();
        if (time < now) {
            row.classList.add('past-hour');
        }
        if (!currentHourForecastSet && time >= now) {
             row.classList.add('current-hour-highlight');
        }

        row.insertCell().textContent = formatTime(time);
        row.insertCell().textContent = speed;
        row.insertCell().textContent = gusts;
        row.insertCell().textContent = `${isNaN(directionVal) ? '--' : directionVal.toFixed(0)}° (${degreesToCardinal(directionVal)})`;

        if (!currentHourForecastSet && time >= now) {
            updateTextContent('summary-current-wind-forecast', `${speed} kts ${degreesToCardinal(directionVal)} (gusts ${gusts} kts)`);
            currentHourForecastSet = true;
        }
    }
    table.appendChild(tbody);
    forecastContainer.appendChild(table);
    const attribution = document.createElement('p');
    attribution.innerHTML = `<small>Forecast from ${source}. Showing approx. -3hrs to +6hrs window.</small>`;
    forecastContainer.appendChild(attribution);

    if (!currentHourForecastSet && hourlyData.time.length > 0) { 
        const closestPastIdx = hourlyData.time.length - 1; 
        const speed = parseFloat(hourlyData.windspeed_10m[closestPastIdx]).toFixed(1);
        const directionVal = parseFloat(hourlyData.winddirection_10m[closestPastIdx]);
        const gusts = parseFloat(hourlyData.windgusts_10m[closestPastIdx]).toFixed(1);
        updateTextContent('summary-current-wind-forecast', `(Recent) ${speed} kts ${degreesToCardinal(directionVal)} (gusts ${gusts} kts)`);
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

    fetchAllData(); 

    setInterval(fetchAllData, 15 * 60 * 1000); 
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
