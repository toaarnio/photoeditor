/*
 * This file is part of the Nokia WebCL project.
 *
 * This Source Code Form is subject to the terms of the
 * Mozilla Public License, v. 2.0. If a copy of the MPL
 * was not distributed with this file, You can obtain
 * one at http://mozilla.org/MPL/2.0/.
 *
 * The Original Contributor of this Source Code Form is
 * Nokia Research Tampere (http://webcl.nokiaresearch.com).
 */

/**
 * Image editor browsing/selection window.
 *
 * @author Timo Reunanen, 2010
 * @author Tomi Aarnio, 2010-
 */

//goog.require('nokia.Storage');  // not needed because local storage is disabled

(function ($) {

  /** 
   * Detect support for HTML5 FileReader.
   */
  var supportsFileLoad = (window.File && window.FileList && window.FileReader);
  if (!supportsFileLoad) {
    console.log("HTML5 File API not supported by this browser; local image loading disabled.");
    if (!window.FileReader) {
      window.FileReader = function() {};
      window.FileReader.prototype = {
        readAsDataURL: function () {}
      };
    }
  }

  /** 
   * Detect support for HTML5 FileSaver.
   */
  var supportsFileSave = window.FileSaver;
  if (!supportsFileSave) {
    console.log("HTML5 FileSaver API not supported by this browser; local image saving disabled.");
  }

  /**
   * Hides the image browser window and the vertical scroll bar, leaving
   * the editor window visible.
   */
  jQuery.hideMainWindow = function() {
    $('#imageViewer').hide();               // hide the image browser window
    $('body').css('overflow-y', 'hidden');  // hide the vertical scroll bar
  }

  /**
   * Creates (or unhides) the image browser window and hides the
   * editor window.
   */
  jQuery.mainWindow = function () {

    $('body').css('overflow-y', 'auto');  // enable the vertical scroll bar

    if ($('#imageViewer')[0] !== undefined) {
      $('#imageViewer').show();      // unhide image browser view
      $('#container').hide();        // hide image editor image container
      $('#menu').hide();             // hide image editor menu buttons
      return;
    }
    
    console.log("$.mainWindow(): creating the image browser view");

    $("<div id='imageViewer'>").appendTo('body');

    var topButtonContainer = null;

    /**
     * Browser Local Storage (DISABLED)
     *
     * Local storage is disabled because it's too small and too slow
     * to be useful in current browsers.
     */

    if (false) {
      var localStorageHeader = $('<div/>')
        .addClass('header ui-widget-header ui-widget')
        .appendTo('#imageViewer')
        .text('Browser Local Storage');

      var localStorageImageContainer = $('<div/>')
        .id('local-images')
        .appendTo("#imageViewer");

      var localStorageButtonContainer = $('<div/>')
        .buttonset()
        .addClass('header-button-container')
        .appendTo(localStorageHeader);

      $.each(nokia.Storage.index(), function (name) {

        var img = $(nokia.Storage.loadThumbnail(name));

        img.appendTo('#local-images');

        img.css({
          cursor:'pointer'
        });

        img.click(function() {
          if ($('#delete-image-button').buttonValue()) {
            // Remove from screen
            $(this).remove();

            // Untoggle button
            $('#delete-image-button').click();

            // Remove from storage
            nokia.Storage.remove(name);
          } else {
            // Load image
            $.loadImageFromStorage(name);

            // Display editor
            $.imageEditWindow();

            // Tell the editor the name of the image
            $.getContainer().data('image-name', name);
          }
        });

        img.mousedown(function () {
          return false;
        });
      });

      var demoButton = $('<button/>');
      demoButton.text('Sample Images');
      demoButton.button();
      demoButton.appendTo(localStorageButtonContainer);
    
      demoButton.click(function() {
        nokia.Storage.loadDemoData();
        $.mainWindow();
      });

      var clearButton = $('<buttons/>');
      clearButton.text('Clear');
      clearButton.button();
      clearButton.appendTo(localStorageButtonContainer);

      clearButton.click(function() {
        if (confirm("Really remove all images?")) {
          nokia.Storage.clear();
          $.mainWindow();
        }
      });

      var removeButton = localStorageButtonContainer.addToggleButton('Remove').id('delete-image-button');

      removeButton.click(function () {
        if ($(this).buttonValue()) {
          $('#local-images > img').addClass('delete-image');
        } else {
          $('#local-images > img').removeClass('delete-image');
        }
      });

      topButtonContainer = topButtonContainer || localStorageButtonContainer;
    }

    /**
     * Cloud Storage (DISABLED).
     *
     * This feature would require user credentials and authentication.
     */

    if (false) {
      var googleHeader = $('<div/>')
        .addClass('header ui-widget-header ui-widget')
        .appendTo('#imageViewer')
        .text('Cloud Storage');

      var googleImageContainer = $('<div/>')
        .id('google-images')
        .appendTo("#imageViewer");

      var googleButtonContainer = $('<div/>')
        .addClass('header-button-container')
        .appendTo(googleHeader);

      var googleSearchButton = $('<button/>');
      googleSearchButton.text('Refresh');
      googleSearchButton.button();
      googleSearchButton.appendTo(googleButtonContainer);
      googleSearchButton.click(function() {
        $('#google-images img').remove();
        var cloudImageURLs = [
          'http://commondatastorage.googleapis.com/webcl/shadows_n900_wide.jpg',
          'http://commondatastorage.googleapis.com/webcl/20110926_001_crop.jpg',
          'http://commondatastorage.googleapis.com/webcl/IMG_0011.JPG',
          'http://commondatastorage.googleapis.com/webcl/IMG_0031.JPG',
          'http://commondatastorage.googleapis.com/webcl/RedEyeTest3.jpg',
          'http://commondatastorage.googleapis.com/webcl/RedEyeTest.jpg'
        ];

        for (var i in cloudImageURLs) {
          var img = $('<img>');
          img.css({ cursor:'pointer' });
          //img.attr('crossorigin', 'anonymous');  // doesn't work on Google Storage yet
          img.appendTo('#google-images');
          img.attr('src', cloudImageURLs[i]);
          img.click(function () {
            console.log(this);
            $.imageEditWindow();
            $.getJSON('http://webcl.nokiaresearch.com/photoeditor/cgi/getImage.py?callback=?',
                      { url : this.src },
                      function(json) {
                        $.loadImageFromURL(json.data);
                        $.getContainer().data('image-name', 'cloud_' + '_' + goog.now());
                      });
          });
        }
      });

      topButtonContainer = topButtonContainer || googleButtonContainer;
    }

    /**
     * Picasa Feed
     *
     * In a real application we would show the user's own photo stream
     * here instead of the public feed.
     */

    if (true) {
      var picasaHeader = $('<div/>')
        .addClass('header ui-widget-header ui-widget')
        .appendTo('#imageViewer')
        .text('Picasa Feed');

      var picasaImageContainer = $('<div/>')
        .id('picasa-images')
        .appendTo("#imageViewer");

      var picasaButtonContainer = $('<div/>')
        .addClass('header-button-container')
        .appendTo(picasaHeader);

      var picasaTagInput = $('<input>');
      picasaTagInput.val('');
      picasaTagInput.appendTo(picasaButtonContainer);
      picasaTagInput.css('margin-right','1em');
      picasaTagInput.keydown(function (evt) {
        if (evt.keyCode == 13) {
          picasaSearchButton.click();
        }
      });
  
      var picasaSearchButton = $('<button/>');
      picasaSearchButton.text('Refresh');
      picasaSearchButton.button();
      picasaSearchButton.appendTo(picasaButtonContainer);
      picasaSearchButton.click(function() {
        $('#picasa-images img').remove();
        var picasaOptions = { 'max-results' : 20 };
        var picasaTag = picasaTagInput.val();
        if (picasaTag != "") {
          picasaOptions.tag = picasaTag;
        }
        $.updatePhotoFeed("Picasa", picasaOptions, '#picasa-images');
      }).click();

      topButtonContainer = topButtonContainer || picasaButtonContainer;
    }

    /**
     * Flickr Feed
     *
     * In a real application we would show the user's own photo stream
     * here instead of the public feed.
     */

    if (true) {
      var flickrHeader = $('<div/>')
        .text('Flickr Feed')
        .addClass('header ui-widget-header ui-widget')
        .appendTo('#imageViewer');

      var flickrImageContainer = $('<div/>')
        .id('flickr-images')
        .appendTo("#imageViewer");

      var flickrButtonContainer = $('<div/>')
        .addClass('header-button-container')
        .appendTo(flickrHeader);

      var flickrTagInput = $('<input>');
      flickrTagInput.val('portrait');
      flickrTagInput.appendTo(flickrButtonContainer);
      flickrTagInput.css('margin-right','1em');
      flickrTagInput.keydown(function (evt) {
        if (evt.keyCode == 13) {
          flickrSearchButton.click();
        }
      });
  
      var flickrSearchButton = $('<button/>');
      flickrSearchButton.text('Refresh');
      flickrSearchButton.button();
      flickrSearchButton.appendTo(flickrButtonContainer);
      flickrSearchButton.click(function() {
        $('#flickr-images img').remove();
        var flickrOptions = {};
        flickrOptions.tags = flickrTagInput.val();
        $.updatePhotoFeed("Flickr", flickrOptions, '#flickr-images');
      }).click();

      topButtonContainer = topButtonContainer || flickrButtonContainer;
    }

    /**
     * Instagram Feed (DISABLED)
     *
     * In a real application we would show the user's own photo stream
     * here instead of the public feed.
     */

    if (false) {
      var instagramHeader = $('<div/>')
        .addClass('header ui-widget-header ui-widget')
        .appendTo('#imageViewer')
        .text('Instagram Feed');

      var instagramImageContainer = $('<div/>')
        .id('instagram-images')
        .appendTo("#imageViewer");

      var instagramButtonContainer = $('<div/>')
        .addClass('header-button-container')
        .appendTo(instagramHeader);

      var instagramSearchButton = $('<button/>');
      instagramSearchButton.text('Refresh');
      instagramSearchButton.button();
      instagramSearchButton.appendTo(instagramButtonContainer);
      instagramSearchButton.click(function() {
        $('#instagram-images img').remove();
        var instagramOptions = {};
        $.updatePhotoFeed("Instagram", instagramOptions, '#instagram-images');
      }).click();

      topButtonContainer = topButtonContainer || instagramButtonContainer;
    }

    /**
     * Load From Disk
     */

    var fileInput = $('<input type="file" multiple="false" accept="image/*"/>');
    fileInput.css({ opacity: 0.0, display: 'none' });
    fileInput.appendTo(topButtonContainer);
    fileInput.change(function() {
      console.log("Loading ", this.files.length, "images...");
      if (this.files.length === 0) {
        return;
      }
      for (var i=0; i < this.files.length; i++) {
        var file = this.files[i];
        console.log("Reading file ", file.name);
        $.getContainer().data('image-name', file.name);
        var reader = new FileReader();
        reader.onload = $.fileOnload;
        reader.readAsDataURL(file);
      }
    });

    var loadButton = $('<button/>');
    loadButton.appendTo(topButtonContainer);
    loadButton.text('Load From Disk');
    loadButton.button();
    loadButton.click(function() {
      fileInput.trigger('click');
    });

    /**
     * About Box (redirect to another page)
     */

    var aboutButton = $('<button/>');
    aboutButton.appendTo(topButtonContainer);
    aboutButton.text('About');
    aboutButton.button();
    aboutButton.click(function() {
      window.location = '/demos.html';
    });

    topButtonContainer.buttonset();

    /**
     * Drag & Drop
     */

    document.addEventListener("dragover", function(e) {
      if (e.dataTransfer.dropEffect == "move") {
        e.preventDefault();
      }
    }, true);

    document.addEventListener("drop", function(evt) {
      //console.log("Drag & dropped ", evt.dataTransfer);
      evt.preventDefault();
      if (evt.dataTransfer.files.length > 0) {
        var file = evt.dataTransfer.files[0];
        var reader = new FileReader();
        $.getContainer().data('image-name', file.name);
        reader.onload = $.fileOnload;
        reader.readAsDataURL(file);
      }
    }, false);

  };

  jQuery.fileOnload = function (evt) {
    console.log("FileReader onload(): loaded", evt.target.result.length, "bytes");
    $.loadImageFromURL(evt.target.result);
    $.imageEditWindow();
  };

  $(document).ready(function() {
    $.mainWindow();
  });

})(jQuery);
