/**
 * SLIC superpixel implementation in OpenCL C.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2013
 */

/*******************************************************************************
 *
 *      C O L O R   S P A C E   C O N V E R S I O N
 *
 ******************************************************************************/

// sRGB -> CIE XYZ conversion matrix, assumes D65 illuminant (daylight)
//
constant float3 toXYZ[3] = {
  { 0.4124f, 0.3576f, 0.1805f },
  { 0.2126f, 0.7152f, 0.0722f },
  { 0.0193f, 0.1192f, 0.9505f }
};

// CIE XYZ -> sRGB conversion matrix, assumes D65 illuminant (daylight)
//
constant float3 toRGB[3] = {
  { 3.2406f, -1.5372f, -0.4986f },
  {-0.9689f,  1.8758f,  0.0415f },
  { 0.0557f, -0.2040f,  1.0570f }
};

// Reference illuminant for CIE XYZ <-> CIELab conversion: D65 (daylight)
//
constant float3 refXYZ = { 95.05f, 100.00f, 108.90f };

// Converts from sRGB to CIE XYZ. The input values are assumed to be
// in [0, 1].
//
float3 rgb2xyz(float3 rgb) {
  float3 powRGB = pow((rgb+0.055f)/1.055f, 2.4f);
  float3 sclRGB = rgb / 12.92f;
  float3 resRGB = select(sclRGB, powRGB, rgb > 0.04045f) * 100.0f;  // [7.77, 100.00]
  float X = dot(resRGB, toXYZ[0]);  // max = 95.05
  float Y = dot(resRGB, toXYZ[1]);  // max = 100.0
  float Z = dot(resRGB, toXYZ[2]);  // max = 108.9
  return (float3)(X, Y, Z);
}

// Converts from CIE XYZ to sRGB. The output values are in [0, 1].
//
float3 xyz2rgb(float3 xyz) {
  float3 XYZ = xyz / 100.0f;
  float R = dot(XYZ, toRGB[0]);
  float G = dot(XYZ, toRGB[1]);
  float B = dot(XYZ, toRGB[2]);
  float3 RGB = { R, G, B };
  float3 powRGB = 1.055f * pow(RGB, (1.0f/2.4f)) - 0.055f;
  float3 sclRGB = 12.92f * RGB;
  float3 resRGB = select(sclRGB, powRGB, RGB > 0.0031308f);
  return resRGB;
}

// Converts from CIE XYZ to CIE Lab.
//
float3 xyz2lab(float3 xyz) {
  float3 normXYZ = xyz / refXYZ;                                // max = 1.0
  float3 powXYZ = pow(normXYZ, 1.0f/3.0f);                      // max = 1.0
  float3 sclXYZ = normXYZ * 7.787f + 16.0f/116.0f;              // max < 1.0
  float3 resXYZ = select(sclXYZ, powXYZ, normXYZ > 0.008856f);  // max = 1.0
  float L = 116.0f * resXYZ.y - 16.0f;                          // [0, 100]
  float a = 500.0f * (resXYZ.x - resXYZ.y);                     // [-500, 500]
  float b = 200.0f * (resXYZ.y - resXYZ.z);                     // [-200, 200]
  return (float3)(L, a, b);
}

// Converts from CIE Lab to CIE XYZ.
//
float3 lab2xyz(float3 lab) {
  float Y = (lab.s0 + 16.0f) / 116.0f;
  float X = (lab.s1 / 500.0f) + Y;
  float Z = Y - (lab.s2 / 200.0f);
  
  float3 XYZ = { X, Y, Z };
  float3 powXYZ = pow(XYZ, 3.0f);
  float3 sclXYZ = (XYZ - 16.0f/116.0f) / 7.787f;
  float3 resXYZ = select(sclXYZ, powXYZ, XYZ > 0.008856f);
  return resXYZ * refXYZ;
}

// Normalizes the given CIELab color to the [0, 1] range.
// The input color is assumed to have been converted from
// 8-bit sRGB and assuming daylight illumination (D65), so
// the min/max values of each component are as follows:
//
// L = [   0.0, 100.0] => range = 100.0
// a = [ -86.2,  98.1] => range = 184.3
// b = [-107.9,  94.4] => range = 202.3
//
// The values are rounded to one decimal place and away
// from zero, so that for example -16.11 gets rounded to
// -16.2.
//
float3 normalizeLab(float3 lab) {
  lab.x = lab.x / 100.0f;
  lab.y = (lab.y + 86.2f) / 184.3f;
  lab.z = (lab.z + 107.9f) / 202.3f;
  return lab;
}

// Converts the given CIELab color values from the normalized
// [0, 1] range to the standard range.
//
float3 denormalizeLab(float3 lab) {
  lab.x = lab.x * 100.0f;
  lab.y = lab.y * 184.3f - 86.2f;
  lab.z = lab.z * 202.3f - 107.9f;
  return lab;
}

// Converts each pixel from 8-bit sRGB to floating-point CIELab,
// normalized to [0, 1].
//
// Invocation: One kernel instance per pixel
// 
kernel void rgb2lab(global float4* dst, global const uchar4* src, uint width, uint height) {
  uint x = get_global_id(0);
  uint y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;

  uint index = y * width + x;
  float3 rgbf = convert_float3(src[index].xyz) / 255.0f;
  float3 xyz = rgb2xyz(rgbf);
  float3 lab = xyz2lab(xyz);
  float3 norm = normalizeLab(lab);
  dst[index] = (float4)(norm, 0.0f);
}

// Converts each pixel from normalized floating-point CIELab to
// regular 8-bit sRGB.
//
// Invocation: One kernel instance per pixel
//
kernel void lab2rgb(global uchar4* dst, global float4* src, uint width, uint height) {
  uint x = get_global_id(0);
  uint y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;

  uint index = y * width + x;
  float3 norm = src[index].xyz;
  float3 lab = denormalizeLab(norm);
  float3 xyz = lab2xyz(lab);
  float3 rgbf = xyz2rgb(xyz);
  uchar3 rgb8 = convert_uchar3(rgbf * 255.0f + 0.5f);
  dst[index] = (uchar4)(rgb8, 0);
}

/*******************************************************************************
 *
 *      C L U S T E R I N G
 *
 ******************************************************************************/

float labxyDistance(float3 lab1, float3 lab2, float2 xy1, float2 xy2, float colorWeight, float S, float m) {
  float dLab = fast_distance(lab1, lab2);
  float dXY = fast_distance(xy1, xy2) / sqrt(2.0f);
  float2 dists = (float2)(dLab, dXY);
  float2 weights = (float2)(colorWeight, 1.0f-colorWeight);
  float distance = dot(dists, weights);
  return distance;
}

// Labels each pixel with the index of the cluster that it initially
// belongs to.
//
// Invocation: One kernel instance per pixel
//
kernel void initializeLabels(global ushort* labels,
                             uint width,
                             uint height,
                             uint clustersPerRow,
                             uint clustersPerCol,
                             uint numClusters)
{
  uint x = get_global_id(0);
  uint y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;

  float2 coords = (float2) (x, y);
  float clusterWidth = (float) width / clustersPerRow;
  float clusterHeight = (float) height / clustersPerCol;
  float2 clusterDims = (float2) (clusterWidth, clusterHeight);
  float2 clusterCoords = (float2) floor(coords/clusterDims);

  uint index = y * width + x;
  uint clusterIndex = clusterCoords.y * clustersPerRow + clusterCoords.x;
  clusterIndex = clamp(clusterIndex, 0u, numClusters-1);
  labels[index] = clusterIndex;
}

// Repositions each cluster center to the mean [L a b x y] of all
// pixels within the given search window that are labeled with
// the ID of that cluster.
//
// Invocation: One thread per cluster.
//
// Precondition: Pixel labels must be initialized.
//
// Complexity: O(K*W), where
//   K = # of clusters (one thread per cluster)
//   W = # of pixels in search window (inverse proportional to K)
//
kernel void repositionClusters(global float8* clusters,
                               global const float4* pixels,
                               global const ushort* labels,
                               uint width,
                               uint height, 
                               float clusterWidth,
                               float clusterHeight,
                               uint numClusters)
{
  uint cidx = get_global_id(0);
  if (cidx >= numClusters) return;

  // STEP 1. Intersect search window with image boundaries

  float2 dims = (float2)(width, height);
  float2 clusterCenter = clusters[cidx].s34 * dims;
  float2 searchWindowSize = (float2)(clusterWidth, clusterHeight);
  float4 searchWindow = (float4)(clusterCenter-searchWindowSize, clusterCenter+searchWindowSize);
  int2 upper = convert_int2(max(searchWindow.s01, (float2)(0.0f, 0.0f)));
  int2 lower = convert_int2(min(searchWindow.s23, dims-1.0f));

  // STEP 2. Add up the color and xy contributions of all
  //         pixels that belong to the current cluster

  float n = 0.0f;
  float2 xy = 0.0f;
  float3 color = 0.0f;
  for (int y = upper.y; y <= lower.y; y++) {
    for (int x = upper.x; x <= lower.x; x++) {
      int i = y * width + x;
      if (labels[i] == cidx) {
        color += pixels[i].xyz;
        xy += (float2)(x, y) / dims;
        n += 1.0f;
      }
    }
  }

  // STEP 3. Store cluster average color and coordinates.

  clusters[cidx] = (float8) (color/n, xy/n, 0.0f, 0.0f, 0.0f);
}

// Labels each pixel with the index of the cluster that is nearest to
// it in RGBXY space. Invocation pattern: One thread / pixel.
//
// Preconditions: Clusters must be initialized.
//
// Complexity: O(N*K), where
//   N = number of pixels (one thread per pixel)
//   K = number of clusters to search (currently 9)
//
// TODO OPTIMIZE FOR GPU:
//   * Set local workgroup size to [16, 16] or some fixed amount
//   * Prefetch the 9 nearby clusters into local memory on one thread
//   * barrier(CLK_LOCAL_MEM_FENCE)
//   * For each pixel, compute distance to each of the 9 clusters
//   * Label the pixel with the ID of the nearest cluster
//
kernel void classifyPixels(global ushort* labels,
                           global const float4* pixels,
                           global const float8* clusters,
                           float colorWeight,
                           uint width,
                           uint height, 
                           uint clustersPerRow,
                           uint clustersPerCol,
                           uint numClusters)
{
  uint x = get_global_id(0);
  uint y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;
  uint index = y * width + x;

  // Normalize this pixel's coordinates to the [0, 1] range,
  // where (1, 1) is the bottom right corner.  CIELab colors
  // are already "pseudo-normalized" so that (1, 1, 1) is the
  // component-wise maximum (not all colors in the [0, 1]^R3
  // range are valid, but we ignore that).
  
  float2 xy = (float2)(x, y) / (float2)(width, height);
  float3 lab = pixels[index].xyz;

  // Identify the cluster that this pixel was assigned to in
  // the initial grid layout.  That cluster may no longer be
  // the nearest one, but we will nonetheless use it as the
  // starting point.

  float2 coords = (float2) (x, y);
  float clusterWidth = (float) width / clustersPerRow;
  float clusterHeight = (float) height / clustersPerCol;
  float2 clusterDims = (float2) (clusterWidth, clusterHeight);
  int2 clusterCoords = convert_int2(floor(coords/clusterDims));

  // Identify the cluster that this pixel is currently assigned
  // to. This scheme is an alternative to the above; the results
  // are roughly the same, but performance is radically worse on
  // the Intel OpenCL CPU driver.

  //ushort clusterIndex = labels[index];
  //int2 clusterCoords = (int2)(clusterIndex % clustersPerRow, clusterIndex / clustersPerRow);

  // Search a 3x3 region of clusters around the cluster that was
  // selected above.  The search region is clipped to the image 
  // boundaries, so the 3x3 region shrinks to 2x3 on the edges 
  // and 2x2 in the corners.

  int2 searchDims = (int2)(1, 1);
  int4 searchGrid = (int4)(clusterCoords-searchDims, clusterCoords+searchDims);
  int2 mn = max(searchGrid.s01, (int2)(0, 0));
  int2 mx = min(searchGrid.s23, (int2)(clustersPerRow-1, clustersPerCol-1));

  // DEBUG
  mn = (int2)(0, 0);
  mx = (int2)(clustersPerRow-1, clustersPerCol-1);

  // Compute S and m

  float S = sqrt(1.0f/numClusters);
  float m = max(0.000001f, 1.0f-colorWeight);

  // Loop through the nearby clusters, select the nearest

  float minDistance = 1e9f;
  ushort label = 65535;

  for (int cy = mn.y; cy <= mx.y; cy++) {
    for (int cx = mn.x; cx <= mx.x; cx++) {
      int cidx = cy * clustersPerRow + cx;
      float3 LAB = clusters[cidx].s012;
      float2 XY = clusters[cidx].s34;
      float dist = labxyDistance(LAB, lab, XY, xy, colorWeight, S, m);
      if (dist < minDistance) {
        minDistance = dist;
        label = cidx;
      }
    }
  }

  // Label the current pixel with the index of the
  // nearest cluster.

  labels[index] = label;
}

// A replacement for repositionClusters that turns each cluster
// into a shade of color based solely on its index.
//
kernel void debugClusters(global float8* clusters,
                          global const uchar4* pixels,
                          global const ushort* labels,
                          uint width,
                          uint height,
                          uint clustersPerRow,
                          uint clustersPerCol,
                          uint numClusters)
{
  uint cidx = get_global_id(0);
  if (cidx >= numClusters) return;

  float3 lab = (float3)(0.0f);
  uint row = cidx / clustersPerRow;

  if ((cidx % 2) == 0) {
    lab.s0 = 0.25f + 0.5f * convert_float(row) / convert_float(clustersPerCol);
    lab.s1 = 0.45f;
    lab.s2 = 0.45f;
  } else {
    lab.s0 = 0.75f - 0.5f * convert_float(row) / convert_float(clustersPerCol);
    lab.s1 = 0.34f;
    lab.s2 = 0.56f;
  }

  clusters[cidx].s012 = lab;
}

// Visualizes per-pixel labels using cluster average color.
//
// Invocation: One kernel instance per pixel
//
kernel void visualizeClusters(global uchar4* dst,
                              global uchar4* src,
                              global const float8* clusters,
                              global const ushort* labels,
                              uint width, uint height)
{
  uint x = get_global_id(0);
  uint y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;

  uint index = y * width + x;
  ushort label = labels[index];
  float3 normLab = clusters[label].s012;
  float3 lab = denormalizeLab(normLab);
  float3 xyz = lab2xyz(lab);
  float3 rgb = xyz2rgb(xyz);
  int3 RGB = convert_int3(rgb * 255.0f + 0.5f);
  dst[index].xyz = convert_uchar3(RGB);
  dst[index].w = 255;
}

kernel void maskWithAlpha(global uchar4* dst,
                          global uchar4* mask,
                          uint width, uint height)
{
  uint x = get_global_id(0);
  uint y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;
  
  uint index = y * width + x;
  float3 color = convert_float3(dst[index].xyz) / 255.0f;
  float3 rgba = convert_float3(mask[index].xyz) / 255.0f;
  color *= (1.0f - 0.6f*rgba.x);
  dst[index].xyz = convert_uchar3_sat(color * 255.0f);
}

// Computes the weighted coverage of each cluster (superpixel). If the
// coverage is more than 50%, set the cluster average [L a b] color to
// zero (magenta).
//
// Invocation: One thread per cluster.
//
// Precondition: Pixel labels must be initialized.
//
// Complexity: O(K*W), where
//   K = # of clusters (one thread per cluster)
//   W = # of pixels in search window (inverse proportional to K)
//
kernel void segmentWithAlphaMask(global float8* clusters,
                                 global const ushort* labels,
                                 global const uchar4* mask,
                                 uint width,
                                 uint height, 
                                 float clusterWidth,
                                 float clusterHeight,
                                 uint numClusters)
{
  uint cidx = get_global_id(0);
  if (cidx >= numClusters) return;

  // STEP 1. Intersect search window with image boundaries

  float2 dims = (float2)(width, height);
  float2 clusterCenter = clusters[cidx].s34 * dims;
  float2 searchWindowSize = (float2)(clusterWidth, clusterHeight);
  float4 searchWindow = (float4)(clusterCenter-searchWindowSize, clusterCenter+searchWindowSize);
  int2 upper = convert_int2(max(searchWindow.s01, (float2)(0.0f, 0.0f)));
  int2 lower = convert_int2(min(searchWindow.s23, dims-1.0f));

  // STEP 2. Compute the weighted coverage mask for all
  //         pixels that belong to the current cluster

  float coverage = 0.0f;
  float n = 0.0f;
  for (int y = upper.y; y <= lower.y; y++) {
    for (int x = upper.x; x <= lower.x; x++) {
      int i = y * width + x;
      if (labels[i] == cidx) {
        uchar alpha = mask[i].x;
        coverage += convert_float(alpha) / 255.0f;
        n += 1.0f;
      }
    }
  }

  // STEP 3. Set the cluster average color to zero if the
  //         coverage is more than 50%.
  //
  if (coverage/n > 0.8f) {
    clusters[cidx].s567 = 0.0f;
  } else {
    clusters[cidx].s567 = clusters[cidx].s012;
  }
}

/***********************************************************************
 *
 * SURPLUS CODE REPOSITORY
 *
 **********************************************************************/

// Updates each cluster center to be the mean [r g b x y] of all pixels
// belonging to the cluster.
//
// Invocation: One kernel instance per cluster.
//
// Precondition: Labels must be initialized.
//
// Complexity: O(K*N), parallel on K
//
// TODO Each kernel instance currently loops through every pixel, which
// is s-l-o-w. Should limit the search to an M x N window around each
// cluster center.
//
kernel void updateClusters(global float8* clusters,
                           global const uchar4* src,
                           global const ushort* labels,
                           uint width, uint height, uint numClusters)
{
  uint cidx = get_global_id(0);
  if (cidx >= numClusters) return;

  float3 rgb = 0.0f;
  float2 xy = 0.0f;
  float2 dims = (float2)(width, height);

  uint n=0;
  for (int y=0; y < height; y++) {
    for (int x=0; x < width; x++) {
      int i = y * width + x;
      uint label = labels[i];
      if (label == cidx) {
        rgb += convert_float3(src[i].s012) / 255.0f;
        xy += (float2)(x, y) / dims;
        n++;
      }
    }
  }
  clusters[cidx] = ((float8) (rgb, xy, 0.0f, 0.0f, 0.0f)) / ((float) n);
}

float rgbxyDistance(float3 rgb1, float3 rgb2, float2 xy1, float2 xy2, float colorWeight, float S, float m) {
#if 1
  float rgbDistance = fast_distance(rgb1, rgb2);                     // [0, sqrt(3)]
  float xyDistance = fast_distance(xy1, xy2);                        // [0, sqrt(2)]
  float distance = fast_distance(rgbDistance/m, xyDistance/S);       // small m ==> more weight for color
#else
  float rgb = fast_distance(rgb1, rgb2) / sqrt(3.0f);         // [0, 1]
  float xy = fast_distance(xy1, xy2) / sqrt(2.0f);            // [0, 1]
  float2 rgbxy = (float2)(rgb, xy);                           // [0, 1] x [0, 1]
  float2 weights = (float2)(colorWeight, 1.0f-colorWeight);   // (w, 1-w);
  float distance = dot(rgbxy, weights);                       // [0, 1]
  //float2 weighted = rgbxy * weights;                          // [0, w] x [0, 1-w]
  //float distance = fast_distance(weighted.x, weighted.y);     // [0, sqrt(w^2+(1-w)^2)] = [0, 1]
#endif
  return distance;
}

// Computes the minimum and maximum CIELab color values
// that can be obtained when converting from 8-bit RGB.
//
kernel void findLabRange(global float4* res) {
  float3 minLab = (float3)(1000.0f, 1000.0f, 1000.0f);
  float3 maxLab = (float3)(-1000.0f, -1000.0f, -1000.0f);
  for (int b=0; b <= 255; b++) {
    for (int g=0; g <= 255; g++) {
      for (int r=0; r < 255; r++) {
        float3 rgb = convert_float3((int3) (r, g, b)) / 255.0f;
        float3 xyz = rgb2xyz(rgb);
        float3 lab = xyz2lab(xyz);
        minLab = min(minLab, lab);
        maxLab = max(maxLab, lab);
      }
    }
  }
  res[0] = (float4)(minLab, 0.0f);
  res[1] = (float4)(maxLab, 0.0f);
}

// Computes the maximum component-wise error for converting
// from RGB to CIELab and back. Simply iterates over all 
// possible 2^24 RGB values.
//
kernel void findMaxColorConversionError(global float4* res) {
  float3 minErr = (float3)(1000.0f, 1000.0f, 1000.0f);
  float3 maxErr = (float3)(-1000.0f, -1000.0f, -1000.0f);
  for (int b=0; b <= 255; b++) {
    for (int g=0; g <= 255; g++) {
      for (int r=0; r < 255; r++) {
        int3 origRGB = (int3)(r, g, b);
        float3 rgb = convert_float3(origRGB) / 255.0f;
        float3 xyz = rgb2xyz(rgb);
        float3 lab = xyz2lab(xyz);
        float3 norm = normalizeLab(lab);
        float3 LAB = denormalizeLab(norm);
        float3 XYZ = lab2xyz(lab);
        float3 RGB = xyz2rgb(xyz);
        int3 convRGB = convert_int3(RGB * 255.0f + 0.5f);
        float3 err = convert_float3(abs_diff(origRGB, convRGB));
        //float3 err = fabs(rgb-RGB) * 255.0f;
        minErr = min(minErr, err);
        maxErr = max(maxErr, err);
      }
    }
  }
  res[0] = (float4)(minErr, 0.0f);
  res[1] = (float4)(maxErr, 0.0f);
}
