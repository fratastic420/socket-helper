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

var siteid = $.QueryString['siteid'] = {} ? false : $.QueryString['siteid'],
    site = $.QueryString['site'] = {} ? 'RichMedia Queue' : $.QueryString['site'],
    user = $.QueryString['u'] = {} ? false : $.QueryString['u'],
    isAOS = false,
    mutedApp = false,
    curYear = (new Date).getFullYear(),
    me = {},
    searchTerms = {},
    appOn = true;

$(function() {
    //some global parameters
    var idletime = 0,
    socket = null,
    clientId = null,
    nickname = null,
    isMe = null,
    currentRoom = null,
    serverAddress = 'http://localhost', //need to change on deployment
    serverDisplayNone = 'Server',
    meDisplayColor = '#54A854',
	elseDisplayColor = '#1c5380',
    tmplt = {
        room: [].join(""),
        client: [].join(""),
        message: [].join("")
    }
});

function inFrame() {
    if (window.self === top) {
        return false;
    }
    return true;
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
    socket.on('connect', function() {
        socket.emit('connect',{nickname: user, site: site, aos:isAOS});
    });
    //server created connection and id for me
    socket.on('ready', function(data) {
       clientId = data.clientId; 
    });
    //getting response of available rooms
    socket.on('roomslist', function(data) {
       var i = 0, len = data.rooms.length;
       for (i;i<len; i++) {
            if (data.rooms[i] != '') {
                addRoom(data.rooms[i], false);
            }
       }
    });
    //updating clients in room
    socket.on('updateClients', function(data) {
        $('#roomsList li[data-roomid="'+data.room+'"]').find('span').html(data.count);
		if (data.count > 0) $('#roomsList li[data-roomid="'+data.room+'"]').find('span').addClass('label-important');
		else $('#roomsList li[data-roomid="'+data.room+'"]').find('span').removeClass('label-important');	
    });
    //chat message
    socket.on('chatmessage', function(data) {
       var nickname = data.client.nickname,
       message = data.message;
       insertMessage(nickname,message, true, false, false);
    });
    //getting init list of room clients
    socket.on('roomclients', function(data) {
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
       loadMessage(data); 
    });
    //a room was added
    socket.on('addroom', function(data) {
       addRoom(data.room, true); 
    });
    //a room was destroyed
    socket.on('removeroom', function(data) {
       removeRoom(data.room,true); 
    });
    //client comes on or offline
    socket.on('presence', function(data) {
        if(data.state == 'online'){
            addClient(data.client, false); 
        } else if (data.state == 'offline') {
            removeClient(data.client, true);
            getClientsInRoom(currentRoom);
        }
    });
    //an ad was removed
    socket.on('removead', function(data) {
       clearAd(data); 
    });
    //an ad was added
    socket.on('newad', function(data) {
       addNewAd(data); 
    });
    //responsibility was set
    socket.on('setresponsibility', function(data) {
        setResponsibility(data);
    });
    //responsibility was taken
    socket.on('takeresponsibility', function(data) {
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

function buildChatroom(name,announce){
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

function addClient(clientId, announce, isMe) {
    var $html = $.tmpl(tmplt.client, client);
    if (isMe) {
        $html.addClass('me').find('i').addClass('icon-green');
    }
    $html.appendTo('#usersList');
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