"use strict";

const AWS = require("aws-sdk");
const config = require("./../../config.json");

module.exports.handler = async (event) => {

  let docClient = new AWS.DynamoDB.DocumentClient();

  async function create(item, tableName) {
    let ResourceParams = {
      TableName: tableName,
      Item: item
    };
    try {
      return docClient.put(ResourceParams).promise().then(
        res => ({
          "Status ": res.$response.httpResponse.statusCode
        }),
        err => err
      );
    } catch (err) {
      return err;
    }
  }

  for (let i = 0; i < event.Records.length; i++) {

    let payload = Buffer.from(event.Records[i].kinesis.data, 'base64').toString('ascii');
    payload = JSON.parse(payload);
    let feeling = {
      id: payload.id,
      dateTime: payload.dateTime,
      audioUrl: payload.audioUrl,
      message: payload.inputText,
      recognizedBy: payload.recognizedBy,
      userId: payload.userId,
      sentiment: payload.lexResult.Payload.intentName,
      country: payload.location.country,
      latitude: payload.location.latitude,
      longitude: payload.location.longitude
    };

    let persistenceResponse = await create(feeling, config.aws.dynamoDB.feelingTable.name);
    console.log(persistenceResponse);
  }
};