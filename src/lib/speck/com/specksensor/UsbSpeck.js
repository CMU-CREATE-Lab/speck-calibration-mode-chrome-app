//======================================================================================================================
//
// Class for communicating with a USB Speck particle sensor.
//
// Author: Chris Bartley (bartley@cmu.edu)
//======================================================================================================================

//======================================================================================================================
// VERIFY NAMESPACE
//======================================================================================================================
// Create the global symbol "com" if it doesn't exist.  Throw an error if it does exist but is not an object.
var com;
if (!com) {
   com = {};
}
else {
   if (typeof com != "object") {
      var comExistsMessage = "Error: failed to create com namespace: com already exists and is not an object";
      alert(comExistsMessage);
      throw new Error(comExistsMessage);
   }
}

// Repeat the creation and type-checking for the next level
if (!com.specksensor) {
   com.specksensor = {};
}
else {
   if (typeof com.specksensor != "object") {
      var comSpecksensorExistsMessage = "Error: failed to create com.specksensor namespace: com.specksensor already exists and is not an object";
      alert(comSpecksensorExistsMessage);
      throw new Error(comSpecksensorExistsMessage);
   }
}
//======================================================================================================================

//======================================================================================================================
// DEPENDECIES
//======================================================================================================================
if (!window['_']) {
   var noNimbleMsg = "The Nimble library is required by com.specksensor.UsbSpeck.js";
   console.log(noNimbleMsg);
   throw new Error(noNimbleMsg);
}
if (!com.specksensor.Speck) {
   var noComSpecksensorSpeckMsg = "The com.specksensor.Speck library is required by com.specksensor.UsbSpeck.js";
   alert(noComSpecksensorSpeckMsg);
   throw new Error(noComSpecksensorSpeckMsg);
}
//======================================================================================================================

//======================================================================================================================
// CODE
//======================================================================================================================
(function() {
   var HID_REPORT_LENGTH_IN_BYTES = 16;

   var DEFAULT_LOGGING_INTERVAL = 1;       // for Specks which can't change the logging interval, it's hardcoded to 1 second

   // Constants for Info command
   var GET_EXTENDED_INFO_COMMAND_CHARACTER = "i";
   var SERIAL_NUMBER_STARTING_BYTE_INDEX = 1;
   var SERIAL_NUMBER_BYTE_ENDING_BYTE_INDEX_PROTOCOL_1_AND_2 = 10;
   var SERIAL_NUMBER_BYTE_ENDING_BYTE_INDEX_PROTOCOL_3 = 8;
   var HARDWARE_VERSION_BYTE_INDEX = 10;
   var PROTOCOL_VERSION_BYTE_INDEX = 11;
   var LOGGING_INTERVAL_BYTE_INDEX_WHEN_READING = 12;
   var LOGGING_INTERVAL_BYTE_INDEX_WHEN_WRITING = 5;
   var FIRMWARE_VERSION_BYTE_INDEX = 13;

   // Constants for Get Data Sample command
   var SAMPLE_TIME_SECS_BYTE_INDEX = 1;
   var PARTICLE_COUNT_OR_CONCENTRATION_BYTE_INDEX = 5;
   var TEMPERATURE_BYTE_INDEX = 9;
   var HUMIDITY_BYTE_INDEX = 11;
   var RAW_PARTICLE_COUNT_BYTE_INDEX = 12;

   // Byte indices for Delete Sample command
   var DELETE_SAMPLE_AT_TIME_BYTE_INDEX = 5;
   var DELETE_SAMPLE_RESULT_BYTE_INDEX = 5;

   // syntactic sugar
   var Speck = com.specksensor.Speck;

   com.specksensor.UsbSpeck = function(deviceInfo) {
      Speck.call(this, deviceInfo, HID_REPORT_LENGTH_IN_BYTES);
      var self = this;

      // ---------------------------------------------------------------------------------------------------------------
      // Public Methods
      // ---------------------------------------------------------------------------------------------------------------

      // ---------------------------------------------------------------------------------------------------------------
      // Implementations of Abstract Superclass Methods
      // ---------------------------------------------------------------------------------------------------------------

      this.__readSpeckConfigFromDevice = function(callback) {
         //console.log("DEBUG: __readSpeckConfigFromDevice(): querying hardware for speck config");
         getBasicSpeckConfig(function(err, config) {
            if (err) {
               return callback(err, null);
            }

            if (config.protocolVersion < 3) {
               return callback(null, config);
            }

            //console.log("DEBUG: __readSpeckConfigFromDevice(): need to get extended Speck config");
            getExtendedSpeckConfig(function(err2, extendedConfig) {
               if (err2) {
                  return callback(err2, null);
               }

               //console.log("DEBUG: __readSpeckConfigFromDevice(): id was [" + config.id + "]");
               config.id = config.id + extendedConfig.id;
               //console.log("DEBUG: __readSpeckConfigFromDevice(): id is now [" + config.id + "]");

               // hard code the color palette and scale, since USB specks don't report them or support changing them
               config.colorPalette = {
                  "name" : "Legacy",
                  "id" : null
               };
               config.scale = {
                  "name" : "Legacy Concentration",
                  "abbreviation" : "",
                  "id" : null
               };
               callback(null, config);
            });
         });
      };

      this.__getDataSample = function(commandCharacter, callback) {
         var command = self._createCommand(commandCharacter);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: __getDataSample(): failed to get data sample: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  var sampleTimeSecs = data.readUint32(SAMPLE_TIME_SECS_BYTE_INDEX);

                  // see whether any data was actually returned (sample time should never be 0)
                  var isDataAvailable = sampleTimeSecs > 0;

                  // build the return object
                  var obj = null;
                  if (isDataAvailable) {
                     obj = {
                        sampleTimeSecs : sampleTimeSecs,
                        rawParticleCount : data.readUint16(RAW_PARTICLE_COUNT_BYTE_INDEX)
                     };

                     if (self.getApiSupport().hasHumiditySensor()) {
                        obj['humidity'] = data.readUint8(HUMIDITY_BYTE_INDEX);
                     }

                     // temperature was only included in protocol version 1
                     if (self.getApiSupport().hasTemperatureSensor()) {
                        // TODO: test this...do I need to divide this value by 10?
                        obj['temperature'] = data.readUint16(TEMPERATURE_BYTE_INDEX);
                     }

                     // add the particleCount or particleConcentration field, depending on the protocol version.
                     var particleCountOrConcentration = data.readUint32(PARTICLE_COUNT_OR_CONCENTRATION_BYTE_INDEX);
                     if (self.getApiSupport().hasParticleCount()) {
                        obj['particleCount'] = particleCountOrConcentration;
                     }
                     else {
                        obj['particleConcentration'] = particleCountOrConcentration / 10.0;
                     }
                  }

                  // return null if no data is available
                  callback(null, obj);
               }
               else {
                  console.log("ERROR: __getDataSample(): no data in the response!");
                  callback(new Error("No data in the response"), null);
               }
            }
         });
      };

      this.__setLoggingInterval = function(loggingIntervalInSeconds, callback) {
         var command = self._createCommand(Speck.SET_LOGGING_INTERVAL_COMMAND_CHARACTER);
         command.writeUint8(loggingIntervalInSeconds, LOGGING_INTERVAL_BYTE_INDEX_WHEN_WRITING);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: __setLoggingInterval(): failed to write logging interval: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  // read the value returned from the Speck and make sure it matches the value we asked for
                  var actualLoggingInterval = data.readUint8(LOGGING_INTERVAL_BYTE_INDEX_WHEN_READING);
                  var wasSuccessful = loggingIntervalInSeconds == actualLoggingInterval;
                  if (!wasSuccessful) {
                     console.log("ERROR: __setLoggingInterval(): failed to set logging interval. Expected [" + loggingIntervalInSeconds + "], but received [" + actualLoggingInterval + "]");
                  }
                  callback(null, wasSuccessful);
               }
               else {
                  console.log("ERROR: __setLoggingInterval(): no data in the response!");
                  callback(null, false);
               }
            }
         });
      };

      this.__deleteSample = function(sampleTimestampInSecs, callback) {
         var command = self._createCommand(Speck.DELETE_SAMPLE_COMMAND_CHARACTER);
         command.writeUint32(sampleTimestampInSecs, DELETE_SAMPLE_AT_TIME_BYTE_INDEX);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: __deleteSample(): failed to delete sample at time [" + sampleTimestampInSecs + "]: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  callback(null, data.readUint8(DELETE_SAMPLE_RESULT_BYTE_INDEX) == 1);
               }
               else {
                  console.log("ERROR: __deleteSample(): no data in the response!");
                  callback(null, false);
               }
            }
         });
      };

      // ---------------------------------------------------------------------------------------------------------------
      // Private Methods
      // ---------------------------------------------------------------------------------------------------------------

      var getBasicSpeckConfig = function(callback) {
         var command = self._createCommand(Speck.GET_INFO_COMMAND_CHARACTER);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: getBasicSpeckConfig(): failed to get Speck config: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  // First, get the protocol version number
                  var protocolVersion = data.readUint8(PROTOCOL_VERSION_BYTE_INDEX);

                  // Protocol 1 and 2 have a 10-byte serial number.  Protocol three has a 16-byte serial number, split
                  // into two groups of 8.  One here, and the other in the 'i' command.
                  var serialNumberEndingByteIndex = (protocolVersion < 3) ?
                                                    SERIAL_NUMBER_BYTE_ENDING_BYTE_INDEX_PROTOCOL_1_AND_2 :
                                                    SERIAL_NUMBER_BYTE_ENDING_BYTE_INDEX_PROTOCOL_3;

                  // Construct the serial number by convert the data buffer to a hex string and then calling slice on
                  // it to pick out just the bytes which make up the serial number.
                  var serialNumber = data.toHex().slice(2 * SERIAL_NUMBER_STARTING_BYTE_INDEX, 2 * (serialNumberEndingByteIndex + 1));

                  // build the return object
                  var obj = {
                     id : serialNumber,
                     protocolVersion : protocolVersion,
                     loggingIntervalSecs : data.readUint8(LOGGING_INTERVAL_BYTE_INDEX_WHEN_READING)
                  };

                  // Logging interval was introduced in protocol version 2. In prior versions, it was hardcoded to 1 second
                  if (protocolVersion < 2) {
                     obj.loggingIntervalSecs = DEFAULT_LOGGING_INTERVAL;
                  }

                  // Protocol 3 introduced hardware and firmware version
                  if (protocolVersion >= 3) {
                     obj.firmwareVersion = data.readUint8(FIRMWARE_VERSION_BYTE_INDEX);
                     obj.hardwareVersion = data.readUint8(HARDWARE_VERSION_BYTE_INDEX);
                  }

                  callback(null, obj);
               }
               else {
                  console.log("ERROR: getBasicSpeckConfig(): no data in the response!");
                  callback(null, null);
               }
            }
         });
      };

      var getExtendedSpeckConfig = function(callback) {
         var command = self._createCommand(GET_EXTENDED_INFO_COMMAND_CHARACTER);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: getExtendedSpeckConfig(): failed to get extended Speck config: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  // Construct the serial number suffix by convert the data buffer to a hex string and then calling
                  // slice on it to pick out just the bytes which make up the serial number.
                  var serialNumberSuffix = data.toHex().slice(2 * SERIAL_NUMBER_STARTING_BYTE_INDEX, 2 * (SERIAL_NUMBER_BYTE_ENDING_BYTE_INDEX_PROTOCOL_3 + 1));

                  callback(null, { id : serialNumberSuffix });
               }
               else {
                  console.log("ERROR: getExtendedSpeckConfig(): no data in the response!");
                  callback(null, null);
               }
            }
         });
      };

   };

   // ------------------------------------------------------------------------------------------------------------------
   // Static Properties
   // ------------------------------------------------------------------------------------------------------------------
   com.specksensor.UsbSpeck.prototype = Object.create(Speck.prototype);
   com.specksensor.UsbSpeck.USB = Object.freeze({ "vendorId" : 0x2354, "productId" : 0x3333 });
})();