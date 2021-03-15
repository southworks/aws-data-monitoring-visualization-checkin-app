'use strict';
var AWS = require("aws-sdk");
const config = require("./../../config.json");

var s3 = new AWS.S3();

exports.handler = (event, context, callback) => {

    let s3Data = '';
    event.Records.forEach((record) => {
        console.log('Stream record: ', JSON.stringify(record, null, 2));

        if (record.eventName == 'INSERT') {
            var userData = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
            s3Data = s3Data + JSON.stringify(userData) + "\n";
        }
    });
    console.log(s3Data);
    var buf = Buffer.from(s3Data);

    var data = {
        Bucket: config.aws.bucketName + '/users',
        Key: 'users-' + Date.now(),
        Body: buf,
        ContentEncoding: 'base64',
        ContentType: 'application/json',
        ACL: 'public-read'
    };

    s3.upload(data, function (err, data) {
        if (err) {
            console.log(err);
            console.log('Error uploading data: ', data);
        } else {
            console.log('succesfully uploaded!!!');
        }
    });

    callback(null, `Successfully processed ${event.Records.length} records.`);
};   