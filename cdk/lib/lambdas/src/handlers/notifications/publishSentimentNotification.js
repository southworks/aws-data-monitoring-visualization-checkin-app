const AWS = require("aws-sdk");
const config = require("./../../config.json");

const sns = new AWS.SNS();

exports.handler = async (event) => {
  console.log("SentimentAlert: ", event);

  var params = {
    Message: "Hello " + event.Payload.userData.firstName + ", We detect that in the past 1 hour you sent " + (event.Payload.analysisData.numericSentiment * -1) + " or more negative messages than positive messages.",
    TopicArn: config.aws.SNS.topicArn,
  };

  await sns.publish(params).promise();
};
