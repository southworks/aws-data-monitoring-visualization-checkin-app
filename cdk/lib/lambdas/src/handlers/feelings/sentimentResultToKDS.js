const AWS = require("aws-sdk");
const config = require("./../../config.json");

const kinesis = new AWS.Kinesis();

exports.handler = async (event) => {
  console.log("SentimentResult: ", event);
  event.dateTime = Date.now();
  var params = {
    Data: JSON.stringify(event) + "\n", /* required */
    PartitionKey: 'partitionKey-1', /* required */
    StreamName: config.aws.KDS.sentimentResult, /* required */
  };
  try {
    var result = await kinesis.putRecord(params).promise();
    console.log("Lambdaresult: ", result);
  } catch (err) {
    console.log(`Error sending result to KDS ${err}`);
  }
};
