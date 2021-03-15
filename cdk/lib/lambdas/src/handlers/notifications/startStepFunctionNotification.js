const AWS = require("aws-sdk");

exports.handler = async (event) => {
    console.log(`Recieved record: ${JSON.stringify(event)}`);

    var params = {
        stateMachineArn: process.env.STEP_FUNCTION_ARN,
    };

    const stepFunctions = new AWS.StepFunctions();

    for (var i = 0; i < event.Records.length; i++) {
        const record = event.Records[i];
        // Kinesis data is base64 encoded so decode here
        console.log(`record: ${record.kinesis}`);
        const payload = Buffer.from(record.kinesis.data, "base64").toString();
        console.log(`payload: ${payload}`);
        params.input = JSON.stringify(JSON.parse(payload));
        console.log(JSON.parse(payload));

        const sf = await stepFunctions.startExecution(params).promise();
        console.log(`sf: ${JSON.stringify(sf)}`);
    }

};