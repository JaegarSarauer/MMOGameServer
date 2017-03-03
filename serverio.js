var sql = require('mysql');
var bcrypt = require('bcrypt');
var server = require('socket.io')();
var DBProperties = {};
DBProperties = require('./DBProperties.js');

var packets = {};
packets = require('./packets/Packets.js');

var db = sql.createConnection(DBProperties.Login);

db.connect();

var clientConnections = [];

server.on('connection', function(client){
	clientConnections[client.id] = client;
	var account = {
		userID : -1, 
		username : "", 
		isLoggedIn : function() {
			return this.userID != -1;
		}
	};
	clientConnections[client.id].account = account;
	
	client.on('sendChatMessage', function(socket) {
		server.emit('recieveChatMessage', {message : socket.message});
	});
	
	client.on('register', function(socket) {
		var resultPacket = Object.assign({}, packets.ConnectionPacket);
		resultPacket.type = "register";
		resultPacket.result = "error";
		if (clientConnections[client.id].account.isLoggedIn()) {
			resultPacket.message = "Please logout before registering an account.";
			client.emit('alertMessage', resultPacket);
			return;
		}
		bcrypt.hash(socket.password, 10, function(err, hash) {
			socket.password = hash;
			db.query("SELECT id FROM accounts WHERE username LIKE ?", [socket.username], function(err, data) {
				var accountExists = data.length > 0;
				console.log(socket.password);
				if (!accountExists) {
					db.query("INSERT INTO accounts SET ?", socket, function(err, data) {
						if (err) throw err;
						resultPacket.result = "success";
						resultPacket.message = "Registered! Please log in.";
						client.emit('alertMessage', resultPacket);
						client.disconnect();
					});
				} else {
					resultPacket.message = "Account already exists, please try logging in.";
					client.emit('alertMessage', resultPacket);
					client.disconnect();
				}
			});
		});
	});
	
	//uses ConnectionPacket Packet.
	client.on('login', function(socket) {
		//setup packet, defaults to error with no msg.
		var resultPacket = Object.assign({}, packets.ConnectionPacket);
		resultPacket.type = "login";
		resultPacket.result = "error";
		
		
		//is player logged in already, exit.
		if (clientConnections[client.id].account.isLoggedIn()) {
			resultPacket.message = "You are already logged in!";
			client.emit('alertMessage', resultPacket);
			return;
		}
		
		//are login fields missing data, exit.
		if (socket.username === undefined || socket.password === undefined) {
			resultPacket.message = "Please enter username and password.";
			client.emit('alertMessage', resultPacket);
			return;
		}
		db.query("SELECT id, username, password FROM accounts WHERE username LIKE ?", [socket.username], function(err, data) {
			var accountExists = data.length > 0;
			if (accountExists) {
				var isPassword = bcrypt.compareSync(socket.password, data[0].password);
				//password matches, login.
				if (isPassword) {
					resultPacket.result = "success";
					resultPacket.message = "Logged in!";
					client.emit('alertMessage', resultPacket);
					clientConnections[client.id].account.userID = data[0].id;
					clientConnections[client.id].account.username = data[0].username;
					console.log(clientConnections[client.id].account.username + " has logged in.");
				} else { //incorrect password, exit.
					resultPacket.message = "Incorrect username or password.";
					client.emit('alertMessage', resultPacket);
					client.disconnect();
				}
			} else {//incorrect password, exit.
				resultPacket.message = "Incorrect username or password.";
				client.emit('alertMessage', resultPacket);
				client.disconnect();
			}
		});
	});
	
	client.on('logout', function() {
		if (clientConnections[client.id].account.userID != 0)
			client.emit('alertMessage', {message : "Logged out!"});
		client.disconnect();
	});
	
    client.on('disconnect', function() {
		console.log(clientConnections[client.id].account.username + " has disconnected.");
        delete clientConnections[client.id];
    });
	
});





server.listen(9003);