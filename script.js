let map;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 8,
  });
}

function initAutocomplete() {
  const addressInputs = document.querySelectorAll('input[name^="address"]');
  addressInputs.forEach(input => {
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ['address'],
      fields: ['formatted_address', 'geometry']
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) {
        console.log("No details available for input: '" + place.name + "'");
        return;
      }
      input.value = place.formatted_address;
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
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === "OK") {
        resolve(results[0].geometry.location);
      } else {
        reject(new Error(`Geocode was not successful for the following reason: ${status}`));
      }
    });
  });
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

function calculateRoute(driver, passengers, meetingLocation) {
  const directionsService = new google.maps.DirectionsService();
  const waypoints = passengers.map(passenger => ({
    location: passenger.location,
    stopover: true
  }));

  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin: driver.location,
        destination: meetingLocation,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          resolve(result);
        } else {
          reject(new Error(`Directions request failed due to ${status}`));
        }
      }
    );
  });
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

function selectMeetingLocation(users) {
  const placesService = new google.maps.places.PlacesService(map);
  const bounds = new google.maps.LatLngBounds();
  users.forEach(user => bounds.extend(user.location));

  return new Promise((resolve, reject) => {
    placesService.nearbySearch(
      {
        bounds: bounds,
        type: ['cafe', 'restaurant'], // You can adjust these types
        rankBy: google.maps.places.RankBy.PROMINENCE
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          // Select the most prominent place as the meeting location
          resolve(results[0]);
        } else {
          reject(new Error(`Places search failed due to ${status}`));
        }
      }
    );
  });
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
  // Clear existing markers and routes
  map.clearInstanceListeners();
  
  // Add user markers
  users.forEach(user => {
    new google.maps.Marker({
      position: user.location,
      map: map,
      title: `User ${user.id}`
    });
  });
  
  // Add meeting place marker
  new google.maps.Marker({
    position: meetingPlace.geometry.location,
    map: map,
    icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    title: 'Meeting Location'
  });
  
  // Add route polylines
  const directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);
  
  routes.forEach((route, index) => {
    directionsRenderer.setDirections(route.route);
  });
  
  // Fit map to show all markers and routes
  const bounds = new google.maps.LatLngBounds();
  users.forEach(user => bounds.extend(user.location));
  bounds.extend(meetingPlace.geometry.location);
  map.fitBounds(bounds);
}

// Initialize the map when the page loads