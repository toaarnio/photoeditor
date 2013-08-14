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
 * @author Tomi Aarnio, 2011
 */

goog.require('nokia.Storage');

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
   * Hides the image browser window and the vertical scroll bar.
   */
  jQuery.hideMainWindow = function() {
    $('#imageViewer').hide();               // hide the image browser window
    $('body').css('overflow-y', 'hidden');  // hide the vertical scroll bar
  }

  /**
   * Creates or unhides the image browser window.
   */
  jQuery.mainWindow = function () {

    $('body').css('overflow-y', 'auto');  // enable the vertical scroll bar

    var imageViewer = $('#imageViewer');
    if (imageViewer[0] !== undefined) {
      imageViewer.show();
      $('#container').hide();  // hide image editor image container
      $('#menu').hide();       // hide image editor menu buttons
      return;
    }
    
    console.log("$.mainWindow(): creating the image browser view");

    $("<div id='imageViewer'>").appendTo('body');

    hdr = $('<div/>');
    hdr.addClass("header ui-widget-header ui-widget");
    hdr.appendTo('#imageViewer');
    hdr.text('Local Storage');

    btnContainer = $('<div/>');
    btnContainer.addClass('header-button-container');
    btnContainer.appendTo(hdr);
    
    $.each(nokia.Storage.index(), function (name) {

      var img = $(nokia.Storage.loadThumbnail(name));

      img.appendTo('#imageViewer');

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
    
    var demoBtn = $('<button/>');
    demoBtn.text('Sample Images');
    demoBtn.button();
    demoBtn.appendTo(btnContainer);
    
    demoBtn.click(function() {
      nokia.Storage.loadDemoData();
      $.mainWindow();
    });

    var clearBtn = $('<buttons/>');
    clearBtn.text('Clear');
    clearBtn.button();
    clearBtn.appendTo(btnContainer);

    clearBtn.click(function() {
      if (confirm("Really remove all images?")) {
        nokia.Storage.clear();
        $.mainWindow();
      }
    });

    var removeBtn = btnContainer.addToggleButton('Remove').id('delete-image-button');

    removeBtn.click(function () {
      if ($(this).buttonValue()) {
        $('#imageViewer > img').addClass('delete-image');
      } else {
        $('#imageViewer > img').removeClass('delete-image');
      }
    });

    var fileInput = $('<input type="file" multiple="true" accept="image/*"/>');
    fileInput.css({ opacity: 0.0, display: 'none' });
    fileInput.appendTo(btnContainer);
    fileInput.change(function () {
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

    var loadBtn = $('<button/>');
    loadBtn.appendTo(btnContainer);
    loadBtn.text('Load From Disk');
    loadBtn.button();
    loadBtn.click(function() {
      fileInput.trigger('click');
    });

    btnContainer.buttonset();
  
    /**
     * Google Storage section
     */

    var googleHdr = $('<div/>')
      .addClass('header ui-widget-header ui-widget')
      .appendTo('#imageViewer')
      .text('Cloud Storage');

    var googleBtnContainer = $('<div/>')
      .addClass('header-button-container')
      .appendTo(googleHdr);

    var googleSearchBtn = $('<button/>');
    googleSearchBtn.text('Show');
    googleSearchBtn.button();
    googleSearchBtn.appendTo(googleBtnContainer);
    googleSearchBtn.click(function() {
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

    $('<div/>')
      .id('google-images')
      .appendTo("#imageViewer");

    /**
     * Picasa feed
     */

    var picasaHdr = $('<div/>')
      .addClass('header ui-widget-header ui-widget')
      .appendTo('#imageViewer')
      .text('Picasa Feed');

    picasaBtnContainer = $('<div/>')
      .addClass('header-button-container')
      .appendTo(picasaHdr);

    var picasaTagInput = $('<input>');
    picasaTagInput.appendTo(picasaBtnContainer);
    picasaTagInput.css('margin-right','1em');
    picasaTagInput.keydown(function (evt) {
      if (evt.keyCode == 13) {
        picasaSearchBtn.click();
      }
    });
  
    var picasaSearchBtn = $('<button/>');
    picasaSearchBtn.text('Show');
    picasaSearchBtn.button();
    picasaSearchBtn.appendTo(picasaBtnContainer);
    picasaSearchBtn.click(function() {
      $('#picasa-images img').remove();
      var picasaOptions = { 'max-results' : 20 };
      var picasaTag = picasaTagInput.val();
      if (picasaTag != "") {
        picasaOptions.tag = picasaTag;
      }
      $.updatePhotoFeed("Picasa", picasaOptions, '#picasa-images');
    });

    $('<div/>')
      .id('picasa-images')
      .appendTo("#imageViewer");

    $.showPhotoFeed("Picasa", '#picasa-images');

    /**
     * Flickr feed
     */

    flickrHdr = $('<div/>')
      .addClass('header ui-widget-header ui-widget')
      .appendTo('#imageViewer')
      .text('Flickr Feed');

    flickrBtnContainer = $('<div/>')
      .addClass('header-button-container')
      .appendTo(flickrHdr);

    var flickrTagInput = $('<input>');
    flickrTagInput.appendTo(flickrBtnContainer);
    flickrTagInput.css('margin-right','1em');
    flickrTagInput.keydown(function (evt) {
      if (evt.keyCode == 13) {
        flickrSearchBtn.click();
      }
    });
  
    var flickrSearchBtn = $('<button/>');
    flickrSearchBtn.text('Show');
    flickrSearchBtn.button();
    flickrSearchBtn.appendTo(flickrBtnContainer);
    flickrSearchBtn.click(function() {
      $('#flickr-images img').remove();
      var flickrOptions = {};
      flickrOptions.tags = flickrTagInput.val();
      $.updatePhotoFeed("Flickr", flickrOptions, '#flickr-images');
    });

    $('<div/>')
      .id('flickr-images')
      .appendTo("#imageViewer");

    $.showPhotoFeed("Flickr", '#flickr-images');

    /**
     * Instagram feed
     */

    instagramHdr = $('<div/>')
      .addClass('header ui-widget-header ui-widget')
      .appendTo('#imageViewer')
      .text('Instagram Feed');

    instagramBtnContainer = $('<div/>')
      .addClass('header-button-container')
      .appendTo(instagramHdr);

    var instagramSearchBtn = $('<button/>');
    instagramSearchBtn.text('Show');
    instagramSearchBtn.button();
    instagramSearchBtn.appendTo(instagramBtnContainer);
    instagramSearchBtn.click(function() {
      $('#instagram-images img').remove();
      var instagramOptions = {};
      $.updatePhotoFeed("Instagram", instagramOptions, '#instagram-images');
    });

    $('<div/>')
      .id('instagram-images')
      .appendTo("#imageViewer");

    $.showPhotoFeed("Instagram", '#instagram-images');

    /**
     * Drag & Drop support
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
