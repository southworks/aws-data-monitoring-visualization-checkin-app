const users = require("./users/seedUsers");
const historicalData = require("./historical-data/seedHistoricalData");

let usersSeed = new users();
let historicalDataSeed = new historicalData();
let userIdsArray = [];

// Here we call the users seed. For visual search, not for code clarification.
let usersArray = usersSeed.generateUsers();

console.log("Users: ", usersArray);

// Here we call the historical data seed. For visual search, not for code clarification.
historicalDataSeed.generateHistoricalData(usersArray);
