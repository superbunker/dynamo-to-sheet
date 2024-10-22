// Constants
var DYNAMODB_REGION = 'us-east-1'; // e.g., 'us-east-1'
var DYNAMODB_TABLE_NAME = 'YourTableName'; // Your DynamoDB table name

// Helper function to extract value from DynamoDB attribute
function extractDynamoDBValue(attribute) {
  if (!attribute || typeof attribute !== 'object') {
    return attribute;
  }
  
  // Handle different DynamoDB types
  if ('S' in attribute) {
    return attribute.S;  // String
  } else if ('N' in attribute) {
    return Number(attribute.N);  // Number
  } else if ('BOOL' in attribute) {
    return attribute.BOOL;  // Boolean
  } else if ('NULL' in attribute) {
    return null;  // Null
  } else if ('L' in attribute) {
    return attribute.L.map(extractDynamoDBValue);  // List
  } else if ('M' in attribute) {
    let result = {};
    for (let key in attribute.M) {
      result[key] = extractDynamoDBValue(attribute.M[key]);
    }
    return result;  // Map
  } else if ('SS' in attribute) {
    return attribute.SS;  // String Set
  } else if ('NS' in attribute) {
    return attribute.NS.map(Number);  // Number Set
  } else {
    return JSON.stringify(attribute);  // Fallback for unknown types
  }
}

// Fetch DynamoDB data and update the sheet
function updateSheetFromDynamoDB() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var existingData = sheet.getDataRange().getValues();
  
  // If sheet is empty (only has 1 row with no data), get all data
  var isEmptySheet = existingData.length <= 1 && (!existingData[0] || existingData[0].join('').trim() === '');
  
  // Get all DynamoDB data without limits
  var dynamoData = fetchDynamoDBData();
  
  // Convert DynamoDB typed attributes to plain values
  var convertedData = dynamoData.map(function(item) {
    var converted = {};
    for (var key in item) {
      converted[key] = extractDynamoDBValue(item[key]);
    }
    return converted;
  });
  
  if (isEmptySheet) {
    // For empty sheet, create headers and add all data
    if (convertedData.length > 0) {
      // Get all possible column headers from the first item
      var headers = Object.keys(convertedData[0]);
      
      // Write headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format data rows
      var formattedData = convertedData.map(function(item) {
        return headers.map(function(header) {
          var value = item[header];
          return value !== undefined ? value : ''; // Use empty string if property doesn't exist
        });
      });
      
      // Write all data
      if (formattedData.length > 0) {
        sheet.getRange(2, 1, formattedData.length, headers.length).setValues(formattedData);
      }
    }
  } else {
    // For non-empty sheet, append only new data
    var headers = existingData[0];
    
    // Compare and filter new data
    var newData = convertedData.filter(function(item) {
      return !existingData.some(function(existingRow) {
        return existingRow[0] === item.id; // Assuming 'id' is the primary key
      });
    });
    
    // Append new data to the sheet
    if (newData.length > 0) {
      var formattedNewData = newData.map(function(item) {
        return headers.map(function(header) {
          var value = item[header];
          return value !== undefined ? value : ''; // Use empty string if property doesn't exist
        });
      });
      
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, formattedNewData.length, headers.length).setValues(formattedNewData);
    }
  }
}

// Fetch data from DynamoDB using AWS Signature v4
function fetchDynamoDBData() {
  // First, verify AWS credentials are set
  var awsAccessKeyId = PropertiesService.getScriptProperties().getProperty('AWS_ACCESS_KEY_ID');
  var awsSecretAccessKey = PropertiesService.getScriptProperties().getProperty('AWS_SECRET_ACCESS_KEY');
  
  if (!awsAccessKeyId || !awsSecretAccessKey) {
    throw new Error('AWS credentials not found in Script Properties. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  var awsRegion = DYNAMODB_REGION;
  var service = 'dynamodb';
  var host = 'dynamodb.' + awsRegion + '.amazonaws.com';
  var endpoint = 'https://' + host + '/';
  
  // Get current time in ISO format
  var date = new Date();
  var amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  var dateStamp = amzDate.slice(0, 8);

  var body = JSON.stringify({
    TableName: DYNAMODB_TABLE_NAME
  });

  var method = 'POST';
  var canonicalUri = '/';
  var canonicalQueryString = '';
  var canonicalHeaders = 'content-type:application/x-amz-json-1.0\n' +
                        'host:' + host + '\n' +
                        'x-amz-date:' + amzDate + '\n' +
                        'x-amz-target:DynamoDB_20120810.Scan\n';
  
  var signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  var payloadHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, body)
    .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
    .join('');

  var canonicalRequest = method + '\n' +
                        canonicalUri + '\n' +
                        canonicalQueryString + '\n' +
                        canonicalHeaders + '\n' +
                        signedHeaders + '\n' +
                        payloadHash;

  var algorithm = 'AWS4-HMAC-SHA256';
  var credentialScope = dateStamp + '/' + awsRegion + '/' + service + '/aws4_request';
  var stringToSign = algorithm + '\n' +
                     amzDate + '\n' +
                     credentialScope + '\n' +
                     Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonicalRequest)
                       .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
                       .join('');

  var signingKey = getSignatureKey(awsSecretAccessKey, dateStamp, awsRegion, service);
  var signature = Utilities.computeHmacSha256Signature(Utilities.newBlob(stringToSign).getBytes(), signingKey)
    .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
    .join('');

  var authorizationHeader = algorithm + ' ' +
                           'Credential=' + awsAccessKeyId + '/' + credentialScope + ', ' +
                           'SignedHeaders=' + signedHeaders + ', ' +
                           'Signature=' + signature;

  var headers = {
    'Authorization': authorizationHeader,
    'x-amz-date': amzDate,
    'x-amz-target': 'DynamoDB_20120810.Scan',
    'content-type': 'application/x-amz-json-1.0'
  };

  var options = {
    method: 'post',
    contentType: 'application/x-amz-json-1.0',
    headers: headers,
    payload: body,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(endpoint, options);
  
  if (response.getResponseCode() !== 200) {
    console.error('Full response:', response.getContentText());
    throw new Error('DynamoDB request failed: ' + response.getContentText());
  }
  
  var result = JSON.parse(response.getContentText());
  return result.Items || [];
}

// Helper function to generate AWS signature key
function getSignatureKey(key, dateStamp, regionName, serviceName) {
  var kSecret = 'AWS4' + key;
  var kDate = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(dateStamp).getBytes(),
    Utilities.newBlob(kSecret).getBytes()
  );
  var kRegion = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(regionName).getBytes(),
    kDate
  );
  var kService = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(serviceName).getBytes(),
    kRegion
  );
  var kSigning = Utilities.computeHmacSha256Signature(
    Utilities.newBlob('aws4_request').getBytes(),
    kService
  );
  return kSigning;
}
