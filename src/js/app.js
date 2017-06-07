var speck = null;
var defaultHandler = function(err, result) {
   if (err) {
      console.log("ERROR: " + err);
   }
   else {
      console.log(JSON.stringify(result, null, 3));
   }
};

(function() {

   chrome.hid.onDeviceAdded.addListener(function(deviceInfo) {
      console.log("onDeviceAdded: HID device added: " + JSON.stringify(deviceInfo, null, 3));
   });

   chrome.hid.onDeviceRemoved.addListener(function(deviceId) {
      console.log("onDeviceRemoved: Device removed: [" + deviceId + "]");
      if (speck) {
         var hidDeviceInfo = speck.getHidDeviceInfo();
         if (hidDeviceInfo && hidDeviceInfo.deviceId == deviceId) {
            console.log("onDeviceRemoved: Device removed! Reloading the app...");
            chrome.runtime.reload()
         }
         else {
            console.log("onDeviceRemoved: A dfferent device [" + deviceId + "] was removed, not the one I'm connected to.");
         }
      }
      else {
         console.log("onDeviceRemoved: There's no speck instance, so there's nothing more to do.");
      }
   });

   var SPECK_CONNECTION_ATTEMPT_INTERVAL_MILLIS = 500;

   var connectToSpeck = function(callback) {
      com.specksensor.SpeckFactory.create(function(err, speck) {
         if (err) {
            console.log("Couldn't find any available Specks.");
            window.setTimeout(function() {
                                 connectToSpeck(callback);
                              },
                              SPECK_CONNECTION_ATTEMPT_INTERVAL_MILLIS);
         }
         else {
            if (speck) {
               callback(speck);
            }
            else {
               console.log("Couldn't find any Specks.");
               window.setTimeout(function() {
                                    connectToSpeck(callback);
                                 },
                                 SPECK_CONNECTION_ATTEMPT_INTERVAL_MILLIS);
            }
         }
      });
   };

   var loadData = function(){
      $("#button_panel").hide();
      $("#please_wait").show();

      console.log("Getting speck config...");
      speck.getSpeckConfig(function(err, config) {
         if (err) {
            $("#initialization_error").show();
            console.log("Error getting speck config: " + JSON.stringify(err, null, 3));
            var dialog = $("#unexpected_initialization_error_dialog_container");
            dialog.modal('show');
         }
         else {
            // Write the serial number and version info.  Split the serial number into groups of
            // four chars, separated by dashes (got this from http://stackoverflow.com/a/7033662/703200)
            $("#speck_serial_number").text(config.id.match(/.{1,4}/g).join('-'));
            $("#hardware_version").text(config.hardwareVersion);
            $("#firmware_version").text(config.firmwareVersion);
            $("#protocol_version").text(config.protocolVersion);

            $("#main_container").show();

            if (speck.getApiSupport().hasWifi()) {
               console.log("Getting wifi status...");
               speck.getWifiStatus(function(err, wifiStatus) {
                  if (err) {
                     $("#mac_address").text("Unknown");
                  }
                  else {
                     console.log("Got wifiStatus: " + JSON.stringify(wifiStatus, null, 3));
                     $("#mac_address").text(wifiStatus.macAddress.match(/.{1,2}/g).join(':'));
                  }
                  $("#please_wait").hide();
                  $("#button_panel").show();
                  console.log("Done loading data!");
               });
            }
            else {
               $("#mac_address").text("n/a");
               $("#please_wait").hide();
               $("#button_panel").show();
            }
         }
      });
   };
   
   var initialize = function() {
      connectToSpeck(function(theSpeck) {
         speck = theSpeck;

         $("#refresh_button").click(function() {
            loadData();
         });

         $("#calibration_mode_button").click(function() {
            $("#button_panel").hide();
            $("#please_wait").show();
            speck.putInCalibrationMode(function(err, result) {
               // determine which outcome dialog to show
               $("#please_wait").hide();
               if (err || !result || !result.isCalibrating) {
                  var dialog = $("#unexpected_calibration_mode_error_dialog_container");
                  dialog.modal('show');
               }
               else {
                  $("#calibration_mode_success").show();
               }
            });
         });

         // load the data
         $("#spinner").hide();
         loadData();
      });
   };

   window.addEventListener('load', initialize);
}());
