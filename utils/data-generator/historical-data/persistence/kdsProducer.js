const AWS = require('aws-sdk');
const localConfig = require('../../config.json');
const globalConfig = require("../../../../cdk/configParameters.json")

class KdsProducer {
  constructor() {
    this.kinesis = new AWS.Kinesis(
      {
        apiVersion: '2013-12-02',
        region: globalConfig.region,
      });
  }

  async persist(feeling) {
    let params = {
      Data: feeling,
      PartitionKey: 'partitionKey-1',
      StreamName: `${globalConfig.resourcesPrefix}-${localConfig.sentimentResultStreamName}`
    };

    try {
      let result = this.kinesis.putRecord(params).promise();
      await result;
      console.log("putRecord result: ", result);
      return result;
    } catch (err) {
      console.log(`Error sending result to KDS ${err}`);
    }
  }
}

module.exports = KdsProducer;