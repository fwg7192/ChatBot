var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
var bot = new builder.UniversalBot(connector); 
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')

bot.dialog('/',[

	function(session){
	session.send("Hello There");
	builder.Prompts.text(session,'What is your Name?');
},
	function(session,results){
		session.send('Hello ' + results.response + '! How may I help?');
	}
]);