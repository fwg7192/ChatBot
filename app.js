/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
var tableStorage2 = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.


var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('Sorry we cannot understand what you are sag, please try again.', session.message.text);
    
});
bot.set('storage', tableStorage2);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 


// This dialog helps the user to determine what papers to take for the given major
var inMemoryStorage = new builder.MemoryBotStorage();
// This is a dinner reservation bot that uses multiple dialogs to prompt users for input.
var bot1 = new builder.UniversalBot(connector, [
    
    function (session) {
        bot1.recognizer(recognizer);
        session.send("Hi there to determine what major you should do, you will need to answer a few questions");
        session.beginDialog('askForWhatPaper');
    },
    function (session, results) {
        session.dialogData.paperChoice = results.response;
        session.beginDialog('askForSemester');
    },
    function (session, results) {
        session.dialogData.semester = results.response;
        session.beginDialog('askForStudyTime');
    },
    function (session, results) { 
        session.dialogData.studyTime = results.response;

        // Process request and display reservation details
        session.send(`Major confirmed. Major details: <br/>Paper: ${session.dialogData.paperChoice} <br/>Semester: ${session.dialogData.semester} <br/>Study Time: ${session.dialogData.studyTime}`);
        session.endDialog();
    }
]).set('storage', tableStorage);

// Dialog to ask for a date and time
bot1.dialog('askForWhatPaper', [
    function (session) {
        builder.Prompts.text(session, "What paper are you interested in taking?");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
])

// Dialog to ask for number of people in the party
bot1.dialog('askForSemester', [
    function (session) {
        builder.Prompts.text(session, "What semester will you be taking this in? e.g 1 or 2");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
])

// Dialog to ask for the reservation name.
bot1.dialog('askForStudyTime', [
    function (session) {
        builder.Prompts.text(session, "Will you be studying full time or part time? e.g full time");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]).triggerAction({
    matches: 'StudyTime'
})

// The dialog stack is cleared and this dialog is invoked when the user enters 'help'.
bot1.dialog('help', function (session, args, next){
    
    session.endDialog("This is a bot that can help with university pre-requisites and co-requisites. <br/>Please say 'next' to continue");

}).triggerAction({
    matches: 'Help',
    onSelectAction: (session, args) => {
        session.beginDialog(args.action, args);
    }
});

bot.dialog('GreetingDialog',
    (session) => {
        session.send('Hi there how can I help today?');
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})


bot1.dialog('HelpDialog',
    (session) => {
        session.send('You reached the Help intent. You said \'%s\'.', session.message.text);
        
        session.endDialog();
    } 
).triggerAction({
    matches: 'Help'
})

bot1.dialog('CancelDialog',
    (session) => {
        session.send('You reached the Cancel intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Cancel'
});
