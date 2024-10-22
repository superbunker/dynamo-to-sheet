# dynamo-to-sheet

This Google Apps Script allows you to synchronize data from an Amazon DynamoDB table to a Google Sheet. The script performs a full scan of your DynamoDB table and either creates a new sheet with all the data or appends new records to an existing sheet.

## Features

- Automatically creates headers based on DynamoDB attributes
- Handles all DynamoDB data types (String, Number, Boolean, NULL, List, Map, String Set, Number Set)
- Supports incremental updates to existing sheets
- Uses AWS Signature Version 4 for authentication
- Maintains data type integrity during transfer

## Prerequisites

1. An AWS account with access to DynamoDB
2. AWS credentials (Access Key ID and Secret Access Key) with appropriate permissions
3. A Google Sheet where you want to store the data
4. Google Apps Script editor access

## Installation

1. Open your Google Sheet
2. Go to Extensions > Apps Script
3. Delete any code in the script editor
4. Copy and paste the entire script into the editor
5. Save the project (File > Save)

## Configuration

1. Set up AWS credentials:
   - In the Apps Script editor, go to Project Settings (gear icon)
   - Click on "Script Properties"
   - Add the following properties:
     - `AWS_ACCESS_KEY_ID`: Your AWS access key ID
     - `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key

2. Update the constants at the top of the script:
   ```javascript
   var DYNAMODB_REGION = 'us-east-1';  // Change to your AWS region
   var DYNAMODB_TABLE_NAME = 'User';    // Change to your table name
   ```

## Usage

### Manual Execution
1. After setting up the script, click on "Select function" in the toolbar
2. Select `updateSheetFromDynamoDB`
3. Click the Run button (play icon)

### Automatic Sync
To set up automatic synchronization:

1. In the Apps Script editor, click on Triggers (clock icon)
2. Click "Add Trigger"
3. Configure the trigger:
   - Choose function: `updateSheetFromDynamoDB`
   - Event source: "Time-driven"
   - Select your desired frequency

## Data Handling

### Empty Sheet
- If the sheet is empty, the script will:
  1. Create headers based on the attributes of the first DynamoDB item
  2. Populate all data from the DynamoDB table

### Existing Sheet
- If the sheet already contains data, the script will:
  1. Use existing headers
  2. Compare new data with existing records (using 'id' as the primary key)
  3. Append only new records to the bottom of the sheet

## Security Considerations

- Store AWS credentials securely in Script Properties, never in the code
- Use AWS IAM roles with minimal required permissions
- Consider implementing additional error handling for production use
- Be mindful of DynamoDB read capacity units when setting sync frequency

## Troubleshooting

If you encounter errors:

1. Check AWS credentials in Script Properties
2. Verify AWS region and table name are correct
3. Ensure AWS IAM permissions include DynamoDB Scan operations
4. Check the Apps Script execution logs for detailed error messages
5. Verify your DynamoDB table has an 'id' field if you're using incremental updates

## Limitations

- The script performs a full table scan, which may not be optimal for very large tables
- Currently assumes 'id' as the primary key for detecting duplicates
- Maximum execution time is 6 minutes (Google Apps Script limitation)
- Data type conversion may not handle all edge cases

## Contributing

Feel free to modify the script to suit your needs. Consider adding:
- Custom primary key configuration
- Selective column synchronization
- Error logging to a separate sheet
- Custom data type handling

## License

This script is provided as-is under the MIT License. Feel free to modify and distribute as needed.
