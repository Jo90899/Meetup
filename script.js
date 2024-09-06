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
}

function optimizeMeetup() {
    const users = [];
    const numUsers = parseInt(document.getElementById('numUsers').value);

    for (let i = 1; i <= numUsers; i++) {
        users.push({
            id: i,
            address: document.querySelector(`input[name="address${i}"]`).value,
            hasCar: document.querySelector(`select[name="hasCar${i}"]`).value === 'yes',
            canGiveRides: document.querySelector(`select[name="canGiveRides${i}"]`).value === 'yes',
            seats: parseInt(document.querySelector(`input[name="seats${i}"]`).value) || 0
        });
    }

    // Simple optimization logic (this should be replaced with a more sophisticated algorithm)
    const drivers = users.filter(user => user.hasCar && user.canGiveRides && user.seats > 0);
    const passengers = users.filter(user => !user.hasCar || !user.canGiveRides);
    const meetingLocation = users[Math.floor(Math.random() * users.length)].address;

    const result = document.getElementById('result');
    result.innerHTML = `
        <div class="result-card p-4 rounded-lg">
            <h2 class="text-xl font-bold mb-2">Optimized Meetup Plan:</h2>
            <p class="mb-2"><strong>Meeting Location:</strong> ${meetingLocation}</p>
            <p class="mb-2"><strong>Ride Sharing:</strong></p>
            <ul class="list-disc pl-5">
                ${drivers.map(driver => `
                    <li>User ${driver.id} drives, picking up ${Math.min(driver.seats - 1, passengers.length)} passenger(s)</li>
                `).join('')}
                ${passengers.length > 0 ? `<li>${passengers.length} passenger(s) need a ride</li>` : ''}
            </ul>
        </div>
    `;
}
