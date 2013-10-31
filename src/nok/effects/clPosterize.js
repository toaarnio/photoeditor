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
 * WebCL implementation of k-means clustering of pixel colors, used to
 * achieve a Posterize effect.  Requires the 'posterize.cl' kernel
 * program.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2013
 */

goog.require('nokia.gl');
goog.require('nokia.cl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.clPosterize');

(function($) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.clPosterize = function () {
    nokia.Effect.call(this);
  };
    
  goog.inherits(nokia.effect.clPosterize, nokia.Effect);
  
  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var ENABLED = true;
  var effectName = "Posterize";
  var kernelName = "clPosterize";
  var kernelURI = "shaders/posterize.cl";
  var self = nokia.effect.clPosterize;

  /**
   * Initializes this Effect by setting up the necessary UI elements,
   * retrieving the image data from the 3D canvas, setting up WebCL
   * buffers, and executing the WebCL kernel with default parameters.
   */
  self.prototype.init = function() {

    console.log(effectName + " init");

    self.numColors = 16;
    self.maxColors = 256;
    self.clusters = new Float32Array(8*self.maxColors);
    
    var posterizeButton = $.getMenu().addSliderAttribute('Palette Size', {
      min   : 2,
      max   : self.maxColors,
      value : self.numColors,
      step  : 1
    });

    var posterizeFunc = function (evt, ui) {
      self.numColors = ui.value;
      self.apply(nokia.gl.textureFiltered, self.numColors);
    };

    self.initCL(nokia.cl.ctxIndex);

    // Posterization: The result goes to nokia.gl.textureFiltered.
    // Also bring up the slider to give the user a hint that it can be
    // adjusted.

    nokia.utils.Timer.start("Posterize");
    posterizeFunc(null, { value: self.numColors });
    self.apply(nokia.gl.textureFiltered, self.numColors);
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("Posterize") < 20 ? true : false;
    var sliderContainer = posterizeButton.data("attributeContainer").children();
    sliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", posterizeFunc);
    posterizeButton.click();
  };

  /**
   * Uninitializes this Effect.
   */
  self.prototype.uninit = function() {
    console.log(effectName + " uninit");
    self.uninitCL();
  };

  /**
   * Initializes the given CL context for this Effect.
   */
  self.initCL = function(clCtxIndex) {

    nokia.cl.selectContext(clCtxIndex);
    var ctx = nokia.cl.context;

    // Initialize WebCL buffers etc. to match the current image
    
    var useTexturing = false;
    nokia.gl.drawDefault(nokia.gl.context, nokia.gl.textureOriginal);
    nokia.cl.setupBuffers(nokia.gl.canvas, useTexturing);

    // Create buffer objects. Input and output buffers are already
    // created and filled in (by setupBuffers), so we just take a
    // reference to them.

    self.buffers = {};
    var numPixels = nokia.cl.width * nokia.cl.height;
    var numColorComponents = numPixels * 4;
    self.buffers.srcRGB = nokia.cl.bufIn;
    self.buffers.dstRGB = nokia.cl.bufOut;
    self.buffers.srcLAB = ctx.createBuffer(WebCL.MEM_READ_WRITE, numColorComponents*4);
    self.buffers.labels = ctx.createBuffer(WebCL.MEM_READ_WRITE, numPixels*2);
    self.buffers.clusters = ctx.createBuffer(WebCL.MEM_READ_WRITE, self.clusters.byteLength);
  };

  /**
   * Releases the CL resources allocated by this Effect.
   */
  self.uninitCL = function() {
    self.buffers.srcRGB.release();
    self.buffers.dstRGB.release();
    self.buffers.srcLAB.release();
    self.buffers.labels.release();
    self.buffers.clusters.release();
  };

  /**
   * Applies the Posterize filter on the current image, storing the result
   * in the given GL texture.
   */
  self.apply = function(dstTexture, numColors) {

    var ctx = nokia.cl.context;
    var queue = nokia.cl.cmdQueue;
    var width = nokia.cl.width;
    var height = nokia.cl.height;
    var ITER = 3;

    // Compute cluster layout, initialize cluster centers

    self.clusterLayout = layoutClusters(numColors, self.maxColors, width, height);
    setupClusterCenters(self.clusters, self.clusterLayout, width, height);
    var numClusters = self.clusterLayout.numClusters;
    var clustersPerRow = self.clusterLayout.clustersPerRow;
    var clustersPerCol = self.clusterLayout.clustersPerCol;
    var clusterWidth = width; // self.clusterLayout.clusterWidth;
    var clusterHeight = height; // self.clusterLayout.clusterHeight;
    console.log("numClusters vs. numColors:" + numClusters + ", " + numColors);

    // Get kernel objects

    var rgb2lab = nokia.cl.kernels[nokia.cl.ctxIndex]['rgb2lab'];
    var initializeLabels = nokia.cl.kernels[nokia.cl.ctxIndex]['initializeLabels'];
    var classifyPixels = nokia.cl.kernels[nokia.cl.ctxIndex]['classifyPixels'];
    var repositionClusters = nokia.cl.kernels[nokia.cl.ctxIndex]['repositionClusters'];
    var visualizeClusters = nokia.cl.kernels[nokia.cl.ctxIndex]['visualizeClusters'];
    var debugClusters = nokia.cl.kernels[nokia.cl.ctxIndex]['debugClusters'];

    // Get buffer objects

    var srcRGB = self.buffers.srcRGB;
    var srcLAB = self.buffers.srcLAB;
    var clusters = self.buffers.clusters;
    var labels = self.buffers.labels;
    var dstRGB = self.buffers.dstRGB;

    // Set kernel args

    function ui32(value) {
      if (!self.ui32) {
        console.log("creating new Uint32Array for setArg");
      }
      self.ui32 = self.ui32 || new Uint32Array(1);
      self.ui32[0] = value;
      return self.ui32;
    }

    function f32(value) {
      self.f32 = self.f32 || new Float32Array(1);
      self.f32[0] = value;
      return self.f32;
    }

    rgb2lab.setArg(0, srcLAB);
    rgb2lab.setArg(1, srcRGB);
    rgb2lab.setArg(2, ui32(width));
    rgb2lab.setArg(3, ui32(height));
    
    initializeLabels.setArg(0, labels);
    initializeLabels.setArg(1, ui32(width));
    initializeLabels.setArg(2, ui32(height));
    initializeLabels.setArg(3, ui32(clustersPerRow));
    initializeLabels.setArg(4, ui32(clustersPerCol));
    initializeLabels.setArg(5, ui32(numClusters));

    repositionClusters.setArg(0, clusters);
    repositionClusters.setArg(1, srcLAB);
    repositionClusters.setArg(2, labels);
    repositionClusters.setArg(3, ui32(width));
    repositionClusters.setArg(4, ui32(height));
    repositionClusters.setArg(5, f32(clusterWidth));
    repositionClusters.setArg(6, f32(clusterHeight));
    repositionClusters.setArg(7, ui32(numClusters));

    classifyPixels.setArg(0, labels);
    classifyPixels.setArg(1, srcLAB);
    classifyPixels.setArg(2, clusters);
    classifyPixels.setArg(3, f32(0.99)); // colorWeight
    classifyPixels.setArg(4, ui32(width));
    classifyPixels.setArg(5, ui32(height));
    classifyPixels.setArg(6, ui32(clustersPerRow));
    classifyPixels.setArg(7, ui32(clustersPerCol));
    classifyPixels.setArg(8, ui32(numClusters));

    visualizeClusters.setArg(0, dstRGB);
    visualizeClusters.setArg(1, srcRGB);
    visualizeClusters.setArg(2, clusters);
    visualizeClusters.setArg(3, labels);
    visualizeClusters.setArg(4, ui32(width));
    visualizeClusters.setArg(5, ui32(height));

    debugClusters.setArg(0, clusters);
    debugClusters.setArg(1, srcRGB);
    debugClusters.setArg(2, labels);
    debugClusters.setArg(3, ui32(width));
    debugClusters.setArg(4, ui32(height));
    debugClusters.setArg(5, ui32(clustersPerRow));
    debugClusters.setArg(6, ui32(clustersPerCol));
    debugClusters.setArg(7, ui32(numClusters));

    // Execute and draw
    
    queue.enqueueWriteBuffer(clusters, false, 0, numClusters*8*4, self.clusters, []);
    queue.enqueueNDRangeKernel(rgb2lab, 2, [], [width, height], [], []);
    queue.enqueueNDRangeKernel(initializeLabels, 2, [], [width, height], [], []);
    if (ITER === 0) {
      queue.enqueueNDRangeKernel(debugClusters, 1, [], [numClusters], [], []);
    } else {
      for (var i=0; i < ITER; i++) {
        queue.enqueueNDRangeKernel(classifyPixels, 2, [], [width, height], [], []);
        queue.enqueueNDRangeKernel(repositionClusters, 1, [], [numClusters], [], []);
      }
    }

    /* DEBUG
    var labelArray = new Uint16Array(width*height);
    queue.enqueueReadBuffer(labels, true, 0, labelArray.byteLength, labelArray, []);
    for (var i=0; i < labelArray.length; i++) {
      nokia.cl.dataOut[i*4] = labelArray[i];
      nokia.cl.dataOut[i*4+1] = labelArray[i];
      nokia.cl.dataOut[i*4+2] = labelArray[i];
    }
    */

    queue.enqueueNDRangeKernel(visualizeClusters, 2, [], [width, height], [], []);
    queue.enqueueReadBuffer(dstRGB, true, 0, nokia.cl.dataOut.byteLength, nokia.cl.dataOut, []);
    queue.finish();

    nokia.glu.texImage2D(dstTexture, nokia.cl.dataOut);
    nokia.Effect.glPaint();

    // Computes a balanced grid layout for the given number of clusters,
    // adjusting the number of clusters upwards until a suitably uniform
    // layout is reached.
    //
    function layoutClusters(numClusters, MAX_CLUSTERS, imgWidth, imgHeight) {

      function getSmallerFactor(K) {
        var max = Math.floor(Math.sqrt(K));
        for (var factor = max; (K % factor) !== 0; factor--);
        return factor;
      };

      do {
        var smaller = getSmallerFactor(numClusters);
        var larger = Math.floor(numClusters / smaller);
        var imageAspectRatio = imgWidth / imgHeight;
        var clusterAspectRatio = imageAspectRatio > 1.0 ? larger/smaller : smaller/larger;
        var allowedDiff = numClusters <= 256 ? 1.5 : 1.1;
        var tooWide = clusterAspectRatio > imageAspectRatio * allowedDiff;
        var tooThin = imageAspectRatio > clusterAspectRatio * allowedDiff;
        numClusters += (tooWide || tooThin) ? 1 : 0;
      } while ((tooWide || tooThin) && numClusters < MAX_CLUSTERS);

      var L = {};
      L.numClusters = numClusters;
      L.clustersPerRow = imageAspectRatio > 1.0 ? larger : smaller;
      L.clustersPerCol = imageAspectRatio > 1.0 ? smaller : larger;
      L.clusterWidth = imgWidth / L.clustersPerRow;
      L.clusterHeight = imgHeight / L.clustersPerCol;
      return L;
    };

    // Fills in the `clusters` array with (x, y) coordinates of cluster
    // centers, normalized to [0, 1] with respect to image dimensions.
    // The initial center coordinates are used as the starting point for
    // SLIC clustering.
    //
    function setupClusterCenters(clusters, clusterLayout, imgWidth, imgHeight) {
      var L = clusterLayout;
      var y = imgHeight / L.clustersPerCol / 2.0;
      for (var cy=0; cy < L.clustersPerCol; cy++) {
        var x = imgWidth / L.clustersPerRow / 2.0;
        for (var cx=0; cx < L.clustersPerRow; cx++) {
          var cidx = cy * L.clustersPerRow + cx;
          clusters[cidx*8 + 3] = x / imgWidth;
          clusters[cidx*8 + 4] = y / imgHeight;
          x += L.clusterWidth;
        }
        y += L.clusterHeight;
      }
    };
  };

  /**
   * Sets up the WebCL context (if necessary), loads and builds the
   * kernel program, and if all goes well, registers the effect.
   * This function is executed only once, at the time of loading
   * this script file.
   */

  if (ENABLED) {
    var success = nokia.cl.setupKernel(kernelURI);
    if (success === true) {
      nokia.EffectManager.register(effectName, self);
    }
  }

})(jQuery);
