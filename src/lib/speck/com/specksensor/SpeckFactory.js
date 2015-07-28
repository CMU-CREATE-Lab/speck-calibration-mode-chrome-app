//======================================================================================================================
//
// Class for enumerating and creating a Speck.
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
   var noNimbleMsg = "The Nimble library is required by com.specksensor.SpeckFactory.js";
   console.log(noNimbleMsg);
   throw new Error(noNimbleMsg);
}
if (!com.specksensor.Speck) {
   var noComSpecksensorSpeckMsg = "The com.specksensor.Speck library is required by com.specksensor.SpeckFactory.js";
   alert(noComSpecksensorSpeckMsg);
   throw new Error(noComSpecksensorSpeckMsg);
}
if (!com.specksensor.Speck) {
   var noComSpecksensorUsbSpeckMsg = "The com.specksensor.UsbSpeck library is required by com.specksensor.SpeckFactory.js";
   alert(noComSpecksensorUsbSpeckMsg);
   throw new Error(noComSpecksensorUsbSpeckMsg);
}
if (!com.specksensor.Speck) {
   var noComSpecksensorWifiSpeckMsg = "The com.specksensor.WifiSpeck library is required by com.specksensor.SpeckFactory.js";
   alert(noComSpecksensorWifiSpeckMsg);
   throw new Error(noComSpecksensorWifiSpeckMsg);
}
//======================================================================================================================

//======================================================================================================================
// CODE
//======================================================================================================================
(function() {

   com.specksensor.SpeckFactory = function() {
   };

   //===================================================================================================================
   // PUBLIC STATIC METHODS
   //===================================================================================================================

   /**
    * Scans for Speck devices and creates and returns to the callback a new instance of a {@link Speck} representing the
    * first Speck to which it could successfully connect. Returns <code>null</code> to the callback if no Specks are
    * plugged in or if a connection could not be established to any Speck.
    *
    * @param {function} callback Function with signature <code>callback(err, speck)</code> that will be called upon success or failure.
    * @see com.specksensor.SpeckFactory.enumerate
    */
   com.specksensor.SpeckFactory.create = function(callback) {
      // start by enumerating all the specks
      com.specksensor.SpeckFactory.enumerate(function(err, devices) {
         if (err) {
            console.log("ERROR: Speck.create(): failed to enumerate Specks due to error:" + err);
            return callback(err);
         }

         if (Array.isArray(devices) && devices.length > 0) {
            var speck = null;
            var error = null;
            var deviceConnectionAttemptFunctions = [];

            // create functions to attempt connections to each device, in series
            devices.forEach(function(device) {
               deviceConnectionAttemptFunctions.push(function(done) {
                  if (speck == null) {
                     var isWifiSpeck = (device.vendorId == com.specksensor.WifiSpeck.USB1.vendorId &&
                                        device.productId == com.specksensor.WifiSpeck.USB1.productId)
                                       ||
                                       (device.vendorId == com.specksensor.WifiSpeck.USB2.vendorId &&
                                        device.productId == com.specksensor.WifiSpeck.USB2.productId);
                     var theSpeck = isWifiSpeck ? new com.specksensor.WifiSpeck(device) : new com.specksensor.UsbSpeck(device);
                     theSpeck.connect(function(err, isInitialized) {
                        if (err) {
                           error = err;
                        }
                        else if (isInitialized) {
                           speck = theSpeck;
                        }
                        done();
                     });
                  }
                  else {
                     done();
                  }
               });
            });

            // try connecting to each device, in series
            _.series(deviceConnectionAttemptFunctions,
                     function() {
                        if (speck) {
                           return callback(null, speck);
                        }

                        return callback(error ? new Error(error) : null, null);
                     });
         }
         else {
            return callback(null, null);
         }
      });
   };

   /**
    * Enumerates all plugged-in Specks and returns them to the callback as an an array of HID device descriptor objects.
    * Returns an empty array if no Specks are plugged in.  Note that this method makes no guarantees about availability.
    * A device may currently be in use by another process.  The only way to determine availability is to attempt a
    * connection.
    *
    * @param {function} callback Function with signature <code>callback(err, devices)</code> that will be called upon success or failure.
    */
   com.specksensor.SpeckFactory.enumerate = function(callback) {
      chrome.hid.getDevices({ filters : [com.specksensor.UsbSpeck.USB, com.specksensor.WifiSpeck.USB1, com.specksensor.WifiSpeck.USB2] }, function(devices) {
         if (chrome.runtime.lastError) {
            console.log("ERROR: Error trying to enumerate the Speck devices: " + JSON.stringify(chrome.runtime.lastError, null, 3));
            return callback(new Error(chrome.runtime.lastError));
         }

         return callback(null, Array.isArray(devices) ? devices : []);
      });
   };
})();