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
 * Common interface to Picasa and Flickr public photo feeds.  Adding
 * Twitpic and similar other services is probably trivial.
 *
 * @author Tomi Aarnio, 2011-
 */

(function ($) {

  /**
   * A flag indicating whether this browser supports the 'crossorigin'
   * attribute in <img> elements.  If it does not, or the target
   * service does not, we route the image via our own proxy server.
   */
  var browserSupportsCORS = true;

  /**
   * Photo feed descriptor for Flickr.
   */
  var flickrDescriptor = {

    // Flickr does not yet support Cross-Origin Resource Sharing
    //
    supportsCORS : false,

    // Base URL for querying the public photo feed
    //
    queryURL : "http://api.flickr.com/services/feeds/photos_public.gne?format=json&jsoncallback=?",

    // An array of image source URLs
    //
    imageURLs : [],

    // Extracts image source URLs from the Flickr JSON feed.
    //
    getImageURLs : function (json) {
      var urls = [];
      $.each(json.items, function (idx, item) {
        urls.push(item.media.m.replace('_m', ''));
      });
      return urls;
    }
  };

  /**
   * Photo feed descriptor for Picasa.
   */
  var picasaDescriptor = {
    supportsCORS    : true,
    queryURL        : "http://picasaweb.google.com/data/feed/api/all?alt=json&imgmax=d",
    imageURLs       : [],
    getImageURLs    : function (json) {
      var urls = [];
      if (json.feed.entry !== undefined) {
        $.each(json.feed.entry, function (idx, item) {
          urls.push(item.content.src);
        });
      }
      return urls;
    }
  };

  /**
   * Photo feed descriptor for Instagram.
   */
  var instagramDescriptor = {
    supportsCORS  : false,
    queryURL      : "https://api.instagram.com/v1/media/popular?client_id=58c5a0c0b247468eab7d6fc64d898059&callback=?",
    imageURLs     : [],
    getImageURLs    : function (json) {
      var urls = [];
      $.each(json.data, function (idx, item) {
        urls.push(item.images.standard_resolution.url);
      });
      return urls;
    }
  };
    
  /**
   * Photo feed descriptors for all supported services, indexed by the
   * service name.
   */
  var services = {
    'Flickr' : flickrDescriptor,
    'Picasa' : picasaDescriptor,
    'Instagram' : instagramDescriptor
  };

  /**
   * Retrieves and displays the latest photos from Flickr, Picasa, or
   * any other supported service (see the 'services' table above for
   * supported services).
   *
   * @param {String} serviceName the target service, e.g. 'Flickr'
   * @param {Object} serviceOptions service-specific query options,
   *                 e.g. { tag : 'nature' }
   * @param {String} targetSection id of the DOM element to put the
   *                 images in, e.g. '#flickr-images'
   */
  jQuery.updatePhotoFeed = function (serviceName, serviceOptions, targetSection) {
    
    var serviceDescriptor = services[serviceName];

    $.getJSON(serviceDescriptor.queryURL, serviceOptions,
              function(json) {
                serviceDescriptor.imageURLs = serviceDescriptor.getImageURLs(json);
                $.showPhotoFeed(serviceName, targetSection);
              });
  };

  /**
   * Displays the current set of photos on the main window.  Assumes
   * that the image source URLs have been already retrieved from the
   * service (see jQuery.updatePhotoFeed).
   *
   * @param {String} serviceName the target service: 'Flickr' or 'Picasa'
   * @param {String} targetSection id of the DOM element to put the
   *                 images in, e.g. '#flickr-images'
   */
  jQuery.showPhotoFeed = function(serviceName, targetSection) {

    console.log("$.showPhotoFeed("+serviceName+")");

    var photoList = services[serviceName].imageURLs;
    var useCORS = services[serviceName].supportsCORS && browserSupportsCORS;
    
    $.each(photoList, function (idx, imageURL) {

      var img = $('<img>');
      img.css({ cursor:'pointer' });
      if (useCORS) img.attr('crossorigin', 'anonymous'); 
      img.appendTo(targetSection);
      img.attr('src', imageURL);

      img.mousedown(function () {
        return false;
      });

      img.click(function () {
        console.log(this);
        $.imageEditWindow();

        if (useCORS == true) {
          $.updateCanvas(this);
          $.getCanvasObject().show();
          $.getContainer().data('image-name', serviceName + '_' + goog.now());
        }

        if (useCORS == false) {
          $.getJSON('http://webcl.nokiaresearch.com/photoeditor/cgi/getImage.py?callback=?',
                    { url : imageURL },
                    function(json) {
                      $.loadImageFromURL(json.data);
                      $.getContainer().data('image-name', serviceName + '_' + goog.now());
                    });
        }

      });
    });
  };

})(jQuery);
