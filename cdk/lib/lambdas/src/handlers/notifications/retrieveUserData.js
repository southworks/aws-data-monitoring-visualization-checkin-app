const AWS = require('aws-sdk');
const config = require("./../../config.json");

exports.handler = async (event) => {
  console.log(event)
  this.dynamoDb = new AWS.DynamoDB();

  var paramsUser = {
    Key: {
      "id": { S: event.userId }
    },
    TableName: config.aws.dynamoDB.userTable.name
  };

  let data = await this.dynamoDb.getItem(paramsUser).promise();
  var userData = AWS.DynamoDB.Converter.unmarshall(data.Item);
  let response = {};
  let today = new Date().setHours(0, 0, 0, 0);
  let notificationDateTime = new Date(parseInt(userData.notificationDateTime)).setHours(0, 0, 0, 0);
  if (userData.notificationDateTime == "" || today != notificationDateTime) {
    userData.notificationDateTime = "";

    let paramsUpdateUser = {
      ExpressionAttributeNames: {
        "#ND": "notificationDateTime"
      },
      ExpressionAttributeValues: {
        ":n": {
          S: Date.now().toString()
        }
      },
      Key: {
        "id": { S: event.userId }
      },
      ReturnValues: "ALL_NEW",
      TableName: config.aws.dynamoDB.userTable.name,
      UpdateExpression: "SET #ND = :n"
    };
    let updateResult = await this.dynamoDb.updateItem(paramsUpdateUser).promise();

    var paramsMessage = {
      ExpressionAttributeValues: {
        ":u": {
          S: event.userId
        }
      },
      FilterExpression: "userId = :u",
      TableName: config.aws.dynamoDB.feelingTable.name
    };
    let messages = await this.dynamoDb.scan(paramsMessage).promise();
    let inputText = []
    for (var i = 0; i < messages.Items.length; i++) {
      var message = AWS.DynamoDB.Converter.unmarshall(messages.Items[i]);
      if ((Date.now() - 60 * 60000) < message.dateTime) {
        console.log(message.message);
        inputText.push(message.message);
      }
    }
    console.log(inputText[0]);
    event.inputText = inputText;
    response = {
      userData: userData,
      analysisData: event
    };
  } else {
    response = {
      userData: userData,
      analysisData: event
    };
  }

  return response;
};
