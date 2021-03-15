const AWS = require("aws-sdk");
const config = require("./../../config.json");

exports.handler = async (event) => {
  // Set the region
  AWS.config.update({ region: 'us-east-1' });

  console.log(event);

  var templateData = {
    name: event.Payload.userData.firstName,
    negativeCount: (event.Payload.analysisData.numericSentiment * -1),
    inputText: event.Payload.analysisData.inputText.join("</br>")
  };

  console.log(templateData)
  var params = {
    Destination: { /* required */
      ToAddresses: [
        config.aws.SNS.emailSubscription
      ]
    },
    Source: config.aws.SNS.emailSubscription, /* required */
    Template: config.aws.SES.sesNotificationsTemplateName, /* required */
    TemplateData: JSON.stringify(templateData) /* required */
  };

  console.log(params)
  let ses = new AWS.SES();
  try {
    let result = await ses.sendTemplatedEmail(params).promise();
    return result;
  } catch (e) {
    console.log(e);
  }

};



