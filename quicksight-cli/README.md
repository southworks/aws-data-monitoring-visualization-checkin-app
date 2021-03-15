# Quicksight Deployment using CLI
In this guide we will explain how to create data-sources, data-sets, templates from analysis and dashboards from said templates. To perform these actions, we must make sure the following files are in the same directory: [create-data-source-cli-input.json](./create-data-source-cli-input.json), [create-data-set-cli-input.json](./create-data-set-cli-input.json), [create-template-cli-input.json ](create-template-cli-input.json), [create-dashboard-cli-input.json](create-dashboard-cli-input.json) and [create-data-set-demographic-cli-input.json](create-data-set-demographic-cli-input.json).

## Set up AWS CLI
The first and most important step is to have the AWS CLI correctly set up in your machine. To do so, please install it with the link that better suits your system from [here](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html).

After doing so, you should set up your credentials with [this](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html) guide.

NOTE: Please consider the region you will be working in. Every resource in this guide requires to have the same region. If they are not created in the same region, you will have to modify the files region yourself.

## Create the data-source
The data-source is the specification of where we are going to get our data from. To create it from the CLI, we need a JSON file with all the required specifications as an input, and that file is [create-data-source-cli-input.json](./create-data-source-cli-input.json). 

Now, a data source can be chosen from a variety of different services:
- "ADOBE_ANALYTICS"
- "AMAZON_ELASTICSEARCH"
- "ATHENA"
- "AURORA"
- "AURORA_POSTGRESQL"
- "AWS_IOT_ANALYTICS"
- "GITHUB"
- "JIRA"
- "MARIADB"
- "MYSQL"
- "ORACLE"
- "POSTGRESQL"
- "PRESTO"
- "REDSHIFT"
- "S3"
- "SALESFORCE"
- "SERVICENOW"
- "SNOWFLAKE"
- "SPARK"
- "SQLSERVER"
- "TERADATA"
- "TWITTER"
- "TIMESTREAM"

For our use case, we will use ATHENA as we source our data from an AWSDataCatalog created there.

There will be some entries that you will have to modify or add. 

The first one being:

`"AwsAccountId": "xxxxxxxxxxxx"`

Here you should replace the `"xxxxxxxxxxxx"` with the account ID where you have deployed the CDK.

The other value you must modify is under the Permissions list, and looks like this:

`"Principal": "arn:aws:quicksight:us-east-1:xxxxxxxxxxxx:user/default/<USER_NAME>"`

Here you must modify `<USER_NAME>` for a user name that exists in your Quicksight subscription.

After performing this modifications, you should open your prefered terminal and get to the directory where you saved the modified JSON file. Once you are in the correct directory, run the following command:

`aws quicksight create-data-source --cli-input-json file://./create-data-source-cli-input.json`

If you do not know how to open a terminal in the JSON file's directory, then you can simply alter the above command and add the full path to the file:

`aws quicksight create-data-source --cli-input-json file://<PATH_TO_FILE>/create-data-source-cli-input.json`

After successfully running the command, you should see something that looks like the following output in your terminal:

    "Status": 202,
    "Arn": "arn:aws:quicksight:us-east-1:xxxxxxxxxxxx:datasource/APIDataSourceTest",
    "DataSourceId": "APIDataSourceTest",
    "CreationStatus": "CREATION_IN_PROGRESS",
    "RequestId": "ac9fb8fe-71d8-4005-a7c9-d66d814e224e"

Before moving on, please check that the data source was correctly created by running the command

`aws quicksight describe-data-source --aws-account-id <ACCOUNT_ID> --data-source-id SamarkandDataSource`

If everything is correct, you should be able to see something like this

    "Status": 200,
    "DataSource": {
        "Arn": "arn:aws:quicksight:us-east-1:xxxxxxxxxxxx:datasource/APIDataSourceTest",
        "DataSourceId": "APIDataSourceTest",
        "Name": "API Data Source Test",
        "Type": "ATHENA",
        "Status": "CREATION_SUCCESSFUL",
        "CreatedTime": 1574053515.41,
        "LastUpdatedTime": 1574053516.368,
        "DataSourceParameters": {
            "AthenaParameters": {
                "WorkGroup": "primary"
            }
        },
    },
    "RequestId": "57d2d6d6-ebbf-4e8c-82ab-c38935cae8aa"

## Create the data-set
The creation of the data-set is more or like the same:
- First modify any `xxxxxxxxxxxx` you find in the JSON file for your account ID
- Then you should look for line 10: 

    `"SELECT userid, lexresult.payload.intentname AS analysisResult, recognizedby, inputtext, datetime, audioUrl FROM '<resourcesPrefix>-athenaCatalog'.'<resourcesPrefix>-database'.'<resourcesPrefix>_bucket'`
    
    Here you must change the `<resourcesPrefix>` for the name of the prefix that you chose.

- Then in line 48:

    `"Principal": "arn:aws:quicksight:us-east-1:xxxxxxxxxxxx:user/default/<USER_NAME>",`

    As done before, change the `xxxxxxxxxxxx` for your account ID and the `<USER_NAME>` for the same username present on your Quicksight account that you used to create the data-source.

- Finally, do the same with the `create-data-set-sentiment-cli-input.json`, `create-data-set-user-cli-input.json` and `create-data-set-demographic-cli-input.json`

After having the JSON file modified to fit your needs, run the following command:

`aws quicksight create-data-set --cli-input-json file://./create-data-set-sentiment-cli-input.json`
`aws quicksight create-data-set --cli-input-json file://./create-data-set-user-cli-input.json`
`aws quicksight create-data-set --cli-input-json file://./create-data-set-demographic-cli-input.json`

To check if the data-set was correctly created, run:

`aws quicksight describe-data-set --aws-account-id <ACCOUNT_ID> --data-set-id DemoDataSet1`

## Analysis template creation
After creating the data-source and data-set we can start creating an analysis based on the data-set itself, but that must be performed manually in the Quicksight application. Once it is created though, we can create a template from it, and use said template to create dashboards across different accounts.

To create said template, all we have to do is to modify the [create-template-cli-input.json](create-template-cli-input.json) just as we were modifying the previous ones, with the addition of changing `<ANALYSIS_ID>`, found in line 7, for the ID of the analysis you want to create a template from. (To find this ID, the easiest way is to open the analysis in quicksight, and then look at the final sequence of characters in the URL).

After having the JSON file modified, please run the following command:

`aws quicksight create-template --cli-input-json file://./create-template-cli-input.json`

And to check if the template was correctly created, run:

`aws quicksight describe-template --aws-account-id <ACCOUNT_ID> --template-id DemoAnalysisTemplate`

## Dashboard creation from template
To create a dashboard from an analysis template is almost the same process, first refer to the JSON file ([create-dashboard-cli-input.json](create-dashboard-cli-input.json)) and change any ocurrences of `xxxxxxxxxxxx` (Lines 2, 7, 25 and 28) for your account ID, and then change `<USER_NAME>` (Line 7) for the same user name present on your Quicksight account that you have been using up until this point.

After modifying the JSON file, please run the command:

`aws quicksight create-dashboard --cli-input-json file://./create-dashboard-cli-input.json`

and to check if the dashboard was correctly created, run: 

`aws quicksight describe-dashboard --aws-account-id <ACCOUNT_ID> --dashboard-id DemoDashboard1`

This will create a dashboard from the analysis that has been specified in the [create-dashboard-cli-input.json](create-dashboard-cli-input.json) file and you will now be able to share or print said dashboard.
