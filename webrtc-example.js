// Shims
var peerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || 
                       window.webkitRTCPeerConnection || window.msRTCPeerConnection;
var sessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription ||
                       window.webkitRTCSessionDescription || window.msRTCSessionDescription;

// Convenience functions
var logError = function(msg, e) {
    document.getElementById("output").innerHTML += "<em style='color:red;'>Failure: " + msg + ", " + e + "</em><hr/>";
};
var logSuccess = function(msg) {
    document.getElementById("output").innerHTML += "<em style='color:green;'>Success: " + msg + "</em><hr/>";
};
var logMessage = function(msg) {
    document.getElementById("output").innerHTML += "" + msg + "<hr/>";
};

// # Step 1 (Caller)
// # Step 1 (Receiver)
// Create a peer connection object that will represent the connection between
// the two browsers. Give the connection a list of STUN/TURN servers so that
// later it can use them to help us traverse our NAT
var connection = new peerConnection({
   iceServers: [ {url: "stun:stun.1.google.com:19302"} ]
});

var channel;

document.getElementById("open-channel").onclick = function() {
    // # Step 2 (Caller)
    // When the user clicks the "open channel" button they are effectively making
    // a call, i.e. this client becomes the "caller". When you call
    // connection.createDataChannel() for the first time, you can expect the
    // onnegotiationneeded callback to fire.
    //
    // Create the channel and hang on to it
    channel = connection.createDataChannel("my_channel_label");
    // Define what happens when the channel finally opens
    channel.onopen = function() { 
        // # Step 6 (Caller)
        // The channel is open!!
        logSuccess("channel onopen"); 
    }
    // Define what happens when the channel gets a message
    channel.onmessage = function(evt) {
        // # Step 7.b (Caller)
        // Hooray, we're getting data directly from the remote peer!
        logMessage("<strong>message from the channel: " + evt.data + "</strong>");
    }
}

connection.onnegotiationneeded = function() {
    // # Step 3 (Caller)
    // When you open a channel on this connection for the first time, this
    // callback will be fired almost instantly before the channel can become
    // usable.
    //
    // Create an offer in the form of an RTCSessionDescription object.
    // This offer must be sent to the peer somehow. In our case, we'll just
    // have the user copy/paste it. Because it's created asynchronously, we
    // provide a callback to wait until it's created
    connection.createOffer(function(desc) {
        // The offer description has been created successfully. We set our
        // local description to this value and send it to the peer somehow and
        // they'll use it to set their connection's remote description. The
        // caller will have to wait for an answer. As soon as the local
        // description is set, the browser will start talking to the STUN/TURN
        // servers and gather ice candidates.
        connection.setLocalDescription(desc);
        logMessage("<strong>Send this offer to the peer:</strong><br/><code>"+JSON.stringify(desc)+"</code>");
    }, function(e){ logError("createOffer", e); });
};

connection.onicecandidate = function(evt) {
    // # Step 4 (Caller)
    // # Step 3 (Receiver)
    // When setLocalDescription gets called, the browser will start
    // communicating with the STUN/TURN servers and call this callback when a
    // ice candidate is found. This method should then send the candidate to
    // the peer somehow. We do this here by just having the user copy/paste
    if (evt.candidate) {
        logMessage("<strong>Send this ice candidate to the peer:</strong><br/><code>"+JSON.stringify(evt.candidate)+"</code>");
    }
};

// This is the callback for when we receive a remote signal. In this example,
// this is when the user pastes a blob into the text box and clicks the button.
document.getElementById("signal-button").onclick = function() {
    var payload = JSON.parse(document.getElementById("signal").value);
    document.getElementById("signal").value = "";

    if(payload.sdp && payload.type == "offer") {
        // # Step 2 (Receiver)
        // The remote caller has signalled us with an offer. We need to set
        // our remote description to whatever it sent us, then create an answer
        // in reply, and then send that answer. Because these are asynchronous
        // operations, we have a bunch of callbacks.
        var desc = new sessionDescription(payload);
        connection.setRemoteDescription(desc, function() {
            logSuccess("setRemoteDescription from offer");
            // Now that the remote description is set, generate an answer
            connection.createAnswer(function(desc) {
                // The answer description has been created successfully. We
                // set our local description to this value and send it to the
                // caller somehow so they'll use it to set their connection's
                // remote description. As soon as the local description is set,
                // the browser will start talking to the STUN/TURN servers and
                // gather ice candidates.
                connection.setLocalDescription(desc);
                logMessage("<strong>Send this answer to the peer:</strong><br/><code>"+JSON.stringify(desc)+"</code>");
            }, function(e){ logError("createAnswer", e); });
        }, function(e){ logError("setRemoteDescription from offer", e); });
    } else if (payload.sdp && payload.type == "answer") {
        // # Step 5.a (Caller)
        // The remote receiver has sent an answer to us based on our offer from
        // step 3. All that's needed is to set our connection's remote
        // description to whatever it signalled us with.
        // Note: This might trigger the channel opening
        var desc = new sessionDescription(payload);
        connection.setRemoteDescription(desc, 
                function() { logSuccess("setRemoteDescription from answer"); }, 
                function(e){ logError("setRemoteDescription from answer", e); });
    } else if (payload.candidate) {
        // # Step 5.b (Caller)
        // # Step 4 (Receiver)
        // The remote client (either caller or receiver) sent an ice candidate
        // to this client. All that's needed is to add it to our connection.
        // Note: This might trigger the channel opening for the caller
        // Note: This might trigger connection.ondatachannel for the receiver
        var iceCandidate = new RTCIceCandidate(payload);
        connection.addIceCandidate(iceCandidate,
                function() { logSuccess("addIceCandidate"); }, 
                function(e){ logError("addIceCandidate", e); });
    }
}

connection.ondatachannel = function (evt) {
    // # Step 5 (Receiver)
    // The receiver never created a channel until this point. Now that the channel
    // is ready to go, the ondatachannel callback fires with a fresh channel inside
    channel = evt.channel;
    // Define what happens when the channel opens (probably very soon)
    channel.onopen = function() { 
        // # Step 6 (Receiver)
        // The channel is open!!
        logSuccess("channel onopen"); 
    }
    // Define what happens when the channel gets a message (this is the
    // exciting part)
    channel.onmessage = function(evt) {
        // # Step 7.b (Receiver)
        // hooray, we're getting data directly from the remote peer!
        logMessage("<strong>message from the channel: " + evt.data + "</strong>");
    }
};


document.getElementById("chat-button").onclick = function() {
    var message = document.getElementById("chat").value;
    document.getElementById("chat").value = "";

    if (channel == undefined) { 
        logError("chat button", "channel is undefined");
        return;
    } else if (channel.readyState != "open") {
        logError("chat button", "channel.readyState == " + channel.readyState);
        return;
    }
    // # Step 7.a (Caller)
    // # Step 7.a (Receiver)
    // How exciting! Send a message directly to the peer
    channel.send(message);
}
