//======================================================================================================================
//
// Class for communicating with a Speck particle sensor.
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
   var noNimbleMsg = "The Nimble library is required by com.specksensor.Speck.js";
   console.log(noNimbleMsg);
   throw new Error(noNimbleMsg);
}
if (!window['dcodeIO'] || !window['dcodeIO']['ByteBuffer']) {
   var noByteBufferMsg = "The ByteBuffer library is required by com.specksensor.Speck.js";
   console.log(noByteBufferMsg);
   throw new Error(noByteBufferMsg);
}
//======================================================================================================================

//======================================================================================================================
// CODE
//======================================================================================================================
(function() {

   // Returns a random integer between min (included) and max (excluded)
   // Using Math.round() will give you a non-uniform distribution!
   // Got this from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
   var getRandomInt = function(min, max) {
      return Math.floor(Math.random() * (max - min)) + min;
   };

   var cloneObject = function(obj) {
      return JSON.parse(JSON.stringify(obj));
   };

   // ==================================================================================================================
   // Speck
   // ==================================================================================================================

   com.specksensor.Speck = function(deviceInfo, hidReportLengthInBytes) {
      var self = this;

      var IS_TRACE_LOGGING_ENABLED = false;

      // Length of an HID report
      var HID_REPORT_LENGTH_IN_BYTES = hidReportLengthInBytes;

      // The USB Report ID
      var REPORT_ID = 0;

      // Array index in the data byte array containing the checksum byte
      var CHECKSUM_BYTE_INDEX = HID_REPORT_LENGTH_IN_BYTES - 2;

      // Array index in the data byte array containing the command ID byte
      var COMMAND_ID_BYTE_INDEX = HID_REPORT_LENGTH_IN_BYTES - 1;

      // Constants for Num Samples command
      var NUM_SAMPLES_BYTE_INDEX = 1;

      var MIN_LOGGING_INTERVAL = 1;
      var MAX_LOGGING_INTERVAL = 255;

      var connection = null;
      var speckConfig = null;
      var commandId = getRandomInt(1, 256);  // start with a random command ID in the range [1,255]
      var commandQueue = [];

      // ---------------------------------------------------------------------------------------------------------------
      // Public Methods
      // ---------------------------------------------------------------------------------------------------------------

      /**
       * Establishes a connection to the Speck hardware.  Does nothing if already {@link Speck#isConnected connected}.
       * Returns a boolean to the <code>callback</code> function specifying whether the connection was successful.
       *
       * @param {function} callback Function with signature <code>callback(err, wasConnectionSuccessful)</code> that will be called upon success or failure.
       * @see {@link Speck#isConnected isConnected}
       */
      this.connect = function(callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            callback(null, true);
         }
         else {
            chrome.hid.connect(deviceInfo['deviceId'],
                               function(theConnection) {
                                  if (chrome.runtime.lastError) {
                                     console.log("ERROR: connect(): Error trying to connect: " + JSON.stringify(chrome.runtime.lastError, null, 3));
                                     return callback(new Error(chrome.runtime.lastError));
                                  }

                                  if (theConnection) {
                                     connection = theConnection;
                                     console.log("DEBUG: connect(): Connected to Speck with device ID [" + deviceInfo['deviceId'] + "]");
                                     self.getSpeckConfig(function(err, config) {
                                        if (err) {
                                           return callback(err, false)
                                        }

                                        console.log("DEBUG: connect(): Speck config: " + JSON.stringify(config, null, 3));
                                        return callback(null, true);
                                     });
                                  }
                                  else {
                                     console.log("INFO: connect(): Connection is null or undefined for device ID [" + deviceInfo['deviceId'] + "]");
                                     callback(null, false);
                                  }
                               });
         }
      };

      this.getHidDeviceInfo = function(){
         return cloneObject(deviceInfo);
      };

      /**
       * Disconnects from the Speck hardware and returns a boolean to the <code>callback</code> function specifying
       * whether the disconnection was successful.  If already {@link Speck#isConnected disconnected}, it will call the
       * callback with a value of <code>true</code>.  To attempt a reconnection, call {@link Speck#connect connect}.
       *
       * @param {function} callback Function with signature <code>callback(err, wasDisconnectionSuccessful)</code> that will be called upon success or failure.
       * @see {@link Speck#isConnected isConnected}
       * @see {@link Speck#connect connect}
       */
      this.disconnect = function(callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            chrome.hid.disconnect(connection['connectionId'],
                                  function() {
                                     if (chrome.runtime.lastError) {
                                        console.log("ERROR: disconnect(): Error trying to disconnect: " + JSON.stringify(chrome.runtime.lastError, null, 3));
                                        return callback(new Error(chrome.runtime.lastError));
                                     }

                                     console.log("DEBUG: disconnect(): Disconnected from Speck with device ID [" + deviceInfo['deviceId'] + "]");

                                     // reset state
                                     connection = null;
                                     speckConfig = null;
                                     commandQueue = [];
                                     return callback(null, true);
                                  });
         }
         else {
            callback(null, true);
         }
      };

      /**
       * Returns <code>true</code> if connected to a Speck, <code>false</code> otherwise.
       *
       * @returns {boolean}
       */
      this.isConnected = function() {
         return connection != null;
      };

      /**
       * <p>
       *    Returns various properties about the currently-connected Speck to the given callback function.  If the
       *    <code>willForceReload</code> argument is <code>false</code> or undefined, this method will return a cached
       *    version.  To force a reload of the Speck's config, set the <code>willForceReload</code> argument to
       *    <code>true</code>.  Note that this method returns a copy of the cached config, so modifications won't have
       *    any effect on the cached version.
       * </p>
       * <p>
       *    The returned data object contains the following fields:
       *    <ul>
       *       <li><code>id</code>: string</li>
       *       <li><code>protocolVersion</code>: integer</li>
       *       <li><code>loggingIntervalSecs</code>: integer</li>
       *       <li><code>firmwareVersion</code>: integer (not present in USBSpecks prior to protocol 3)</li>
       *       <li><code>hardwareVersion</code>: integer (not present in USBSpecks prior to protocol 3)</li>
       *    </ul>
       *    Subclasses may add additional fields.
       * </p>
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, config)</code>
       * @param {boolean} [willForceReload] - whether to force a reload. Treated as <code>false</code> if undefined.
       */
      this.getSpeckConfig = function(callback, willForceReload) {
         self._getSpeckConfig(!!willForceReload, callback);
      };

      this.getApiSupport = function() {
         return {
            canMutateLoggingInterval : function() {
               return speckConfig.protocolVersion >= 2;
            },
            canGetNumberOfDataSamples : function() {
               return speckConfig.protocolVersion >= 2;
            },
            hasTemperatureSensor : function() {
               return speckConfig.protocolVersion <= 1;
            },
            hasHumiditySensor : function() {
               return true;
            },
            hasParticleCount : function() {
               return speckConfig.protocolVersion <= 2;
            },
            hasParticleConcentration : function() {
               return speckConfig.protocolVersion >= 3;
            },
            hasDeviceVersionInfo : function() {
               return speckConfig.protocolVersion >= 3;
            },
            hasExtendedId : function() {
               return speckConfig.protocolVersion >= 3;
            },
            canDeleteAllSamples : function() {
               return false;
            },
            canSelectPalette : function() {
               return false;
            },
            canSelectValueUnits : function() {
               return false;
            },
            hasWifi : function() {
               return false;
            },
            canMutateUploadUrl : function() {
               return false;
            },
            hasCalibrationMode : function() {
               return false;
            }
         };
      };

      /**
       * <p>
       *    Reads the current sample from the Speck and returns the it to the given <code>callback</code>.  The callback
       *    function has a signature of the form <code>callback(err, data)</code>.
       * </p>
       * <p>
       *    The data object will contain some subset (perhaps all) of the following fields:
       *    <ul>
       *       <li><code>sampleTimeSecs</code>: integer</li>
       *       <li><code>particleCount</code>: integer</li>
       *       <li><code>particleConcentration</code>: integer</li>
       *       <li><code>humidity</code>: integer</li>
       *       <li><code>rawParticleCount</code>: integer</li>
       *       <li><code>temperature</code>: integer</li>
       *    </ul>
       * </p>
       * <p>
       *    Exactly which fields are included depends on the Speck's hardware, firmware, and protocol versions.
       * </p>
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, data)</code>
       */
      this.getCurrentSample = function(callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            self.__getDataSample(com.specksensor.Speck.GET_CURRENT_SAMPLE_COMMAND_CHARACTER, callback);
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * <p>
       *    Reads a historical sample from the Speck and returns the it to the given <code>callback</code>. The callback
       *    function has a signature of the form <code>callback(err, data)</code>.
       * </p>
       * <p>
       *    The data object will contain some subset (perhaps all) of the following fields:
       *    <ul>
       *       <li><code>sampleTimeSecs</code>: integer</li>
       *       <li><code>particleCount</code>: integer</li>
       *       <li><code>particleConcentration</code>: integer</li>
       *       <li><code>humidity</code>: integer</li>
       *       <li><code>rawParticleCount</code>: integer</li>
       *       <li><code>temperature</code>: integer</li>
       *    </ul>
       * </p>
       * <p>
       *    Exactly which fields are included depends on the Speck's hardware, firmware, and protocol versions.
       * </p>
       * <p>
       *    The error and data objects will both be <code>null</code> if no historical data is available.
       * </p>
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, data)</code>
       */
      this.getSample = function(callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            self.__getDataSample(com.specksensor.Speck.GET_HISTORIC_SAMPLE_COMMAND_CHARACTER, callback);
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Returns the number of available data samples to the given <code>callback</code>.  The callback is given an
       * object, with a <code>numSamples</code> field.
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, obj)</code>
       */
      this.getNumberOfAvailableSamples = function(callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (!self.getApiSupport().canGetNumberOfDataSamples()) {
               return callback(new Error("This Speck cannot report the number of available samples."), null);
            }

            var command = self._createCommand(com.specksensor.Speck.GET_SAMPLE_COUNT_COMMAND_CHARACTER);
            self._enqueueCommand(command, function(err, data) {
               if (err) {
                  console.log("ERROR: getNumberOfAvailableSamples(): failed to get number of data samples: " + err);
                  callback(err, null);
               }
               else {
                  if (data) {
                     // build the return object
                     var obj = {
                        numSamples : data.readUint32(NUM_SAMPLES_BYTE_INDEX)
                     };

                     callback(null, obj);
                  }
                  else {
                     console.log("ERROR: getNumberOfAvailableSamples(): no data in the response!");
                     callback(null, null);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Sets the logging interval, if supported by the Speck's firmware. The given
       * <code>desiredLoggingIntervalInSeconds</code> is validated to make sure it is an integer and clamped to ensure
       * it's within the valid range.
       *
       * @param {int} desiredLoggingIntervalInSeconds
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       */
      this.setLoggingInterval = function(desiredLoggingIntervalInSeconds, callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (self.getApiSupport().canMutateLoggingInterval()) {
               var loggingIntervalInSeconds = parseInt(desiredLoggingIntervalInSeconds);
               if (isNaN(loggingIntervalInSeconds)) {
                  return callback(new Error("The logging interval must be an integer."), null);
               }
               else {
                  // make sure the range is valid
                  loggingIntervalInSeconds = Math.min(Math.max(loggingIntervalInSeconds, MIN_LOGGING_INTERVAL), MAX_LOGGING_INTERVAL);

                  self.__setLoggingInterval(loggingIntervalInSeconds, function(err, wasSuccessful) {
                     if (!err && wasSuccessful && speckConfig) {
                        // update the speckConfig with this new logging interval
                        speckConfig.loggingIntervalSecs = loggingIntervalInSeconds;
                     }
                     callback(err, wasSuccessful);
                  });
               }
            }
            else {
               return callback(new Error("The logging interval for this Speck cannot be modified."), null);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Deletes the sample with given timestamp. The given <code>desiredLoggingIntervalInSeconds</code> is validated to
       * make sure it is an integer.
       *
       * @param {int} sampleTimestampInSecs
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       */
      this.deleteSample = function(sampleTimestampInSecs, callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            var timestamp = parseInt(sampleTimestampInSecs);
            if (isNaN(timestamp)) {
               return callback(new Error("The sample timestamp must be an integer."), null);
            }
            else {
               self.__deleteSample(timestamp, callback);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      // ---------------------------------------------------------------------------------------------------------------
      // Protected Methods
      // ---------------------------------------------------------------------------------------------------------------

      this._getSpeckConfig = function(willForceReload, callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;
         willForceReload = !!willForceReload;

         if (speckConfig && !willForceReload) {
            //console.log("DEBUG: getSpeckConfig(): returning copy of cached version");
            return callback(null, cloneObject(speckConfig));
         }
         else {
            //console.log("DEBUG: getSpeckConfig(): reloading config from device (if connected)");
            if (self.isConnected()) {
               self.__readSpeckConfigFromDevice(function(err, config) {
                  if (err) {
                     return callback(err, null);
                  }

                  // keep a cached version
                  speckConfig = cloneObject(config);

                  return callback(null, cloneObject(speckConfig));
               });
            }
            else {
               callback(new Error("Not connected to a Speck!"), null);
            }
         }
      };

      this._getCachedSpeckConfig = function() {
         return speckConfig;
      };

      /**
       * Creates the command and returns it as a ByteBuffer.
       *
       * @param {string} commandCharacter
       * @return {ByteBuffer}
       */
      this._createCommand = function(commandCharacter) {
         var byteBuffer = dcodeIO.ByteBuffer.allocate(HID_REPORT_LENGTH_IN_BYTES);

         byteBuffer.fill(0, 0);     // initialize to all zeros (TODO: is this necessary?)
         byteBuffer.offset = 0;     // resets the write position

         byteBuffer.writeUint8(commandCharacter.charCodeAt(0));                  // the command character
         var currentTimeInSecs = Math.round(new Date().getTime() / 1000);
         byteBuffer.writeInt32(currentTimeInSecs);         // current time in seconds

         // reset the offset, just cuz
         byteBuffer.offset = 0;

         if (IS_TRACE_LOGGING_ENABLED) {
            console.log("TRACE: _createCommand(" + commandCharacter + "): " + byteBuffer.toDebug());
         }

         return byteBuffer;
      };

      this._enqueueCommand = function(command, callback) {
         callback = (typeof callback === 'function') ? callback : com.specksensor.Speck.DEFAULT_CALLBACK;

         // define the command queue processor
         var processCommandQueue = function() {
            if (commandQueue.length > 0) {

               var shiftQueueAndContinue = function() {
                  commandQueue.shift();
                  processCommandQueue();
               };

               // peek at the item in need of processing
               var commandQueueItem = commandQueue[0];

               // attempt to write the command
               try {
                  if (IS_TRACE_LOGGING_ENABLED) {
                     console.log("TRACE: Sending command: " + commandQueueItem.command.toDebug() + " for connection [" + connection['connectionId'] + "]");
                  }
                  chrome.hid.send(connection['connectionId'], REPORT_ID, commandQueueItem.command.toArrayBuffer(), function() {
                     if (chrome.runtime.lastError) {
                        throw new Error(chrome.runtime.lastError);
                     }

                     // now attempt to read the response
                     try {
                        if (IS_TRACE_LOGGING_ENABLED) {
                           console.log("TRACE: Reading response for connection [" + connection['connectionId'] + "]");
                        }
                        chrome.hid.receive(connection['connectionId'], function(reportId, dataArrayBuffer) {
                           if (chrome.runtime.lastError) {
                              throw new Error(chrome.runtime.lastError);
                           }

                           if (dataArrayBuffer) {
                              var byteBuffer = dcodeIO.ByteBuffer.wrap(dataArrayBuffer);

                              // verify command ID and checksum
                              var expectedCommandId = commandQueueItem.command.readUint8(COMMAND_ID_BYTE_INDEX);
                              var actualCommandId = byteBuffer.readUint8(COMMAND_ID_BYTE_INDEX);
                              if (expectedCommandId == actualCommandId) {
                                 var expectedChecksum = computeByteBufferChecksum(byteBuffer);
                                 var actualChecksum = byteBuffer.readUint8(CHECKSUM_BYTE_INDEX);
                                 if (expectedChecksum == actualChecksum) {
                                    if (IS_TRACE_LOGGING_ENABLED) {
                                       console.log("TRACE: response: " + byteBuffer.toDebug());
                                    }
                                    commandQueueItem.callback(null, byteBuffer);
                                 }
                                 else {
                                    commandQueueItem.callback(new Error("Failed to read response: invalid checksum.  Expected [" + expectedChecksum + "] actual [" + actualChecksum + "]"), null);
                                 }
                              }
                              else {
                                 commandQueueItem.callback(new Error("Failed to read response: invalid command ID.  Expected [" + expectedCommandId + "] actual [" + actualCommandId + "]"), null);
                              }
                           }
                           else {
                              commandQueueItem.callback(new Error("Failed to read response: no data"), null);
                           }
                           shiftQueueAndContinue();
                        });
                     }
                     catch (readError) {
                        console.log("ERROR: processCommandQueue(): failed to read command response: " + readError);
                        commandQueueItem.callback(readError, null);

                        shiftQueueAndContinue();
                     }
                  });
               }
               catch (writeError) {
                  console.log("ERROR: processCommandQueue(): failed to write command: " + writeError);
                  commandQueueItem.callback(writeError, null);

                  shiftQueueAndContinue();
               }
            }
         };

         // commands need incrementing command IDs
         command.writeUint8(getNextCommandId(), COMMAND_ID_BYTE_INDEX);

         // insert checksum
         command.writeUint8(computeByteBufferChecksum(command), CHECKSUM_BYTE_INDEX);

         command.offset = 0;

         var commandQueueItem = {
            command : command,
            callback : callback,

            time : new Date().getTime(),
            toString : function() {
               return "commandQueueItem: t=[" + this.time + "], command=[" + command.toDebug() + "]"
            }
         };

         commandQueue.push(commandQueueItem);

         // If this newly-added item is the only thing on the command queue, then go ahead and kick off processing.
         // Otherwise, the command queue processor must already be running, so this new item will get processed
         if (commandQueue.length <= 1) {
            processCommandQueue();
         }
      };

      /**
       * Reads at most <code>length</code> bytes from the given <code>byteBuffer</code>, starting at
       * <code>offset</code>. Stops reading if a byte represents a character outside of the  range [0x20, 0x7E] (which
       * is [32, 126] in decimal).
       *
       * @return {string}
       */
      this._readAsciiString = function(byteBuffer, offset, length) {
         var s = [];

         if (byteBuffer && offset >= 0 && length > 0) {
            for (var i = 0; i < length; i++) {
               var b = byteBuffer.readUint8(offset + i);
               if (b >= 0x20 && b <= 0x7E) {
                  var c = String.fromCharCode(b);
                  s.push(c)
               }
               else {
                  console.log("WARN: _readAsciiString(): Read invalid ASCII byte [0x" + b.toString(16) + "], terminating read");
                  break;
               }
            }

         }

         return s.join('');
      };
      // ---------------------------------------------------------------------------------------------------------------
      // Abstract Methods
      // ---------------------------------------------------------------------------------------------------------------

      /**
       * Abstract method for reading the Speck config from the device.  Must be implemented by subclasses.
       * Implementations can assume the Speck is connected.
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, data)</code>
       */
      this.__readSpeckConfigFromDevice = function(callback) {
         throw new Error("This abstract method must be implemented by the subclass!");
      };

      /**
       * Abstract method for reading a data sample from the device.  Must be implemented by subclasses. Implementations
       * can assume the Speck is connected.
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, data)</code>
       */
      this.__getDataSample = function(commandCharacter, callback) {
         throw new Error("This abstract method must be implemented by the subclass!");
      };

      /**
       * Abstract method for setting the sample logging interval.  Must be implemented by subclasses. Implementations
       * can assume the Speck is connected, it has the ability to mutate the logging interval, and that the given
       * <code>loggingIntervalInSeconds</code> is valid.
       *
       * @param {int} desiredLoggingIntervalInSeconds
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       */
      this.__setLoggingInterval = function(desiredLoggingIntervalInSeconds, callback) {
         throw new Error("This abstract method must be implemented by the subclass!");
      };

      /**
       * Abstract method for deleting a sample.  Must be implemented by subclasses. Implementations
       * can assume the Speck is connected and the requested timestamp is valid.
       *
       * @param {int} sampleTimestampInSecs
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       */
      this.__deleteSample = function(sampleTimestampInSecs, callback) {
         throw new Error("This abstract method must be implemented by the subclass!");
      };

      // ---------------------------------------------------------------------------------------------------------------
      // Private Methods
      // ---------------------------------------------------------------------------------------------------------------

      var getNextCommandId = function() {
         commandId++;
         if (commandId > 255) {
            commandId = 1;
         }
         return commandId;
      };

      var computeByteBufferChecksum = function(byteBuffer) {
         // Speck checksum simply sums all the bytes and then uses the lowest 8 bits
         var sum = 0;
         for (var i = 0; i < CHECKSUM_BYTE_INDEX; i++) {
            sum += byteBuffer.readUint8(i);
         }

         return sum & 0xff;
      };
   };

   // ------------------------------------------------------------------------------------------------------------------
   // Static Properties
   // ------------------------------------------------------------------------------------------------------------------
   com.specksensor.Speck.GET_INFO_COMMAND_CHARACTER = "I";
   com.specksensor.Speck.GET_HISTORIC_SAMPLE_COMMAND_CHARACTER = "G";
   com.specksensor.Speck.GET_CURRENT_SAMPLE_COMMAND_CHARACTER = "S";
   com.specksensor.Speck.GET_SAMPLE_COUNT_COMMAND_CHARACTER = "P";
   com.specksensor.Speck.DELETE_SAMPLE_COMMAND_CHARACTER = "D";
   com.specksensor.Speck.SET_LOGGING_INTERVAL_COMMAND_CHARACTER = "I";
   com.specksensor.Speck.DEFAULT_LOGGING_INTERVAL_SECS = 60;
   com.specksensor.Speck.DEFAULT_CALLBACK = function() {
      console.log("WARN: no callback defined!");
   };

   // used for keeping a consistent ordering of CSV fields
   var DATA_SAMPLE_FIELD_NAMES = [
      {
         objName : "sampleTimeSecs",
         csvName : "sample_timestamp_utc_secs"
      },
      {
         objName : "temperature",
         csvName : "temperature"
      },
      {
         objName : "humidity",
         csvName : "humidity"
      },
      {
         objName : "rawParticleCount",
         csvName : "raw_particles"
      },
      {
         objName : "particleCount",
         csvName : "particle_count"
      },
      {
         objName : "particleConcentration",
         csvName : "particle_concentration"
      }
   ];

   /**
    * Returns the given <code>dataSample</code> as a string in CSV format.
    *
    * @param apiSupport
    * @return {string}
    */
   com.specksensor.Speck.getCsvHeader = function(apiSupport) {
      var fieldNames = [];
      DATA_SAMPLE_FIELD_NAMES.forEach(function(fieldNamePair) {
         var fieldName = fieldNamePair['csvName'];
         if (fieldName == "sample_timestamp_utc_secs" || fieldName == "raw_particles") {
            fieldNames.push(fieldName);
         }
         else {
            switch (fieldName) {
               case 'temperature':
                  if (apiSupport.hasTemperatureSensor()) {
                     fieldNames.push(fieldName);
                  }
                  break;
               case 'humidity':
                  if (apiSupport.hasHumiditySensor()) {
                     fieldNames.push(fieldName);
                  }
                  break;
               case 'particle_count':
                  if (apiSupport.hasParticleCount()) {
                     fieldNames.push(fieldName);
                  }
                  break;
               case 'particle_concentration':
                  if (apiSupport.hasParticleConcentration()) {
                     fieldNames.push(fieldName);
                  }
                  break;
               default:
                  console.log("WARNING: ignoring unexpected field name: " + fieldName);
            }
         }
      });
      return fieldNames.join(',');
   };

   /**
    * Returns the given <code>dataSample</code> as a string in CSV format.
    *
    * @param dataSample
    * @return {string}
    */
   com.specksensor.Speck.getSampleAsCsv = function(dataSample) {
      var values = [];
      if (dataSample) {
         DATA_SAMPLE_FIELD_NAMES.forEach(function(fieldNamePair) {
            var fieldName = fieldNamePair['objName'];
            if (fieldName in dataSample) {
               values.push(dataSample[fieldName]);
            }
         });
      }
      return values.join(',');
   };
})();