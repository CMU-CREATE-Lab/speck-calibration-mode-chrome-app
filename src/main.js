chrome.app.runtime.onLaunched.addListener(function() {
   chrome.app.window.create('window.html', {
      id : "Speck Calibration Mode-inator",
      innerBounds : {
         width : 500,
         height : 300,
         maxWidth : 500,
         maxHeight : 300
      },
      resizable : false,
      focused : true
   });
});