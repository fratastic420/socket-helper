//need this function for $_GET VARIABLES
(function($) {
    $.QueryString = function(a) {
        if (a == "") return {};
        var b = {},
        i = 0,
        len = a.length,
        p = null;
        for(i; i< len; ++i){
            p = a[i].split('=');
            if (p.length != 2) continue;;
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    }(window.location.search.substr(1).split('&'));    
})(jQuery);

//(function($){
    var isAOS = false,
    mutedApp = false,
    curYear = (new Date).getFullYear(),
    me = {},
    searchTerms = {},
    appOn = true,
	user = $.QueryString['u'] || false,
	site = $.QueryString['site'] || 'RichMedia Queue',
	NICK_MAX_LENGTH = 25,
	ROOM_MAX_LENGTH = 20,
	idletime = 0,
    socket = null,
    clientId = null,
	client = null,
    nickname = null,
    isMe = null,
    currentRoom = null,
    //serverAddress = 'http://localhost', //need to change on deployment
    serverAddress = deploymentURL,
	serverDisplayNone = 'Server',
    meDisplayColor = '#54A854',
	elseDisplayColor = '#1c5380',
    tmplt = {
        room: [
			'<li data-roomId="${room}"><i class="icon icon-black icon-bullet-off"></i>&nbsp;${room}&nbsp;<span class="label pull-right">0</span></li>'
			].join(""),
        client: [
			'<div data-clientId="${clientId}" class="btn-group activeClient" role="group"><button class="btn btn-default">\
				  <li data-clientId="${clientId}">\
				  <i class="glyphicon glyphicon-user clientBull"></i>&nbsp;${nickname}&nbsp;\
				  <i data-clientId="${clientId}" class="glyphicon glyphicon-option-horizontal icon-grey hide isTyping"></i>\
				  </li>\
			</button></div>'	 
			].join(""),
        message: [
			'<ul class="liststylenone"><li><div class="pull-left"><strong class="sender">${sender}&nbsp;</strong></div><div class="pull-left">${text}</div><div class="pull-right muted"><small>${time}</small></div></li></ul>'	  
			].join("")
    }
	//alert(site);
	//alert(user);
    


function inFrame() {
    if (window.self === top) {
        return false;
    }
    return true;
}

//dis is hoooow we doooo it. This is how we do it.
function connectUser(user) {
	user = user.trim();
	if (user && user.length <= NICK_MAX_LENGTH) {
		nickname = user;
		$.cookie('user', nickname, {expires:365});
	}
	$('.connectionStatus').html('Connection...');
	socket = io.connect(serverAddress);
	bindSocketEvents();
}



//possible user functionality
function bindDOMEvents(){
    //switching between rooms -> most likely not needed
    $('#roomsList li').live('click', function() {
        var room = $(this).attr('data-roomId');
        if (room != currentRoom) {
            socket.emit('unsubscribe', { room: currentRoom });
			socket.emit('subscribe', { room: room });
       }
    });
}

//this is the actual good stuff :D
function bindSocketEvents() {
    //connected to server
   // var socketconnected = false;
   //this is recursively blowing up
    socket.on('connect', function(e) { 	
    	var data = {nickname: user, site:site, aos:isAOS};
        var s = socket.emit('init',data); 	
    });
    //server created connection and id for me
    socket.on('ready', function(data) {
    	data.event = 'ready';
    	console.log(data);
       clientId = data.clientId; 
    });
    //getting response of available rooms
    socket.on('roomslist', function(data) {
    	data.event = 'roomslist';
    	console.log(data);
       var i = 0, len = data.rooms.length;
       for (i;i<len; i++) {
            if (data.rooms[i] != '') {
                addRoom(data.rooms[i], false);
            }
       }
    });
    //updating clients in room
    socket.on('updateClients', function(data) {
    	data.event = 'updateClients';
    	console.log(data);
        $('#roomsList li[data-roomid="'+data.room+'"]').find('span').html(data.count);
		if (data.count > 0) $('#roomsList li[data-roomid="'+data.room+'"]').find('span').addClass('label-important');
		else $('#roomsList li[data-roomid="'+data.room+'"]').find('span').removeClass('label-important');	
    });
    //chat message
    socket.on('chatmessage', function(data) {
    	data.event='chatmessage';
    	console.log(data);
       var nickname = data.client.nickname,
       message = data.message;
       insertMessage(nickname,message, true, false, false);
    });
    //getting init list of room clients
    socket.on('roomclients', function(data) {
    	data.event="roomclients";
    	console.log(data);
       addRoom(data.room,false);
       setCurrentRoom(data.room);
       clearRoom(false, data.room, user);
       $('#userList').empty();
       addClient({ nickname: user, clientId: clientId},false,true);
       var i = 0, len = data.clients.length;
       for(i; i<len;i++) {
        if (data.clients[i]) {
            addClient(data.clients[i], false);
        }
       }
    });
    //loading a message
    socket.on('loadMessage', function(data) {
    	data.event="loadMessage";
    	console.log(data);
       loadMessage(data); 
    });
    //a room was added
    socket.on('addroom', function(data) {
    	data.event="addroom";
    	console.log(data);
       addRoom(data.room, true); 
    });
    //a room was destroyed
    socket.on('removeroom', function(data) {
    	data.event="removeroom";
    	console.log(data);
       removeRoom(data.room,true); 
    });
    //client comes on or offline
    socket.on('presence', function(data) {
    	data.event="presence";
    	console.log(data);
        if(data.state == 'online'){
            addClient(data.client, false); 
        } else if (data.state == 'offline') {
            removeClient(data.client, true);
            getClientsInRoom(currentRoom);
        }
    });
    //an ad was removed
    socket.on('removead', function(data) {
    	data.event="removead";
    	console.log(data);
       clearAd(data); 
    });
    //an ad was added
    socket.on('newad', function(data) {
    	data.event="newad";
    	console.log(data);
       addNewAd(data); 
    });
    //responsibility was set
    socket.on('setresponsibility', function(data) {
    	data.event="setresponsibility";
    	console.log(data);
        setResponsibility(data);
    });
    //responsibility was taken
    socket.on('takeresponsibility', function(data) {
    	data.event="takeresponsiblity";
    	console.log(data);
        takeResponsibility(data);
    });
    //client goes idle
    socket.on('idleclient', function(data){
		$('#usersList li[data-clientId="' + data.client + '"]').find('.clientBull').addClass('icon-orange');
	});
	//client comes back
	socket.on('activeclient', function(data){
		$('#usersList li[data-clientId="' + data.client + '"]').find('.clientBull').removeClass('icon-orange');
	});
}


function clearRoom(announce, room, name) {
    $('#chat-messages').html('');
    if (announce) {
        insertMessage(serverDisplayName, name+' has cleared the room `'+room+'`...', true, false, true);
    }
}

function addRoom(name,announce) {
    name = name.replace('/','');
    if (isAOS === true) {
        buildChatRoom(name,announce);
    }else {
        if (name==site || name == 'RichMedia Queue') {
            buildChatRoom(name,announce);
        }
    }
}

function buildChatRoom(name,announce){
    var el = $('#roomsList li[data-roomId="'+name+'"]');
    if (el.length == 0) {
        $.tmpl(tmplt.room, {room:name}).appendTo('#roomsList');
        if (announce && isAOS === true) {
            insertMessage(serverDisplayName, 'The room `'+name+'` created...', true, false, true);
        }
    }
    getClientsInRoom(name);
}

function removeRoom(name, announce) {
    $('#roomsList li[data-roomId="'+name+'"]').remove();
    if (announce) {
        insertMessage(serverDisplayName, 'The room `' + name + '` destroyed...', true, false, true);
    }
}

function addClient(client, announce, isMe) {
    var $html = $.tmpl(tmplt.client, client);
    if (isMe) {
        $html.addClass('me').find('i').addClass('icon-green');
    }
    $html.appendTo('.clientList');
}

//if in iframe update the queue
function clearAd(data) {
    if (inFrame() === true) {
        window.parent.clearAd(data);
    }
}
//if in iframe update the queue
function addNewAd(data) {
    if (inFrame() === true) {
        window.parent.addNewAd(data);
    }
}
//if in iframe update the queue
function setResponsibility(data) {
    if (inFrame() === true){
        window.parent.setResponsbility(data);
    }
}
//if in iframe update the queue
function takeResponsibility(data) {
    if (inFrame() === true) {
        window.parent.takeResponsibility(data);
    }
}

function getClientsInRoom() {
	return 0;
}

function setCurrentRoom(room) {
	$('#roomName').html(room);
	var oldRoom = $('#roomsList li.selected').data('roomid');
	if (oldRoom != undefined) getClientsInRoom(oldRoom);
	getClientsInRoom(room);
	currentRoom = room;
	$('#roomsList li.selected').removeClass('selected').find('i').removeClass('icon-bullet-on').removeClass("icon-green");
	$('#roomsList li[data-roomId="' + room + '"]').addClass('selected').find("i").addClass('icon-bullet-on').addClass("icon-green");
}

//have to check company server to see if this an actual employee trying to use the socket helper
function checkIsAOS(user) {
    searchTerms = {action: 'employeecheck', siteid: 0, "user" : user},
    request = null;
    request = AjaxRequest.req(searchTerms, aosurl);
    request.done(function(data) {
        if (data.success && data.success == true) {
            appOn = true;
            isAOS = true;
        }else {
            appOn = false;   
        }
    }).
    fail(function(data) {
        appOn = false;
    });
}


$(function() {
    //some global parameters
	if (user) {
		$('.user').html(user);
		connectUser(user);
	}
	
});

//})(jQuery);

