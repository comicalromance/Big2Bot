const redis = require("redis");

const client = redis.createClient();
client.on("connect", () => {
	console.log("Redis connection established");
});

module.exports = client;