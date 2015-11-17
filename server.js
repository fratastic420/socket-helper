/*
 * AOS Socket Helper application
 *
 *
 */

var express 	= require('express'),
	app			= express(),
    server  	= require('http').createServer(app),
    io      	= require('socket.io').listen(server),
    port    	= 8089,
    url         = require('url'),
    //rooms = [],
	//redis		= require('redis'),                 //No redis for now
	//redisClient		= redis.createClient(),     //No redis for now
	noderequest		= require('request'),
    chatClients = new Object(),
    chatRooms = ['RichMedia Queue', 'AOS Lobby'];

// listen to port
server.listen(port);

//configure express
//define the paths to static files
app.use('/css', express.static(__dirname+'/public/css'));
app.use('/js', express.static(__dirname+'/public/js'));
app.use('/assets', express.static(__dirname+'/public/assets'));
app.use('/img', express.static(__dirname+'/public/img'));
app.use('/styles', express.static(__dirname+'/public/styles'));
app.use('/scripts', express.static(__dirname+'/public/scripts'));
app.use('/images', express.static(__dirname+'/public/images'));
app.use('/fonts', express.static(__dirname+'/public/fonts'));

//okay we have our folders, lets set up our request and serve up our main application file
app.get('/', function(req, res) {
   
   //var user = null,
   //options = {};
   //if (req.query.u) {
   //   user = req.query.u;
   //   console.log('creating a cookie for '+ req.query.u)
   //   res.cookie('user', user, {maxAge: 900000, httpOnly: true});
   //}
   //options = {
   //   'user' : user
   //};
   //res.sendFile(__dirname+'/public/index.html', options);
   res.sendFile(__dirname+'/public/index.html');
});

//app.get('/user/:user', function(req,res) {
//   var user = req.params.user;
//   console.log('cookie created for '+user);
//   res.sendFile(__dirname+'/public/index.html');
//   res.cookie('user', user, {maxAge: 900000, httpOnly: true});
//});

//todo => we may need another route that runs a blank iframe that connects to this app
// and triggers the new ad emit broadcast so the queue will update
//more or less this.... but instead sending up a new file
//app.set('socketio',io);
//app.get('/pushbullet/:siteid/:ad/:conf', function(req,res) {
//   var socketio = req.app.get('socketio');
//    var data = {
//      client:  generateId(),
//      ad:      req.params.ad,
//      siteid:  req.params.siteid,
//      conf:    req.params.conf
//   };
//   socketio.emit('newad', data);
//   res.status(200).json({success:true, push:data});
//}); 



//log level of socket.io, see only handshakes and disconnections
io.set('log level', 2);

//fallback for clients without websockets
io.set('transports', ['websocket', 'xhr-polling','polling']);

//socket.io events, this be the good stuff
io.sockets.on('connection', function(socket) {
    //lets connect these peeps
    socket.on('connect', function(data) {
       connect(socket,data); 
    });
    
    socket.on('init', function(data) {
    	//data.event = 'init';
        //console.log(socket);
        console.log(data);
        if (!chatClients[socket.conn.id]) {
            chatClients[socket.conn.id] = data;
        }
    	subscribe(socket, {room: 'RichMedia Queue'});
    	roomsList = getRooms();
        socket.emit('ready', {clientId: data.clientId});
    });
    
    //client sends a message
    socket.on('chatmessage', function(data) {
       chatmessage(socket, data); 
    });
    //client goes idle
    socket.on('idleclient', function(data) {
       idleclient(socket, data); 
    });
    //client comes back
    socket.on('activeclient', function(data) {
       activeclient(socket,data); 
    });
    //client subscribes to a room
    socket.on('subscribe', function(data) {
       subscribe(socket,data); 
    });
    //client leave a room
    socket.on('unsubscribe', function(data) {
       unsubscribe(socket,data); 
    });
    //a new ad comes in
    socket.on('newad', function(data){
      console.log('triggered');
      newad(socket,data); 
    });
    //an ad needs to be removed
    socket.on('removead', function(data) {
       removead(socket,data); 
    });
    //assign someone responsibility
    socket.on('setresponsibility', function(data) {
       setresponsbility(socket,data); 
    });
    //take responsibility
    socket.on('takeresponsibility', function(data) {
       takeresponsibility(socket,data); 
    });
    
});

//new clients y'all -> this may need to be reconfigured in future for other sites to push new ads
function connect(socket, data) {
    data.clientId = generateId();
    chatClients[socket.conn.id] = data;
    socket.emit('ready', {clientId: data.clientId});
    if (data.site) {
        subscribe(socket, {room: data.site});
    } else {
        subscribe(socket, {room: 'RichMedia Queue'});
    }
    roomsList = getRooms();
    //if (data.aos === true) {
        // do nothing
    //} else {
        socket.emit('roomslist', {rooms: roomsList});
   // }
   
}

//client disconnects
function disconnect(socket) {
    var rooms = io.sockets.adapter.roomClients[socket.conn.id];
    for(var room in rooms) {
        if (room && rooms[room]) {
            unsubscribe(socket, {room: room.replace('/','')});
        }
    }
    delete chatClients[socket.conn.id];
}

//loading from redis - not called anywhere left out for now
//saving to redis - not called anywhere left out for now


function chatmessage(socket, data) {
    socket.broadcast.to(data.room).emit('chatmessage', {client: chatClients[socket.conn.id], message: data.message, room: data.room});
}


function newad(socket, data) {
   console.log("New Ad\r\n");
    socket.broadcast.emit('newad',
        {room: data.room, client: data.client, ad: data.ad, siteid:data.siteid, conf: data.conf});
}

function removead(socket, data) {
    socket.broadcast.emit('removead',
        {room: data.room, client: data.client, ad: data.ad, siteid: data.siteid});   
}

function setresponsbility(socket, data) {
    socket.broadcast.emit('setresponsibility',
        {room: data.room, client: data.client, ad: data.ad, siteid: data.siteid, responsibility: data.responsibility});
}

function takeresponsibility(socket, data) {
    socket.broadcast.emit('takeresponsibility',
        {room: data.room, client: data.client, ad: data.ad, siteid: data.siteid});
}

function idleclient(socket, data) {
    socket.broadcast.emit('idleclient', {room:data.room, client: data.client});
}

function activeclient(socket, data) {
    socket.broadcast.emit('activeclient', {room:data.room, client: data.client});
}

//dont really need the typing functions methinks

function clearRoom(socket, data) {
    socket.broadcast.to(data.room).emit('clearRoom', {room:data.room, name: data.name});
}

//someone joins the queue / party
function subscribe(socket, data) {
    var rooms = getRooms();
    if (rooms.indexOf(data.room) < 0) {
        socket.broadcast.emit('addroom', {room: data.room})
    }
    socket.join(data.room);
    updatePresence(data.room,socket,'online');
    socket.emit('roomclients', {room: data.room, clients: getClientsInRoom(socket.conn.id, data.room)});
}

//someone leaves a room or goes offline
function unsubscribe(socket, data) {
   updatePresence(data.room, socket, 'offline');
   socket.leave(data.room);
}

//get the available rooms
function getRooms() {
   return Object.keys(io.sockets.adapter.rooms);
}

//THIS FUNCTION IS FUCKED -> may need to pass the socket obj?
//get the peeps in the room / queue
function getClientsInRoom(socketId, room) {
   var socketIds = io.sockets.adapter.rooms[room],
   clients = [],
   i = 0,
   socketsCount = 0,
   data = {
      socketId: socketId,
      room: room,
   };
   //console.log(chatClients);
   if (socketIds && socketIds[socketId] == true) {
      socketsArr = Object.keys(socketIds);
      socketsArr.forEach(function(el, i, arr) {
         if (el!=socketId) {
            clients.push(chatClients[el]);
         }
      });
   }
   console.log(clients);
   return clients;
}

//THIS FUNCTION IS FUCKED 
//check the number of peeps in room / queue
function countClientInRoom(room) {
   if (io.sockets.adapter.rooms[room]) {
      return Object.keys(io.sockets.adapter.rooms[room]).length;
      //return io.sockets.adapter.rooms[room].length;
   }
   return 0;
}

//someone left/entered the room / queue
function updatePresence(room, socket, state) {
   var data = {
      event: 'updatePresence',
      room: room,
      socket: socket,
      state: state
   };
   //console.log(data);
   socket.broadcast.to(room).emit('presence', {client: chatClients[socket.conn.id], state: state, room: room});
}

//create a unique id
function generateId() {
   var S4 = function() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
   };
   return (S4() + S4() + '-' + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4() + S4());
}

//create a simple time stamp
function getTime() {
   var date = new Date();
   return (date.getHours() < 10 ? '0' + date.getHours().toString() : date.getHours()) + ":" +
      (date.getMinutes() < 10 ? '0' + date.getMinutes.toString() : date.getMinutes());
}







console.log('Socket Helper server is running and listening to port %d...', port);