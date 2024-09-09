let map;

function initMap() {
  map = new mapboxgl.Map({
    container: 'map', // HTML container ID
    style: 'mapbox://styles/mapbox/streets-v11', // Mapbox style
    center: [0, 0], // Starting position [lng, lat]
    zoom: 8 // Starting zoom
  });
}

function initAutocomplete() {
  const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    types: 'address',
    placeholder: 'Enter an address'
  });

  document.querySelectorAll('input[name^="address"]').forEach(input => {
    const parent = input.parentElement;
    geocoder.addTo(parent);
    geocoder.on('result', function(e) {
      input.value = e.result.place_name;
    });
  });
}

document.getElementById('userForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const numUsers = parseInt(document.getElementById('numUsers').value);
  generateUserInputs(numUsers);
});

function generateUserInputs(numUsers) {
  const userInputs = document.getElementById('userInputs');
  userInputs.innerHTML = '';
  for (let i = 1; i <= numUsers; i++) {
    userInputs.innerHTML += `
      <div class="user-card mb-6 p-4 border border-gray-200 rounded-lg bg-white">
        <h3 class="text-lg font-semibold mb-2">User ${i}</h3>
        <div class="space-y-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">Home Address:</label>
            <input type="text" name="address${i}" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Has Car:</label>
            <select name="hasCar${i}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Can Give Rides:</label>
            <select name="canGiveRides${i}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Number of Seats:</label>
            <input type="number" name="seats${i}" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
          </div>
        </div>
      </div>
    `;
  }
  userInputs.innerHTML += `
    <button onclick="optimizeMeetup()" class="optimize-button w-full mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition">Optimize Meetup</button>
  `;
  initAutocomplete();
}

async function geocodeAddress(address) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.features && data.features.length > 0) {
    const location = data.features[0].geometry.coordinates;
    return { lat: location[1], lng: location[0] }; // Mapbox returns [lng, lat], so reverse
  } else {
    throw new Error('Geocode failed');
  }
}


async function collectUserData() {
  const users = [];
  const numUsers = parseInt(document.getElementById('numUsers').value);
  for (let i = 1; i <= numUsers; i++) {
    const address = document.querySelector(`input[name="address${i}"]`).value;
    try {
      const location = await geocodeAddress(address);
      users.push({
        id: i,
        address: address,
        location: location,
        hasCar: document.querySelector(`select[name="hasCar${i}"]`).value === 'yes',
        canGiveRides: document.querySelector(`select[name="canGiveRides${i}"]`).value === 'yes',
        seats: parseInt(document.querySelector(`input[name="seats${i}"]`).value) || 0
      });
    } catch (error) {
      console.error(`Error geocoding address for user ${i}:`, error);
      showError(`Error geocoding address for user ${i}: ${error.message}`);
    }
  }
  return users;
}

async function calculateRoute(driver, passengers, meetingLocation) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${driver.location.lng},${driver.location.lat};${meetingLocation.lng},${meetingLocation.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.routes && data.routes.length > 0) {
    return data.routes[0];
  } else {
    throw new Error('Directions request failed');
  }
}


async function optimizeRoutes(drivers, passengers, meetingLocation) {
  const routes = [];
  for (const driver of drivers) {
    try {
      const route = await calculateRoute(driver, passengers, meetingLocation);
      routes.push({ driver, route });
      // Remove assigned passengers from the pool
      passengers = passengers.filter(p => !route.request.waypoints.some(w => w.location.equals(p.location)));
    } catch (error) {
      console.error(`Error calculating route for driver ${driver.id}:`, error);
      showError(`Error calculating route for driver ${driver.id}: ${error.message}`);
    }
  }
  return routes;
}

async function selectMeetingLocation(users) {
  // Calculate the bounding box (LngLatBounds) for user locations
  const bounds = new mapboxgl.LngLatBounds();
  users.forEach(user => bounds.extend([user.location.lng, user.location.lat]));

  // Use Mapbox Geocoding API to find places within the bounding box
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/cafe,restaurant.json?bbox=${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}&access_token=${mapboxgl.accessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      // Resolve with the first result (most prominent place)
      return data.features[0];
    } else {
      throw new Error('No places found within bounds');
    }
  } catch (error) {
    throw new Error(`Places search failed: ${error.message}`);
  }
}

function showError(message) {
  const errorDiv = document.getElementById('error-messages');
  errorDiv.innerHTML += `<p class="text-red-500">${message}</p>`;
  errorDiv.style.display = 'block';
}

function clearErrors() {
  const errorDiv = document.getElementById('error-messages');
  errorDiv.innerHTML = '';
  errorDiv.style.display = 'none';
}

function showLoading(isLoading) {
  const loadingDiv = document.getElementById('loading');
  loadingDiv.style.display = isLoading ? 'block' : 'none';
}

async function optimizeMeetup() {
  clearErrors();
  showLoading(true);
  try {
    const users = await collectUserData();
    const meetingPlace = await selectMeetingLocation(users);
    const drivers = users.filter(user => user.hasCar && user.canGiveRides && user.seats > 0);
    const passengers = users.filter(user => !user.hasCar || !user.canGiveRides);
    
    const routes = await optimizeRoutes(drivers, passengers, meetingPlace.geometry.location);
    
    displayResults(meetingPlace, routes, passengers);
    updateMap(users, meetingPlace, routes);
  } catch (error) {
    showError(`An error occurred: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

function displayResults(meetingPlace, routes, remainingPassengers) {
  const resultDiv = document.getElementById('result');
  let html = `
    <h2 class="text-2xl font-bold mb-4">Optimized Meetup Plan</h2>
    <p class="mb-2"><strong>Meeting Location:</strong> ${meetingPlace.name}, ${meetingPlace.vicinity}</p>
    <h3 class="text-xl font-semibold mb-2">Routes:</h3>
  `;
  
  routes.forEach((route, index) => {
    html += `
      <div class="mb-4">
        <p class="font-semibold">Driver ${route.driver.id}:</p>
        <ul class="list-disc pl-5">
          ${route.route.routes[0].legs.map(leg => `<li>${leg.start_address} to ${leg.end_address}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  
  if (remainingPassengers.length > 0) {
    html += `
      <p class="mt-4"><strong>Passengers needing a ride:</strong> ${remainingPassengers.map(p => p.id).join(', ')}</p>
    `;
  }
  
  resultDiv.innerHTML = html;
}

function updateMap(users, meetingPlace, routes) {
  map.on('load', () => {
    // Add markers for users
    users.forEach(user => {
      new mapboxgl.Marker()
        .setLngLat([user.location.lng, user.location.lat])
        .addTo(map);
    });

    // Add meeting place marker
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([meetingPlace.lng, meetingPlace.lat])
      .addTo(map);

    // Display routes as lines
    routes.forEach(route => {
      map.addLayer({
        id: `route-${route.driver.id}`,
        type: 'line',
        source: {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: route.geometry // Assuming route.geometry is in GeoJSON format
          }
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ff7f50',
          'line-width': 5
        }
      });
    });
  });
}


// Initialize the map when the page loads