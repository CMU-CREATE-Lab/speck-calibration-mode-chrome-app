//======================================================================================================================
//
// Class for communicating with a Wifi Speck particle sensor.
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
   var noNimbleMsg = "The Nimble library is required by com.specksensor.WifiSpeck.js";
   console.log(noNimbleMsg);
   throw new Error(noNimbleMsg);
}
if (!com.specksensor.Speck) {
   var noComSpecksensorSpeckMsg = "The com.specksensor.Speck library is required by com.specksensor.WifiSpeck.js";
   alert(noComSpecksensorSpeckMsg);
   throw new Error(noComSpecksensorSpeckMsg);
}
//======================================================================================================================

//======================================================================================================================
// CODE
//======================================================================================================================
(function() {
   var cloneObject = function(obj) {
      return JSON.parse(JSON.stringify(obj));
   };

   var HID_REPORT_LENGTH_IN_BYTES = 128;

   var FEED_API_KEY_NUM_ASCII_CHARACTERS = 64;
   var EMPTY_FEED_API_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

   var WIFI_SSID_MAX_LENGTH = 32;
   var WIFI_WPA_KEY_MAX_LENGTH = 32;
   var WIFI_WEP_HEX_KEY_STRING_LENGTHS = Object.freeze({ 10 : true, 26 : true, 32 : true });
   var WIFI_WEP_ASCII_KEY_STRING_LENGTHS = Object.freeze({ 5 : true, 13 : true, 16 : true });
   var WIFI_WEP_HEX_KEY_REGEX = /^[a-f0-9]+$/i;

   // Constants for Info command
   var SERIAL_NUMBER_STARTING_BYTE_INDEX = 1;
   var SERIAL_NUMBER_ENDING_BYTE_INDEX = 16;
   var HARDWARE_VERSION_BYTE_INDEX = 17;
   var PROTOCOL_VERSION_BYTE_INDEX = 18;
   var LOGGING_INTERVAL_BYTE_INDEX_WHEN_READING = 19;
   var LOGGING_INTERVAL_BYTE_INDEX_WHEN_WRITING = 5;
   var FIRMWARE_VERSION_BYTE_INDEX = 20;
   var COLOR_PALETTE_BYTE_INDEX_WHEN_READING = 21;
   var COLOR_PALETTE_BYTE_INDEX_WHEN_WRITING = 6;
   var COLOR_PALETTE_NO_CHANGE_FLAG = 255;
   var COLOR_PALETTES_BY_ID = Object.freeze({
      0 : Object.freeze({ name : "Default", id : 0 }),
      1 : Object.freeze({ name : "Colorblind", id : 1 })
   });
   var SCALE_BYTE_INDEX_WHEN_READING = 22;
   var SCALE_BYTE_INDEX_WHEN_WRITING = 7;
   var SCALE_NO_CHANGE_FLAG = 255;
   var SCALES_BY_ID = Object.freeze({
      0 : Object.freeze({ name : "Count", abbreviation : "c", id : 0 }),
      1 : Object.freeze({ name : "Concentration", abbreviation : "w", id : 1 })
   });

   // Constants for Get Data Sample command
   var SAMPLE_TIME_SECS_BYTE_INDEX = 1;
   var PARTICLE_CONCENTRATION_BYTE_INDEX = 5;
   var TEMPERATURE_BYTE_INDEX = 9;
   var HUMIDITY_BYTE_INDEX = 11;
   var RAW_PARTICLE_COUNT_BYTE_INDEX = 12;
   var PARTICLE_COUNT_BYTE_INDEX = 14;

   // Byte indices for Delete Sample command
   var DELETE_SAMPLE_AT_TIME_BYTE_INDEX = 5;
   var DELETE_SAMPLE_RESULT_BYTE_INDEX = 5;

   // Constants for Delete Samples command
   var DELETE_ONE_OR_ALL_SAMPLES_BYTE_INDEX = 9;
   var DELETE_ONE_SAMPLE_FLAG = 1;
   var DELETE_ALL_SAMPLES_FLAG = 255;

   // Constants for Wifi Status command
   var GET_WIFI_STATUS_COMMAND_CHARACTER = "w";
   var WIFI_STATUS_MAC_ADDRESS_STARTING_BYTE_INDEX = 1;
   var WIFI_STATUS_MAC_ADDRESS_ENDING_BYTE_INDEX = 6;
   var WIFI_STATUS_IS_FEED_KEY_STORED_BYTE_INDEX = 7;
   var WIFI_STATUS_FEED_KEY_STARTING_BYTE_INDEX = 8;
   var WIFI_STATUS_IS_INITIALIZED_BYTE_INDEX = 72;
   var WIFI_STATUS_IS_SCANNING_BYTE_INDEX = 73;
   var WIFI_STATUS_NUM_AVAILABLE_NETWORKS_BYTE_INDEX = 74;
   var WIFI_STATUS_NUM_STORED_NETWORKS_BYTE_INDEX = 75;
   var WIFI_STATUS_IS_REMOVING_NETWORKS_BYTE_INDEX = 76;
   var WIFI_STATUS_IS_JOINING_NETWORK_BYTE_INDEX = 77;
   var WIFI_STATUS_CONNECTION_STATUS_BYTE_INDEX = 78;
   var WIFI_STATUS_CONNECTION_STATUS = Object.freeze({
      0 : Object.freeze({
         name : "Not Connected",
         id : 0,
         isConnected : false
      }),
      1 : Object.freeze({
         name : "Connected",
         id : 1,
         isConnected : true
      }),
      2 : Object.freeze({
         name : "Error",
         id : 2,
         isConnected : false
      })
   });
   var WIFI_STATUS_IP_ADDRESS_STARTING_BYTE_INDEX = 79;

   // Constants for Set Feed API Key command
   var SET_FEED_API_KEY_COMMAND_CHARACTER = "k";
   var SET_FEED_API_KEY_IS_KEY_ENABLED_BYTE_INDEX_WHEN_SENDING = 5;
   var SET_FEED_API_KEY_IS_KEY_ENABLED_BYTE_INDEX_WHEN_RECEIVING = 1;
   var SET_FEED_API_KEY_KEY_STARTING_BYTE_INDEX_WHEN_SENDING = 6;
   var SET_FEED_API_KEY_KEY_STARTING_BYTE_INDEX_WHEN_RECEIVING = 2;

   // Constants for Initiate Wifi Scan command
   var INITIATE_WIFI_SCAN_COMMAND_CHARACTER = "s";
   var INITIATE_WIFI_SCAN_IS_SCANNING_BYTE_INDEX = 1;

   // Constants for Get Available Networks command
   var GET_AVAILABLE_NETWORKS_COMMAND_CHARACTER = "n";
   var GET_AVAILABLE_NETWORKS_IS_VALID_ENTRY_BYTE_INDEX = 1;
   var GET_AVAILABLE_NETWORKS_ENCRYPTION_TYPE_BYTE_INDEX = 2;
   var GET_AVAILABLE_NETWORKS_SSID_LENGTH_BYTE_INDEX = 3;
   var GET_AVAILABLE_NETWORKS_SSID_STARTING_BYTE_INDEX = 4;
   var GET_AVAILABLE_NETWORKS_SIGNAL_STRENGTH_BYTE_INDEX = 36;

   var WIFI_SIGNAL_STRENGTHS = Object.freeze([
      Object.freeze({
         id : 0,
         name : "Excellent",
         minRssi : -50
      }),
      Object.freeze({
         id : 1,
         name : "Good",
         minRssi : -60
      }),
      Object.freeze({
         id : 2,
         name : "Fair",
         minRssi : -70
      }),
      Object.freeze({
         id : 3,
         name : "Weak",
         minRssi : -80
      }),
      Object.freeze({
         id : 4,
         name : "Negligible",
         minRssi : -1 * Number.MAX_VALUE
      })
   ]);

   // Constants for Join Network command
   var JOIN_NETWORK_COMMAND_CHARACTER = "j";
   var JOIN_NETWORK_ENCRYPTION_TYPE_ID_BYTE_INDEX = 5;
   var JOIN_NETWORK_SSID_LENGTH_BYTE_INDEX = 6;
   var JOIN_NETWORK_ENCRYPTION_KEY_LENGTH_BYTE_INDEX = 7;
   var JOIN_NETWORK_SSID_STARTING_BYTE_INDEX = 8;
   var JOIN_NETWORK_ENCRYPTION_KEY_STARTING_BYTE_INDEX = 40;
   var JOIN_NETWORK_IS_JOINING_BYTE_INDEX = 1;

   // Constants for Get Stored Network command
   var GET_STORED_NETWORK_COMMAND_CHARACTER = "t";
   var GET_STORED_NETWORK_NETWORK_INDEX_BYTE_INDEX = 5;
   var GET_STORED_NETWORK_ENCRYPTION_TYPE_BYTE_INDEX = 1;
   var GET_STORED_NETWORK_SSID_LENGTH_BYTE_INDEX = 2;
   var GET_STORED_NETWORK_SSID_STARTING_BYTE_INDEX = 3;

   // Constants for Remove All Networks command
   var REMOVE_ALL_NETWORKS_COMMAND_CHARACTER = "r";
   var REMOVE_ALL_NETWORKS_IS_REMOVING_BYTE_INDEX = 1;

   // Constants for Get/Set Upload URL command
   var UPLOAD_URL_COMMAND_CHARACTER = "u";
   var UPLOAD_URL_READ_OR_WRITE_MODE_BYTE_INDEX = 5;
   var UPLOAD_URL_READ_MODE_VALUE = 0;
   var UPLOAD_URL_WRITE_MODE_VALUE = 1;
   var UPLOAD_URL_HOST_LENGTH_BYTE_INDEX_WHEN_WRITING = 7;
   var UPLOAD_URL_PORT_LENGTH_BYTE_INDEX_WHEN_WRITING = 6;
   var UPLOAD_URL_PATH_LENGTH_BYTE_INDEX_WHEN_WRITING = 8;
   var UPLOAD_URL_HOST_STARTING_BYTE_INDEX_WHEN_WRITING = 14;
   var UPLOAD_URL_PORT_STARTING_BYTE_INDEX_WHEN_WRITING = 9;
   var UPLOAD_URL_PATH_STARTING_BYTE_INDEX_WHEN_WRITING = 54;
   var UPLOAD_URL_HOST_MIN_LENGTH_AS_STRING = 2;
   var UPLOAD_URL_PORT_MIN_LENGTH_AS_STRING = 1;
   var UPLOAD_URL_PATH_MIN_LENGTH_AS_STRING = 0;
   var UPLOAD_URL_HOST_MAX_LENGTH_AS_STRING = 40;
   var UPLOAD_URL_PORT_MAX_LENGTH_AS_STRING = 5;
   var UPLOAD_URL_PATH_MAX_LENGTH_AS_STRING = 40;
   var UPLOAD_URL_HOST_LENGTH_BYTE_INDEX_WHEN_RECEIVING = 2;
   var UPLOAD_URL_PORT_LENGTH_BYTE_INDEX_WHEN_RECEIVING = 1;
   var UPLOAD_URL_PATH_LENGTH_BYTE_INDEX_WHEN_RECEIVING = 3;
   var UPLOAD_URL_HOST_STARTING_BYTE_INDEX_WHEN_RECEIVING = 9;
   var UPLOAD_URL_PORT_STARTING_BYTE_INDEX_WHEN_RECEIVING = 4;
   var UPLOAD_URL_PATH_STARTING_BYTE_INDEX_WHEN_RECEIVING = 49;

   // Constants for Put In Calibration Mode command
   var PUT_IN_CALIBRATION_MODE_COMMAND_CHARACTER = "c";
   var PUT_IN_CALIBRATION_MODE_IS_CALIBRATING_BYTE_INDEX = 1;

   var MAX_TIME_TO_SCAN_FOR_NETWORKS_IN_MILLIS = 15 * 1000; // 15 seconds

   // syntactic sugar
   var Speck = com.specksensor.Speck;

   // If the given value is a string and matches the FEED_API_KEY_REGEX regex, then consider it a Feed API Key
   var FEED_API_KEY_REGEX = /^[a-f0-9]{64}$/i;
   var isFeedApiKey = function(str) {
      return (isString(str) && FEED_API_KEY_REGEX.test(str));
   };

   /**
    * Returns <code>true</code> if the given value is a string; returns <code>false</code> otherwise.
    *
    * Got this from http://stackoverflow.com/a/9436948/703200
    */
   var isString = function(o) {
      return (typeof o == 'string' || o instanceof String)
   };

   // Got this from http://stackoverflow.com/a/9716488/703200
   var isNumeric = function(n) {
      return !isNaN(parseFloat(n)) && isFinite(n);
   };

   com.specksensor.WifiSpeck = function(deviceInfo) {
      Speck.call(this, deviceInfo, HID_REPORT_LENGTH_IN_BYTES);
      var self = this;

      // ---------------------------------------------------------------------------------------------------------------
      // Public Methods
      // ---------------------------------------------------------------------------------------------------------------

      this.getApiSupport = function() {
         return {
            canMutateLoggingInterval : function() {
               return true;
            },
            canGetNumberOfDataSamples : function() {
               return true;
            },
            hasTemperatureSensor : function() {
               return true;
            },
            hasHumiditySensor : function() {
               // early wifi specks don't have humidity
               var config = self._getCachedSpeckConfig();
               return config &&
                      config.hardwareVersion &&
                      config.hardwareVersion >= 6;
            },
            hasParticleCount : function() {
               return true;
            },
            hasParticleConcentration : function() {
               return true;
            },
            hasDeviceVersionInfo : function() {
               return true;
            },
            hasExtendedId : function() {
               return true;
            },
            canDeleteAllSamples : function() {
               return true;
            },
            canSelectPalette : function() {
               return true;
            },
            canSelectValueUnits : function() {
               return true;
            },
            hasWifi : function() {
               return true;
            },
            canMutateUploadUrl : function() {
               // Upload URL mutation is only supported in protocol v2 and up
               var config = self._getCachedSpeckConfig();
               return config &&
                      config.protocolVersion &&
                      config.protocolVersion > 1;
            },
            hasCalibrationMode : function() {
               return true;
            }
         };
      };

      /**
       * Deletes all samples.  Returns whether it was successful to the given callback.
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       */
      this.deleteAllSamples = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            deleteOneOrMoreSamples(0, true, callback);
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Sets the color palette to the palette with the given <code>paletteId</code>.
       *
       * @param {int} paletteId
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       * @see com.specksensor.WifiSpeck.COLOR_PALETTES
       */
      this.setPalette = function(paletteId, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (paletteId in COLOR_PALETTES_BY_ID) {
               var command = self._createCommand(Speck.GET_INFO_COMMAND_CHARACTER);
               command.writeUint8(paletteId, COLOR_PALETTE_BYTE_INDEX_WHEN_WRITING);
               // we don't want to change the scale here, so make sure it's set to NO_CHANGE
               command.writeUint8(SCALE_NO_CHANGE_FLAG, SCALE_BYTE_INDEX_WHEN_WRITING);

               self._enqueueCommand(command, function(err, data) {
                  if (err) {
                     console.log("ERROR: setPalette(): failed to set the palette: " + err);
                     callback(err, null);
                  }
                  else {
                     if (data) {
                        // get the colorPalette
                        var colorPaletteId = data.readUint8(COLOR_PALETTE_BYTE_INDEX_WHEN_READING);
                        var colorPalette = COLOR_PALETTES_BY_ID[colorPaletteId] || null;
                        var wasSuccessful = colorPalette && colorPalette.id == paletteId;

                        // if successful, force reload of the speck config
                        if (wasSuccessful) {
                           self._getSpeckConfig(true, function(err, config) {
                              if (err) {
                                 console.log("ERROR: setPalette(): failed to get the config after setting the palette: " + err);
                                 callback(err, null);
                              }
                              else {
                                 if (config) {
                                    callback(null, config.colorPalette.id == paletteId)
                                 }
                                 else {
                                    console.log("ERROR: setPalette(): no data in the response from getting the config after changing the palette");
                                    callback(null, null);
                                 }
                              }
                           });
                        }
                        else {
                           console.log("ERROR: setPalette(): failed to set the palette: " + err);
                           callback(new Error("Unexpected palette ID in the response when setting the palette"), null);
                        }
                     }
                     else {
                        console.log("ERROR: setPalette(): no data in the response!");
                        callback(null, null);
                     }
                  }
               });
            }
            else {
               callback(new Error("Invalid palette ID"), null);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Toggles the palette and returns the updated speck config.
       *
       * @param {function} callback
       */
      this.togglePalette = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            self.getSpeckConfig(function(err, config) {
               if (err) {
                  return callback(err);
               }
               else {
                  if (config) {
                     self.setPalette(config.colorPalette.id == 0 ? 1 : 0, function() {
                        self.getSpeckConfig(callback);
                     });
                  }
                  else {
                     console.log("ERROR: togglePalette(): no data in the response from getting the config when trying to toggle the palette");
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
       * Sets the value scale to the scale with the given <code>scaleId</code>.
       *
       * @param {int} scaleId
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       * @see com.specksensor.WifiSpeck.SCALES
       */
      this.setScale = function(scaleId, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (scaleId in SCALES_BY_ID) {
               var command = self._createCommand(Speck.GET_INFO_COMMAND_CHARACTER);
               // we don't want to change the palette here, so make sure it's set to NO_CHANGE
               command.writeUint8(COLOR_PALETTE_NO_CHANGE_FLAG, COLOR_PALETTE_BYTE_INDEX_WHEN_WRITING);
               command.writeUint8(scaleId, SCALE_BYTE_INDEX_WHEN_WRITING);

               self._enqueueCommand(command, function(err, data) {
                  if (err) {
                     console.log("ERROR: setScale(): failed to set the scale: " + err);
                     callback(err, null);
                  }
                  else {
                     if (data) {
                        // get the scale
                        var scaleId = data.readUint8(SCALE_BYTE_INDEX_WHEN_READING);
                        var scale = SCALES_BY_ID[scaleId] || null;
                        var wasSuccessful = scale && scale.id == scaleId;

                        // if successful, force reload of the speck config
                        if (wasSuccessful) {
                           self._getSpeckConfig(true, function(err, config) {
                              if (err) {
                                 console.log("ERROR: setScale(): failed to get the config after setting the scale: " + err);
                                 callback(err, null);
                              }
                              else {
                                 if (config) {
                                    callback(null, config.scale.id == scaleId)
                                 }
                                 else {
                                    console.log("ERROR: setScale(): no data in the response from getting the config after changing the scale");
                                    callback(null, null);
                                 }
                              }
                           });
                        }
                        else {
                           console.log("ERROR: setScale(): failed to set the scale: " + err);
                           callback(new Error("Unexpected scale ID in the response when setting the scale"), null);
                        }
                     }
                     else {
                        console.log("ERROR: setScale(): no data in the response!");
                        callback(null, null);
                     }
                  }
               });
            }
            else {
               callback(new Error("Invalid scale ID"), null);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Toggles the scale and returns the updated speck config.
       *
       * @param {function} callback
       */
      this.toggleScale = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            self.getSpeckConfig(function(err, config) {
               if (err) {
                  return callback(err);
               }
               else {
                  if (config) {
                     self.setScale(config.scale.id == 0 ? 1 : 0, function() {
                        self.getSpeckConfig(callback);
                     });
                  }
                  else {
                     console.log("ERROR: toggleScale(): no data in the response from getting the config when trying to toggle the scale");
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
       * Returns the wifi status to the given callback.  Use this method to check status such as whether time-consuming
       * operations are still in progress (e.g. wifi scanning, removal of stored networks, joining a network, etc.).
       *
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wifiStatus)</code>
       */
      this.getWifiStatus = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            var command = self._createCommand(GET_WIFI_STATUS_COMMAND_CHARACTER);
            self._enqueueCommand(command, function(err, data) {
               if (err) {
                  console.log("ERROR: getWifiStatus(): failed to get wifi status: " + err);
                  callback(err, null);
               }
               else {
                  if (data) {

                     // get the feed API key
                     var feedApiKey = self._readAsciiString(data, WIFI_STATUS_FEED_KEY_STARTING_BYTE_INDEX, FEED_API_KEY_NUM_ASCII_CHARACTERS);

                     // get the MAC address
                     data.offset = 0;
                     var macAddress = data.toHex().slice(2 * WIFI_STATUS_MAC_ADDRESS_STARTING_BYTE_INDEX,
                                                         2 * (WIFI_STATUS_MAC_ADDRESS_ENDING_BYTE_INDEX + 1));

                     // read the connection status
                     var connectionStatusId = data.readUint8(WIFI_STATUS_CONNECTION_STATUS_BYTE_INDEX);
                     var connectionStatus = WIFI_STATUS_CONNECTION_STATUS[connectionStatusId] || null;

                     // read the IP address
                     var ipAddress = null;
                     if (connectionStatus && connectionStatus.isConnected) {
                        var ipAddressBytes = [];
                        for (var i = 0; i < 4; i++) {
                           ipAddressBytes.push(data.readUint8(WIFI_STATUS_IP_ADDRESS_STARTING_BYTE_INDEX + i));
                        }
                        ipAddress = ipAddressBytes.join('.');
                     }

                     // build the return object
                     var obj = {
                        ipAddress : ipAddress,
                        macAddress : macAddress,
                        feedApiKey : feedApiKey,
                        isFeedApiKeyEnabled : data.readUint8(WIFI_STATUS_IS_FEED_KEY_STORED_BYTE_INDEX) == 1,
                        isInitialized : data.readUint8(WIFI_STATUS_IS_INITIALIZED_BYTE_INDEX) == 1,
                        isScanning : data.readUint8(WIFI_STATUS_IS_SCANNING_BYTE_INDEX) == 1,
                        numAvailableNetworks : data.readUint8(WIFI_STATUS_NUM_AVAILABLE_NETWORKS_BYTE_INDEX),
                        numStoredNetworks : data.readUint8(WIFI_STATUS_NUM_STORED_NETWORKS_BYTE_INDEX),
                        isRemovingNetworks : data.readUint8(WIFI_STATUS_IS_REMOVING_NETWORKS_BYTE_INDEX) == 1,
                        isJoiningNetwork : data.readUint8(WIFI_STATUS_IS_JOINING_NETWORK_BYTE_INDEX) == 1,
                        connectionStatus : connectionStatus
                     };

                     callback(null, obj);
                  }
                  else {
                     console.log("ERROR: getWifiStatus(): no data in the response!");
                     callback(null, null);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.setFeedApiKey = function(key, isEnabled, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            // validate the key
            if (isFeedApiKey(key)) {
               // create the command, and insert the key and whether it's enabled
               var command = self._createCommand(SET_FEED_API_KEY_COMMAND_CHARACTER);
               command.writeUint8((!!isEnabled) ? 1 : 0, SET_FEED_API_KEY_IS_KEY_ENABLED_BYTE_INDEX_WHEN_SENDING);
               command.offset = SET_FEED_API_KEY_KEY_STARTING_BYTE_INDEX_WHEN_SENDING;
               command.writeString(key);

               self._enqueueCommand(command, function(err, data) {
                  if (err) {
                     console.log("ERROR: setFeedApiKey(): failed to set the feed API key: " + err);
                     callback(err, null);
                  }
                  else {
                     if (data) {
                        var returnedFeedApiKey = self._readAsciiString(data, SET_FEED_API_KEY_KEY_STARTING_BYTE_INDEX_WHEN_RECEIVING, FEED_API_KEY_NUM_ASCII_CHARACTERS);

                        // build the return object
                        var obj = {
                           success : returnedFeedApiKey == key,
                           feedApiKey : returnedFeedApiKey,
                           isFeedApiKeyEnabled : data.readUint8(SET_FEED_API_KEY_IS_KEY_ENABLED_BYTE_INDEX_WHEN_RECEIVING)
                        };

                        callback(null, obj);
                     }
                     else {
                        console.log("ERROR: setFeedApiKey(): no data in the response!");
                        callback(null, null);
                     }
                  }
               });

            }
            else {
               callback(new Error("Invalid feed API key"), null);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.clearFeedApiKey = function(callback) {
         self.setFeedApiKey(EMPTY_FEED_API_KEY, false, callback);
      };

      this.initiateWifiScan = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            var command = self._createCommand(INITIATE_WIFI_SCAN_COMMAND_CHARACTER);
            self._enqueueCommand(command, function(err, data) {
               if (err) {
                  console.log("ERROR: initiateWifiScan(): failed to initiate wifi scan: " + err);
                  callback(err, null);
               }
               else {
                  if (data) {

                     // build the return object
                     var obj = {
                        isScanning : data.readUint8(INITIATE_WIFI_SCAN_IS_SCANNING_BYTE_INDEX) == 1
                     };

                     callback(null, obj);
                  }
                  else {
                     console.log("ERROR: initiateWifiScan(): no data in the response!");
                     callback(null, null);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.getAvailableNetworks = function(numExpectedAvailableNetworks, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (numExpectedAvailableNetworks > 0) {
               var error = null;
               var networks = [];
               var uniqueSsids = {};
               var hasMoreNetworks = true;
               var getAvailableNetworkRequests = [];

               // create the requests to get each of the available networks
               for (var i = 0; i < numExpectedAvailableNetworks; i++) {
                  getAvailableNetworkRequests.push(function(done) {
                     if (hasMoreNetworks && !error) {
                        getAvailableNetwork(function(err, network) {
                           if (err) {
                              error = err;
                           }
                           else {
                              if (network) {
                                 if (network.ssid in uniqueSsids) {
                                    console.log("Duplicate SSID, ignoring: " + JSON.stringify(network, null, 3));
                                 }
                                 else {
                                    // remember this SSID so we can filter out dupes
                                    uniqueSsids[network.ssid] = true;

                                    networks.push(network);
                                 }
                              }
                              else {
                                 hasMoreNetworks = false;
                              }
                           }
                           done();
                        });
                     }
                     else {
                        done();
                     }
                  });
               }

               // now make the network requests, in series
               _.series(getAvailableNetworkRequests,
                        function() {
                           if (error) {
                              return callback(error);
                           }

                           if (numExpectedAvailableNetworks != networks.length) {
                              console.log("WARN: getAvailableNetworks(): expected [" + numExpectedAvailableNetworks + "] available networks, but only found [" + networks.length + "] unique.")
                           }

                           // sort by signal strength, then SSID (case insensitive) and then by encryption type.
                           var networkSort = function(a, b) {
                              var signalStrengthA = a.signalStrength.rssi;
                              var signalStrengthB = b.signalStrength.rssi;
                              if (signalStrengthA > signalStrengthB) {
                                 return -1;
                              }
                              if (signalStrengthA < signalStrengthB) {
                                 return 1;
                              }

                              var ssidA = a.ssid.toLowerCase();
                              var ssidB = b.ssid.toLowerCase();
                              if (ssidA > ssidB) {
                                 return 1;
                              }
                              if (ssidA < ssidB) {
                                 return -1;
                              }

                              // if the SSIDs are the same, then sort by encryption type
                              return a.encryption.id - b.encryption.id;
                           };

                           var sortedNetworks = networks.sort(networkSort);
                           console.log(JSON.stringify(sortedNetworks, null, 3));
                           return callback(null, sortedNetworks);
                        });
            }
            else {
               console.log("DEBUG: getAvailableNetworks(): Number of expected available networks is 0");
               callback(null, []);
            }

         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.joinNetwork = function(network, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (network !== 'undefined' && network != null) {
               // validate that the network object has all the expected properties, and they're valid
               if (com.specksensor.WifiSpeck.isValidSsid(network['ssid'])) {
                  if (com.specksensor.WifiSpeck.isValidEncryption(network['encryption'])) {
                     var ssid = network.ssid;
                     var encryptionTypeId = network.encryption.id;
                     var encryptionKey = network.encryption.key;
                     var encryptionKeyLengthInBytes = (typeof encryptionKey !== 'undefined' && encryptionKey != null) ? encryptionKey.length : 0;

                     // If the encryption is hex WEP, then we'll send the key as bytes instead of ASCII, so divide by 2
                     var willTreatKeyAsHexBytes = encryptionTypeId == com.specksensor.WifiSpeck.WIFI_ENCRYPTION_PROTOCOLS.WEP &&
                                                  com.specksensor.WifiSpeck.isValidHexWepKey(encryptionKey);
                     if (willTreatKeyAsHexBytes) {
                        encryptionKeyLengthInBytes = encryptionKeyLengthInBytes / 2;
                     }

                     console.log("DEBUG: joinNetwork(): " + JSON.stringify({
                                    ssid : ssid,
                                    encryptionTypeId : encryptionTypeId,
                                    encryptionKey : encryptionKey,
                                    encryptionKeyLengthInBytes : encryptionKeyLengthInBytes
                                 }, null, 3));

                     // create the command, then populate it with the encryption type id, SSID length, SSID,
                     var command = self._createCommand(JOIN_NETWORK_COMMAND_CHARACTER);
                     command.writeUint8(encryptionTypeId, JOIN_NETWORK_ENCRYPTION_TYPE_ID_BYTE_INDEX);
                     command.writeUint8(ssid.length, JOIN_NETWORK_SSID_LENGTH_BYTE_INDEX);
                     command.writeUint8(encryptionKeyLengthInBytes, JOIN_NETWORK_ENCRYPTION_KEY_LENGTH_BYTE_INDEX);
                     command.writeString(ssid, JOIN_NETWORK_SSID_STARTING_BYTE_INDEX);

                     if (willTreatKeyAsHexBytes) {
                        command.offset = JOIN_NETWORK_ENCRYPTION_KEY_STARTING_BYTE_INDEX;
                        for (var i = 0; i < encryptionKeyLengthInBytes; i++) {
                           var offset = i * 2;
                           var piece = encryptionKey.slice(offset, offset + 2);
                           console.log("Piece [" + piece + "]");
                           command.writeUint8(parseInt(piece, 16));  // parse the hex string to an int (i.e. a byte) and write it
                        }
                     }
                     else if (encryptionKeyLengthInBytes > 0) {
                        command.writeString(encryptionKey, JOIN_NETWORK_ENCRYPTION_KEY_STARTING_BYTE_INDEX);
                     }

                     console.log("DEBUG: joinNetwork(): ready to send command: " + JSON.stringify({
                                    ssid : ssid,
                                    encryptionTypeId : encryptionTypeId,
                                    encryptionKey : encryptionKey,
                                    encryptionKeyLengthInBytes : encryptionKeyLengthInBytes,
                                    command : command.toDebug()
                                 }, null, 3));

                     self._enqueueCommand(command, function(err, data) {
                        if (err) {
                           console.log("ERROR: joinNetwork(): failed to join network due to error: " + err);
                           callback(err, null);
                        }
                        else {
                           if (data) {

                              // build the return object
                              var obj = {
                                 isJoining : data.readUint8(JOIN_NETWORK_IS_JOINING_BYTE_INDEX) == 1
                              };

                              callback(null, obj);
                           }
                           else {
                              console.log("ERROR: joinNetwork(): no data in the response!");
                              callback(null, null);
                           }
                        }
                     });
                  }
                  else {
                     var error = new Error("Invalid wifi encryption key");
                     error.isInvalidEncryptionKey = true;
                     callback(error, null);
                  }
               }
               else {
                  var error = new Error("Invalid wifi SSID");
                  error.isInvalidSsid = true;
                  callback(error, null);
               }
            }
            else {
               callback(new Error("Undefined or null network"), null);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Returns the stored network associated with the given <code>networkIndex</code>. This method is deprecated, use
       * {@link #getStoredNetworks} instead.
       *
       * @deprecated
       * @param networkIndex
       * @param {function} callback
       * @see {@link #getStoredNetworks}
       */
      this.getStoredNetwork = function(networkIndex, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {

            // get the wifi status so we can validate the requested network index
            self.getWifiStatus(function(err, wifiStatus) {
               if (err) {
                  console.log("ERROR: getStoredNetwork(): failed to read wifi status in order to validate the stored network index: " + err);
                  callback(err, null);
               }
               else {
                  if (wifiStatus.numStoredNetworks > 0) {
                     if (networkIndex >= 0 && networkIndex < wifiStatus.numStoredNetworks) {
                        var command = self._createCommand(GET_STORED_NETWORK_COMMAND_CHARACTER);
                        command.writeUint8(networkIndex, GET_STORED_NETWORK_NETWORK_INDEX_BYTE_INDEX);
                        self._enqueueCommand(command, function(err, data) {
                           if (err) {
                              console.log("ERROR: getStoredNetwork(): failed to get stored network: " + err);
                              callback(err, null);
                           }
                           else {
                              if (data) {

                                 // get the SSID length
                                 var ssidLength = data.readUint8(GET_STORED_NETWORK_SSID_LENGTH_BYTE_INDEX);

                                 // clamp the length to the range [0, WIFI_SSID_MAX_LENGTH] (shouldn't be necessary, but...)
                                 ssidLength = Math.min(Math.max(ssidLength, 0), WIFI_SSID_MAX_LENGTH);

                                 var obj = null;

                                 if (ssidLength > 0) {
                                    // read the SSID
                                    var ssid = self._readAsciiString(data, GET_STORED_NETWORK_SSID_STARTING_BYTE_INDEX, ssidLength);

                                    // read the encryption type
                                    var encryptionId = data.readUint8(GET_STORED_NETWORK_ENCRYPTION_TYPE_BYTE_INDEX);
                                    var encryption = WIFI_ENCRYPTION_PROTOCOLS_BY_ID[encryptionId] || null;
                                    obj = {
                                       ssid : ssid,
                                       encryption : encryption
                                    };
                                 }

                                 callback(null, obj);
                              }
                              else {
                                 console.log("ERROR: getStoredNetwork(): no data in the response!");
                                 callback(null, null);
                              }
                           }
                        });
                     }
                     else {
                        callback(new Error("Invalid stored network index [" + networkIndex + "]. Must be in the range [0," + wifiStatus.numStoredNetworks + "]"), null);
                     }
                  }
                  else {
                     callback(new Error("No stored networks."), null);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Returns all stored networks (if any) in an array.
       *
       * @param {function} callback
       */
      this.getStoredNetworks = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {

            // get the wifi status so we can validate the requested network index
            self.getWifiStatus(function(err, wifiStatus) {
               if (err) {
                  console.log("ERROR: getStoredNetworks(): failed to read wifi status in order to get the number of stored networks: " + err);
                  callback(err, null);
               }
               else {
                  if (wifiStatus.numStoredNetworks > 0) {
                     var networkIndex = -1;
                     var numNetworks = wifiStatus.numStoredNetworks;
                     var networks = [];

                     var requestNextNetworkRead = function() {
                        networkIndex++;
                        if (networkIndex < numNetworks) {
                           readStoredNetwork(networkIndex);
                        }
                        else {
                           callback(null, networks);
                        }
                     };

                     var readStoredNetwork = function(id) {
                        var command = self._createCommand(GET_STORED_NETWORK_COMMAND_CHARACTER);
                        command.writeUint8(id, GET_STORED_NETWORK_NETWORK_INDEX_BYTE_INDEX);
                        self._enqueueCommand(command, function(err, data) {
                           if (err) {
                              console.log("ERROR: readStoredNetwork(" + id + "): failed to get stored network: " + err);
                              window.setTimeout(requestNextNetworkRead, 1);
                           }
                           else {
                              if (data) {

                                 // get the SSID length
                                 var ssidLength = data.readUint8(GET_STORED_NETWORK_SSID_LENGTH_BYTE_INDEX);

                                 // clamp the length to the range [0, WIFI_SSID_MAX_LENGTH] (shouldn't be necessary, but...)
                                 ssidLength = Math.min(Math.max(ssidLength, 0), WIFI_SSID_MAX_LENGTH);

                                 var obj = null;

                                 if (ssidLength > 0) {
                                    // read the SSID
                                    var ssid = self._readAsciiString(data, GET_STORED_NETWORK_SSID_STARTING_BYTE_INDEX, ssidLength);

                                    // read the encryption type
                                    var encryptionId = data.readUint8(GET_STORED_NETWORK_ENCRYPTION_TYPE_BYTE_INDEX);
                                    var encryption = WIFI_ENCRYPTION_PROTOCOLS_BY_ID[encryptionId] || null;
                                    obj = {
                                       ssid : ssid,
                                       encryption : encryption
                                    };
                                 }

                                 if (obj != null) {
                                    networks.push(obj);
                                 }
                                 window.setTimeout(requestNextNetworkRead, 1);
                              }
                              else {
                                 console.log("ERROR: readStoredNetwork(" + id + "): no data in the response!");
                                 window.setTimeout(requestNextNetworkRead, 1);
                              }
                           }
                        });
                     };

                     requestNextNetworkRead();

                  }
                  else {
                     // no stored networks
                     callback(null, []);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.removeAllStoredNetworks = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            var command = self._createCommand(REMOVE_ALL_NETWORKS_COMMAND_CHARACTER);
            self._enqueueCommand(command, function(err, data) {
               if (err) {
                  console.log("ERROR: removeAllStoredNetworks(): failed to remove all stored networks: " + err);
                  callback(err, null);
               }
               else {
                  if (data) {

                     // build the return object
                     var obj = {
                        isRemoving : data.readUint8(REMOVE_ALL_NETWORKS_IS_REMOVING_BYTE_INDEX) == 1
                     };

                     callback(null, obj);
                  }
                  else {
                     console.log("ERROR: removeAllStoredNetworks(): no data in the response!");
                     callback(null, null);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.getUploadUrl = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            var command = self._createCommand(UPLOAD_URL_COMMAND_CHARACTER);
            command.writeUint8(UPLOAD_URL_READ_MODE_VALUE, UPLOAD_URL_READ_OR_WRITE_MODE_BYTE_INDEX);
            self._enqueueCommand(command, function(err, data) {
               if (err) {
                  console.log("ERROR: getUploadTarget(): failed to get the upload target: " + err);
                  callback(err, null);
               }
               else {
                  if (data) {

                     // read the host
                     var hostLength = data.readUint8(UPLOAD_URL_HOST_LENGTH_BYTE_INDEX_WHEN_RECEIVING);
                     var host = self._readAsciiString(data, UPLOAD_URL_HOST_STARTING_BYTE_INDEX_WHEN_RECEIVING, hostLength);

                     // read the port
                     var portLength = data.readUint8(UPLOAD_URL_PORT_LENGTH_BYTE_INDEX_WHEN_RECEIVING);
                     var portStr = self._readAsciiString(data, UPLOAD_URL_PORT_STARTING_BYTE_INDEX_WHEN_RECEIVING, portLength);
                     var port = parseInt(portStr);

                     // read the path
                     var pathLength = data.readUint8(UPLOAD_URL_PATH_LENGTH_BYTE_INDEX_WHEN_RECEIVING);
                     var path = self._readAsciiString(data, UPLOAD_URL_PATH_STARTING_BYTE_INDEX_WHEN_RECEIVING, pathLength);

                     // build the return object
                     var obj = {
                        host : host,
                        port : isNaN(port) ? portStr : port,
                        path : path
                     };

                     callback(null, obj);
                  }
                  else {
                     console.log("ERROR: getUploadTarget(): no data in the response!");
                     callback(null, null);
                  }
               }
            });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.setUploadUrl = function(hostPortPath, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            if (self.getApiSupport().canMutateUploadUrl()) {
               if (hostPortPath &&
                   isString(hostPortPath.host) &&
                   isNumeric(hostPortPath.port) &&
                   isString(hostPortPath.path)) {

                  // Clone the hostPortPath because we're going to modify it.  The given one might be immutable, but
                  // it's also kind of gross and rude to modify an object given to a function.
                  hostPortPath = cloneObject(hostPortPath);

                  // make sure the port is an int, and convert to a string
                  hostPortPath.portStr = parseInt(hostPortPath.port).toString();

                  // validate lengths
                  if (hostPortPath.host.length < UPLOAD_URL_HOST_MIN_LENGTH_AS_STRING || hostPortPath.host.length > UPLOAD_URL_HOST_MAX_LENGTH_AS_STRING) {
                     return callback(new Error("Invalid host length (" + hostPortPath.host.length + "). Host string length must be in the range [" + UPLOAD_URL_HOST_MIN_LENGTH_AS_STRING + "," + UPLOAD_URL_HOST_MAX_LENGTH_AS_STRING + "]"), null);
                  }
                  else if (hostPortPath.portStr.length < UPLOAD_URL_PORT_MIN_LENGTH_AS_STRING || hostPortPath.portStr.length > UPLOAD_URL_PORT_MAX_LENGTH_AS_STRING) {
                     return callback(new Error("Invalid port length (" + hostPortPath.portStr.length + "). Port string length must be in the range [" + UPLOAD_URL_PORT_MIN_LENGTH_AS_STRING + "," + UPLOAD_URL_PORT_MAX_LENGTH_AS_STRING + "]"), null);
                  }
                  else if (hostPortPath.path.length < UPLOAD_URL_PATH_MIN_LENGTH_AS_STRING || hostPortPath.path.length > UPLOAD_URL_PATH_MAX_LENGTH_AS_STRING) {
                     return callback(new Error("Invalid path length (" + hostPortPath.path.length + "). Path string length must be in the range [" + UPLOAD_URL_PATH_MIN_LENGTH_AS_STRING + "," + UPLOAD_URL_PATH_MAX_LENGTH_AS_STRING + "]"), null);
                  }
                  else {
                     // create the command
                     var command = self._createCommand(UPLOAD_URL_COMMAND_CHARACTER);

                     // make sure we're in write mode so we can set the host/port/path
                     command.writeUint8(UPLOAD_URL_WRITE_MODE_VALUE, UPLOAD_URL_READ_OR_WRITE_MODE_BYTE_INDEX);

                     // specify the lengths of the host/port/path
                     command.writeUint8(hostPortPath.host.length, UPLOAD_URL_HOST_LENGTH_BYTE_INDEX_WHEN_WRITING);
                     command.writeUint8(hostPortPath.portStr.length, UPLOAD_URL_PORT_LENGTH_BYTE_INDEX_WHEN_WRITING);
                     command.writeUint8(hostPortPath.path.length, UPLOAD_URL_PATH_LENGTH_BYTE_INDEX_WHEN_WRITING);

                     // write the host/port/path to the command
                     command.offset = UPLOAD_URL_HOST_STARTING_BYTE_INDEX_WHEN_WRITING;
                     command.writeString(hostPortPath.host);
                     command.offset = UPLOAD_URL_PORT_STARTING_BYTE_INDEX_WHEN_WRITING;
                     command.writeString(hostPortPath.portStr);
                     command.offset = UPLOAD_URL_PATH_STARTING_BYTE_INDEX_WHEN_WRITING;
                     command.writeString(hostPortPath.path);

                     self._enqueueCommand(command, function(err, data) {
                        if (err) {
                           console.log("ERROR: getUploadTarget(): failed to get the upload target: " + err);
                           callback(err, null);
                        }
                        else {
                           if (data) {

                              // read the host
                              var hostLength = data.readUint8(UPLOAD_URL_HOST_LENGTH_BYTE_INDEX_WHEN_RECEIVING);
                              var host = self._readAsciiString(data, UPLOAD_URL_HOST_STARTING_BYTE_INDEX_WHEN_RECEIVING, hostLength);

                              // read the port
                              var portLength = data.readUint8(UPLOAD_URL_PORT_LENGTH_BYTE_INDEX_WHEN_RECEIVING);
                              var portStr = self._readAsciiString(data, UPLOAD_URL_PORT_STARTING_BYTE_INDEX_WHEN_RECEIVING, portLength);
                              var port = parseInt(portStr);

                              // read the path
                              var pathLength = data.readUint8(UPLOAD_URL_PATH_LENGTH_BYTE_INDEX_WHEN_RECEIVING);
                              var path = self._readAsciiString(data, UPLOAD_URL_PATH_STARTING_BYTE_INDEX_WHEN_RECEIVING, pathLength);

                              // build the return object
                              var obj = {
                                 host : host,
                                 port : isNaN(port) ? portStr : port,
                                 path : path
                              };

                              callback(null, obj);
                           }
                           else {
                              console.log("ERROR: getUploadTarget(): no data in the response!");
                              callback(null, null);
                           }
                        }
                     });
                  }
               }
               else {
                  callback(new Error("Invalid specification of host/port/path"), null);
               }
            }
            else {
               return callback(new Error("The upload URL for this Speck cannot be modified."), null);
            }
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      this.putInCalibrationMode = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            var command = self._createCommand(PUT_IN_CALIBRATION_MODE_COMMAND_CHARACTER);
            self._enqueueCommand(command, function(err, data) {
               if (err) {
                  console.log("ERROR: putInCalibrationMode(): failed to put in calibration mode: " + err);
                  callback(err, null);
               }
               else {
                  if (data) {

                     // build the return object
                     var obj = {
                        isCalibrating : data.readUint8(PUT_IN_CALIBRATION_MODE_IS_CALIBRATING_BYTE_INDEX) == 1
                     };

                     callback(null, obj);
                  }
                  else {
                     console.log("ERROR: putInCalibrationMode(): no data in the response!");
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
       * Higher-level method which initiates a scan for wifi networks, polls the wifi status until scanning is complete,
       * and then returns a collection of available networks determined by the scan.
       *
       * @param {function} callback
       */
      this.scanAndGetAvailableNetworks = function(callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;

         if (self.isConnected()) {
            self.initiateWifiScan(function(err, scanResult) {
               if (err) {
                  console.log("ERROR: scanAndGetAvailableNetworks(): failed to initiate wifi scan: " + err);
                  callback(err, null);
               }
               else {
                  if (scanResult) {
                     if (scanResult.isScanning) {
                        var endTime = Date.now() + MAX_TIME_TO_SCAN_FOR_NETWORKS_IN_MILLIS;
                        var checkWifiStatus = function() {
                           self.getWifiStatus(function(err, wifiStatus) {
                              if (err) {
                                 console.log("ERROR: scanAndGetAvailableNetworks(): checkWifiStatus(): failed to check wifi status: " + err);
                                 callback(err, null);
                              }
                              else {
                                 if (wifiStatus) {
                                    // see whether it's still scanning
                                    if (wifiStatus.isScanning) {
                                       var now = Date.now();
                                       // see whether we've timed out
                                       if (now > endTime) {
                                          console.log("INFO: scanAndGetAvailableNetworks(): checkWifiStatus(): timeout while scanning for networks");
                                          callback(new Error("Timeout while trying to scan for wifi networks"), null)
                                       }
                                       else {
                                          console.log("DEBUG: scanAndGetAvailableNetworks(): checkWifiStatus(): waiting for scan to finish...");
                                          setTimeout(checkWifiStatus, 200);
                                       }
                                    }
                                    else {
                                       // done scanning!  Now just read the available networks...
                                       console.log("DEBUG: scanAndGetAvailableNetworks(): checkWifiStatus(): done scanning, now reading available networks...");
                                       self.getAvailableNetworks(wifiStatus.numAvailableNetworks, callback);
                                    }
                                 }
                                 else {
                                    console.log("ERROR: scanAndGetAvailableNetworks(): checkWifiStatus(): no data in the response from checking wifi status");
                                    callback(null, null);
                                 }
                              }
                           });
                        };

                        setTimeout(checkWifiStatus, 1);
                     }
                     else {
                        console.log("ERROR: scanAndGetAvailableNetworks(): failed to initiate wifi scan");
                        callback(null, null);
                     }
                  }
                  else {
                     console.log("ERROR: scanAndGetAvailableNetworks(): no data in the response from initiating wifi scan");
                     callback(null, null);
                  }
               }
            })
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      /**
       * Resets the Speck to its factory defaults by doing the following:
       * <ul>
       *    <li>Sets the sample interval to the default</li>
       *    <li>Sets the palette to the default</li>
       *    <li>Sets the value units to the default</li>
       *    <li>Erases and deactivates the feed API key</li>
       *    <li>Erases the wifi config</li>
       *    <li>Erases all data samples</li>
       *    <li>Reset the upload host/port/path</li>
       * </ul>
       * Progress is reported at each step to the <code>progressCallback</code> function by calling it and providing an
       * integer which specified the percentage of completion.
       *
       * @param {function} progressCallback - the progress callback function with a signature of the form <code>callback(percentComplete)</code>
       * @param {function} callback - the callback function with a signature of the form <code>callback(err, wasSuccessful)</code>
       */
      this.factoryReset = function(progressCallback, callback) {
         callback = (typeof callback === 'function') ? callback : Speck.DEFAULT_CALLBACK;
         progressCallback = (typeof progressCallback === 'function') ? progressCallback : function() {/* do nothing */
         };

         if (self.isConnected()) {
            var errors = [];
            console.log("Performing factory reset:");

            var factoryResetSteps = [
               // Logging interval
               function(done) {
                  console.log("1) Resetting logging interval to [" + com.specksensor.Speck.DEFAULT_LOGGING_INTERVAL_SECS + "] secs");
                  self.setLoggingInterval(com.specksensor.Speck.DEFAULT_LOGGING_INTERVAL_SECS, function(err, wasSuccessful) {
                     if (err || !wasSuccessful) {
                        errors.push("Failed to reset the sample interval.")
                     }
                     incrementAndPublishPercentageComplete();
                     done();
                  });
               },
               // Palette
               function(done) {
                  console.log("2) Resetting palette");
                  self.setPalette(com.specksensor.WifiSpeck.COLOR_PALETTES['Default'], function(err, wasSuccessful) {
                     if (err || !wasSuccessful) {
                        errors.push("Failed to reset the palette.")
                     }
                     incrementAndPublishPercentageComplete();
                     done();
                  });
               },
               // Value units
               function(done) {
                  console.log("3) Resetting displayed value units");
                  self.setScale(com.specksensor.WifiSpeck.SCALES['Count'], function(err, wasSuccessful) {
                     if (err || !wasSuccessful) {
                        errors.push("Failed to reset the data sample units.")
                     }
                     incrementAndPublishPercentageComplete();
                     done();
                  });
               },
               // Feed API key
               function(done) {
                  console.log("4) Erasing feed API key");
                  self.clearFeedApiKey(function(err, responseObj) {
                     if (err || !responseObj || !responseObj.success || responseObj.isFeedApiKeyEnabled) {
                        errors.push("Failed to erase the upload configuration settings.")
                     }
                     incrementAndPublishPercentageComplete();
                     done();
                  });
               },
               // Wifi
               function(done) {
                  console.log("5) Erasing wifi config");
                  self.removeAllStoredNetworks(function(err, responseObj) {
                     if (err || !responseObj || !responseObj.isRemoving) {
                        errors.push("Failed to erase the wi-fi configuration.")
                     }
                     incrementAndPublishPercentageComplete();
                     done();
                  });
               },
               // Data samples
               function(done) {
                  console.log("6) Erasing all data samples");
                  self.deleteAllSamples(function(err, wasSuccessful) {
                     if (err || !wasSuccessful) {
                        errors.push("Failed to erase all data samples.")
                     }
                     incrementAndPublishPercentageComplete();
                     done();
                  });
               },
               // Upload host/port/path
               function(done) {
                  if (self.getApiSupport().canMutateUploadUrl()) {
                     console.log("7) Resetting upload host/port/path");
                     var defaultHostPortPath = com.specksensor.WifiSpeck.UPLOAD_URL_DEFAULT_HOST_PORT_PATH;
                     self.setUploadUrl(defaultHostPortPath, function(err, newHostPortPath) {
                        if (err || !newHostPortPath ||
                            newHostPortPath.host != defaultHostPortPath.host ||
                            newHostPortPath.port != defaultHostPortPath.port ||
                            newHostPortPath.path != defaultHostPortPath.path) {
                           errors.push("Failed to reset the upload URL.")
                        }
                        incrementAndPublishPercentageComplete();
                        done();
                     });
                  }
                  else {
                     console.log("7) Not attempting to reset the upload host/port/path since it cannot be modified on this Speck.");
                     incrementAndPublishPercentageComplete();
                     done();
                  }
               }
            ];

            var stepIndex = 0;
            var incrementAndPublishPercentageComplete = function() {
               stepIndex++;
               var percentage = Math.round(100 * (stepIndex / factoryResetSteps.length));
               progressCallback(Math.min(Math.max(0, percentage), 100));
            };

            progressCallback(0);
            _.series(factoryResetSteps,
                     function() {
                        console.log("Factory reset complete!");
                        if (errors.length > 0) {
                           var err = new Error("Factory reset failed");
                           err.data = errors;
                           callback(err, false);
                        }
                        else {
                           callback(null, true);
                        }
                     });
         }
         else {
            callback(new Error("Not connected to a Speck!"), null);
         }
      };

      // ---------------------------------------------------------------------------------------------------------------
      // Implementations of Abstract Superclass Methods
      // ---------------------------------------------------------------------------------------------------------------

      this.__readSpeckConfigFromDevice = function(callback) {
         var command = self._createCommand(Speck.GET_INFO_COMMAND_CHARACTER);

         // we don't want to change the color palette or scale here, so make sure they're set to NO_CHANGE
         command.writeUint8(COLOR_PALETTE_NO_CHANGE_FLAG, COLOR_PALETTE_BYTE_INDEX_WHEN_WRITING);
         command.writeUint8(SCALE_NO_CHANGE_FLAG, SCALE_BYTE_INDEX_WHEN_WRITING);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: __readSpeckConfigFromDevice(): failed to get Speck config: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  // First, get the protocol version number
                  var protocolVersion = data.readUint8(PROTOCOL_VERSION_BYTE_INDEX);

                  // Construct the serial number by convert the data buffer to a hex string and then calling slice on
                  // it to pick out just the bytes which make up the serial number.
                  var serialNumber = data.toHex().slice(2 * SERIAL_NUMBER_STARTING_BYTE_INDEX, 2 * (SERIAL_NUMBER_ENDING_BYTE_INDEX + 1));

                  // get the colorPalette
                  var colorPaletteId = data.readUint8(COLOR_PALETTE_BYTE_INDEX_WHEN_READING);
                  var colorPalette = COLOR_PALETTES_BY_ID[colorPaletteId] || null;

                  // get the scale
                  var scaleId = data.readUint8(SCALE_BYTE_INDEX_WHEN_READING);
                  var scale = SCALES_BY_ID[scaleId] || null;

                  // build the return object
                  var obj = {
                     id : serialNumber,
                     protocolVersion : protocolVersion,
                     loggingIntervalSecs : data.readUint8(LOGGING_INTERVAL_BYTE_INDEX_WHEN_READING),
                     firmwareVersion : data.readUint8(FIRMWARE_VERSION_BYTE_INDEX),
                     hardwareVersion : data.readUint8(HARDWARE_VERSION_BYTE_INDEX),
                     colorPalette : colorPalette,
                     scale : scale
                  };

                  callback(null, obj);
               }
               else {
                  console.log("ERROR: __readSpeckConfigFromDevice(): no data in the response!");
                  callback(null, null);
               }
            }
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
                        rawParticleCount : data.readUint16(RAW_PARTICLE_COUNT_BYTE_INDEX),
                        temperature : data.readInt16(TEMPERATURE_BYTE_INDEX) / 10.0,
                        particleCount : data.readUint32(PARTICLE_COUNT_BYTE_INDEX),
                        particleConcentration : data.readUint32(PARTICLE_CONCENTRATION_BYTE_INDEX) / 10.0
                     };

                     // early wifi specks don't support humidity
                     if (self.getApiSupport().hasHumiditySensor()) {
                        obj['humidity'] = data.readUint8(HUMIDITY_BYTE_INDEX);
                     }
                  }

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

         // we don't want to change the color palette here, so make sure the color palette byte is set to NO_CHANGE
         command.writeUint8(COLOR_PALETTE_NO_CHANGE_FLAG, COLOR_PALETTE_BYTE_INDEX_WHEN_WRITING);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: setLoggingInterval(): failed to write logging interval: " + err);
               callback(err, null);
            }
            else {
               if (data) {
                  // read the value returned from the Speck and make sure it matches the value we asked for
                  var actualLoggingInterval = data.readUint8(LOGGING_INTERVAL_BYTE_INDEX_WHEN_READING);
                  var wasSuccessful = loggingIntervalInSeconds == actualLoggingInterval;
                  if (!wasSuccessful) {
                     console.log("ERROR: setLoggingInterval(): failed to set logging interval. Expected [" + loggingIntervalInSeconds + "], but received [" + actualLoggingInterval + "]");
                  }
                  callback(null, wasSuccessful);
               }
               else {
                  console.log("ERROR: setLoggingInterval(): no data in the response!");
                  callback(null, false);
               }
            }
         });
      };

      this.__deleteSample = function(sampleTimestampInSecs, callback) {
         deleteOneOrMoreSamples(sampleTimestampInSecs, false, callback);
      };

      // ---------------------------------------------------------------------------------------------------------------
      // Private Methods
      // ---------------------------------------------------------------------------------------------------------------

      var deleteOneOrMoreSamples = function(sampleTimestampInSecs, willDeleteAllSamples, callback) {
         var command = self._createCommand(Speck.DELETE_SAMPLE_COMMAND_CHARACTER);

         // timestamp only matters if we're deleting a single timestamp
         if (!willDeleteAllSamples) {
            command.writeUint32(sampleTimestampInSecs, DELETE_SAMPLE_AT_TIME_BYTE_INDEX);
         }

         // set the flag for deleting one or all samples
         command.writeUint8(willDeleteAllSamples ? DELETE_ALL_SAMPLES_FLAG : DELETE_ONE_SAMPLE_FLAG, DELETE_ONE_OR_ALL_SAMPLES_BYTE_INDEX);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               if (willDeleteAllSamples) {
                  console.log("ERROR: deleteOneOrMoreSamples(): failed to delete sample at time [" + sampleTimestampInSecs + "]: " + err);
               }
               else {
                  console.log("ERROR: deleteOneOrMoreSamples(): failed to delete all samples: " + err);
               }
               callback(err, null);
            }
            else {
               if (data) {
                  callback(null, data.readUint8(DELETE_SAMPLE_RESULT_BYTE_INDEX) == 1);
               }
               else {
                  console.log("ERROR: deleteOneOrMoreSamples(): no data in the response!");
                  callback(null, false);
               }
            }
         });
      };

      var getAvailableNetwork = function(callback) {
         var command = self._createCommand(GET_AVAILABLE_NETWORKS_COMMAND_CHARACTER);
         self._enqueueCommand(command, function(err, data) {
            if (err) {
               console.log("ERROR: getAvailableNetwork(): failed to get available networks: " + err);
               callback(err, null);
            }
            else {
               if (data) {

                  var obj = null;
                  var isValidEntry = data.readUint8(GET_AVAILABLE_NETWORKS_IS_VALID_ENTRY_BYTE_INDEX) == 1;
                  if (isValidEntry) {
                     // get the SSID length
                     var ssidLength = data.readUint8(GET_AVAILABLE_NETWORKS_SSID_LENGTH_BYTE_INDEX);

                     // clamp the length to the range [0, WIFI_SSID_MAX_LENGTH] (shouldn't be necessary, but...)
                     ssidLength = Math.min(Math.max(ssidLength, 0), WIFI_SSID_MAX_LENGTH);

                     if (ssidLength > 0) {
                        // read the SSID
                        var ssid = self._readAsciiString(data, GET_AVAILABLE_NETWORKS_SSID_STARTING_BYTE_INDEX, ssidLength);

                        // read the encryption type
                        var encryptionId = data.readUint8(GET_AVAILABLE_NETWORKS_ENCRYPTION_TYPE_BYTE_INDEX);
                        var encryption = WIFI_ENCRYPTION_PROTOCOLS_BY_ID[encryptionId] || null;

                        // conversion to dBM (decibel milliwats) is easy, just subtract 128:
                        // https://support.bluesound.com/hc/en-us/articles/201940663-What-should-my-Wireless-Signal-Strength-be-for-best-performance-
                        var signalStrengthRaw = data.readUint8(GET_AVAILABLE_NETWORKS_SIGNAL_STRENGTH_BYTE_INDEX);
                        var rssi = signalStrengthRaw - 128;
                        obj = {
                           ssid : ssid,
                           encryption : encryption,
                           signalStrength : getWifiSignalStrengthFromRssi(rssi)
                        };
                     }
                  }
                  callback(null, obj);

               }
               else {
                  console.log("ERROR: getAvailableNetwork(): no data in the response!");
                  callback(null, null);
               }
            }
         });
      };

      var getWifiSignalStrengthFromRssi = function(rssi) {

         for (var i = 0; i < WIFI_SIGNAL_STRENGTHS.length; i++) {
            if (rssi >= WIFI_SIGNAL_STRENGTHS[i].minRssi) {
               return {
                  id : WIFI_SIGNAL_STRENGTHS[i].id,
                  name : WIFI_SIGNAL_STRENGTHS[i].name,
                  rssi : rssi
               };
            }
         }

         // return the last one as the default
         return WIFI_SIGNAL_STRENGTHS[WIFI_SIGNAL_STRENGTHS.length - 1];
      };
   };

   // ------------------------------------------------------------------------------------------------------------------
   // Static Properties and Methods
   // ------------------------------------------------------------------------------------------------------------------
   com.specksensor.WifiSpeck.prototype = Object.create(Speck.prototype);
   com.specksensor.WifiSpeck.USB1 = Object.freeze({ "vendorId" : 0x2354, "productId" : 0x3335 });
   com.specksensor.WifiSpeck.USB2 = Object.freeze({ "vendorId" : 0x2B6E, "productId" : 0x3335 });

   /**
    * Returns <code>true</code> if the given <code>ssid</code> is a valid SSID; returns <code>false</code> otherwise.
    *
    * @param {string} ssid
    * @return {boolean}
    */
   com.specksensor.WifiSpeck.isValidSsid = function(ssid) {
      return isString(ssid) &&
             ssid.length > 0 &&
             ssid.length <= WIFI_SSID_MAX_LENGTH;
   };

   /** Returns an immutable object containing all the supported wifi encryption protocal names and IDs. */
   com.specksensor.WifiSpeck.getSupportedWifiEncryptionProtocols = function() {
      return WIFI_ENCRYPTION_PROTOCOLS_BY_ID;
   };

   /**
    * Returns <code>true</code> if the given <code>key</code> is a valid hex WEP key; returns <code>false</code>
    * otherwise.
    *
    * @param {string} key
    * @return {boolean}
    */
   com.specksensor.WifiSpeck.isValidHexWepKey = function(key) {
      return isString(key) &&                                        // is a string
             (key.length in WIFI_WEP_HEX_KEY_STRING_LENGTHS) &&      // of the proper length
             WIFI_WEP_HEX_KEY_REGEX.test(key);                       // consisting of hex characters
   };

   /**
    * Returns <code>true</code> if the given <code>key</code> is a valid ASCII WEP key; returns <code>false</code>
    * otherwise.
    *
    * @param {string} key
    * @return {boolean}
    */
   com.specksensor.WifiSpeck.isValidAsciiWepKey = function(key) {
      return isString(key) &&                                        // is a string
             (key.length in WIFI_WEP_ASCII_KEY_STRING_LENGTHS);      // of the proper length
   };

   /**
    * Returns <code>true</code> if the given <code>key</code> is a valid WPA key; returns <code>false</code> otherwise.
    *
    * @param {string} key
    * @return {boolean}
    */
   com.specksensor.WifiSpeck.isValidWpaKey = function(key) {
      return isString(key) &&                                        // is a string
             key.length > 0 &&                                       // not empty
             key.length <= WIFI_WPA_KEY_MAX_LENGTH;                  // and not too long
   };

   /**
    * Expects an object containing an <code>id</code> property and a <code>key</code> property. For the encryption to be
    * valid, the <code>id</code> must be a valid ID from one of the supported encryption protocols, and the
    * <code>key</code> must be valid for that specific type of encryption protocol.  The <code>key</code> is optional
    * and ignored for the "Open" encryption type.
    *
    * @param {object} encryption
    * @return {boolean}
    * @see com.specksensor.WifiSpeck.getSupportedWifiEncryptionProtocols()
    */
   com.specksensor.WifiSpeck.isValidEncryption = function(encryption) {
      return typeof encryption !== 'undefined' &&
             encryption != null &&
             (encryption['id'] in WIFI_ENCRYPTION_PROTOCOLS_BY_ID) &&
             WIFI_ENCRYPTION_PROTOCOLS_BY_ID[encryption['id']].isValidKey(encryption['key']);
   };

   // The valid encryption protocol types.  Define this down here so it can reference the validator methods.
   var WIFI_ENCRYPTION_PROTOCOLS_BY_ID = Object.freeze({
      0 : Object.freeze({
         name : "Open",
         id : 0,
         isValidKey : function() {
            return true;
         }
      }),
      1 : Object.freeze({
         name : "WEP",
         id : 1,
         isValidKey : function(key) {
            return com.specksensor.WifiSpeck.isValidHexWepKey(key) ||
                   com.specksensor.WifiSpeck.isValidAsciiWepKey(key);
         }
      }),
      2 : Object.freeze({
         name : "WPA",
         id : 2,
         isValidKey : function(key) {
            return com.specksensor.WifiSpeck.isValidWpaKey(key);
         }
      }),
      3 : Object.freeze({
         name : "WPA2",
         id : 3,
         isValidKey : function(key) {
            return com.specksensor.WifiSpeck.isValidWpaKey(key);
         }
      })
   });

   com.specksensor.WifiSpeck.WIFI_ENCRYPTION_PROTOCOLS = Object.freeze({ Open : 0, WEP : 1, WPA : 2, WPA2 : 3 });

   /**
    * Expects an object containing an <code>ssid</code> property and an <code>encyption</code> property. For the network
    * descriptor to be valid, the <code>ssid</code> must be a valid SSID, and the <code>encyption</code> must be
    * an object that <code>WifiSpeck.isValidEncryption()</code> considers valid.
    *
    * @param {object} network
    * @return {boolean}
    * @see com.specksensor.WifiSpeck.isValidSsid()
    * @see com.specksensor.WifiSpeck.isValidEncryption()
    */
   com.specksensor.WifiSpeck.isValidNetworkDescriptor = function(network) {
      return typeof network !== 'undefined' &&
             network != null &&
             com.specksensor.WifiSpeck.isValidSsid(network['ssid']) &&
             com.specksensor.WifiSpeck.isValidEncryption(network['encryption']);
   };

   com.specksensor.WifiSpeck.COLOR_PALETTES = Object.freeze({ "Default" : 0, "Colorblind" : 1 });
   com.specksensor.WifiSpeck.SCALES = Object.freeze({ "Count" : 0, "Concentration" : 1 });
   com.specksensor.WifiSpeck.UPLOAD_URL_DEFAULT_HOST_PORT_PATH = Object.freeze({
      "host" : "esdr.cmucreatelab.org",
      "port" : 80,
      "path" : "/api/v1/feed"
   });

})();